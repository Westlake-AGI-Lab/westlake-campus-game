import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {io,type Socket} from 'socket.io-client';
import {createGame} from '../server/game';
import {registration} from './account-helpers';
import {SHUTTLE,SHUTTLE_STOPS,SHUTTLE_ROUTE_LENGTH,createShuttles,shuttlePose,shuttleStaticBlocked,shuttleContains,shuttleExit,stepShuttle,validShuttleAction} from '../shared/shuttle';
import {createVehicles} from '../shared/vehicles';
import {blocked} from '../shared/world';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('shuttle: full loop and six stops are safe, cycles include dwell, dynamic obstacles yield and exit points remain free',()=>{
 assert.equal(SHUTTLE_STOPS.length,6);assert.equal(SHUTTLE.capacity,12);
 assert.ok(validShuttleAction({seq:0,kind:'enter',shuttleId:'shuttle-1'}));for(const bad of [{seq:0,kind:'enter',shuttleId:'shuttle-3'},{seq:0,kind:'exit',x:999},{seq:NaN,kind:'exit'}])assert.equal(validShuttleAction(bad),false);
 const cars=createVehicles();for(const s of SHUTTLE_STOPS)assert.equal(blocked(s.point),false);
 const [initial]=createShuttles(0);let bus=initial,wraps=0,stops=0;for(let now=100;now<1250000;now+=100){const before=bus,old=bus.distance;bus=stepShuttle(bus,.1,now,cars);if(bus.distance<old-1)wraps++;if(bus.nextStop!==before.nextStop){stops++;assert.equal(bus.speed,0);assert.equal(bus.dwellUntil,now+SHUTTLE.dwellMs);}assert.equal(bus.blocked,false);}
 assert.ok(wraps>=2);assert.ok(stops>=12);
 for(let d=0;d<SHUTTLE_ROUTE_LENGTH;d+=1){const pose=shuttlePose(d);assert.equal(shuttleStaticBlocked(pose),false);if(d%20===0){const v={...bus,...pose,distance:d},point=shuttleExit(v,cars,[v]);assert.ok(point);assert.equal(blocked(point!),false);assert.equal(shuttleContains(v,point!),false);}}
 assert.equal(stepShuttle({...initial,dwellUntil:0},.1,100,[],[{x:initial.x,z:initial.z}]).blocked,true);
 assert.equal(stepShuttle({...initial,dwellUntil:0},.1,100,[{...cars[0],x:initial.x,z:initial.z}]).blocked,true);
});
test('real sockets: multiple bus passengers follow the authoritative bus, cannot drive/fight/airdrop, exit safely and disconnect frees seats',async()=>{
 const http=createServer(),game=createGame(http,{databasePath:':memory:'});await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`,sockets:Socket[]=[];
 const emit=(s:Socket,event:string,value:unknown)=>new Promise<any>(r=>s.emit(event,value,r));
 async function join(){const s=io(url,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise<void>(r=>s.once('connect',r));const welcome=await emit(s,'join',registration());return {s,id:welcome.playerId,token:welcome.token};}
 try{
 const a=await join(),b=await join(),bus=game.snapshot().shuttles![0];
 assert.equal((await emit(a.s,'shuttle',{seq:0,kind:'enter',shuttleId:bus.id})).ok,false);
 const stop=SHUTTLE_STOPS.find(s=>s.id==='shuttle-stop-south')!;
 await emit(a.s,'airdrop',stop.point);await emit(b.s,'airdrop',{x:stop.point.x-2,z:stop.point.z});await wait(430);
 assert.equal((await emit(a.s,'shuttle',{seq:1,kind:'enter',shuttleId:bus.id})).ok,true);assert.equal((await emit(b.s,'shuttle',{seq:0,kind:'enter',shuttleId:bus.id})).ok,true);
 assert.equal(game.snapshot().shuttles![0].passengerIds.length,2);
 const extra=[];for(let i=2;i<SHUTTLE.capacity;i++){const rider=await join();extra.push(rider);await emit(rider.s,'airdrop',stop.point);assert.equal((await emit(rider.s,'shuttle',{seq:0,kind:'enter',shuttleId:bus.id})).ok,true);}const overflow=await join();await emit(overflow.s,'airdrop',stop.point);assert.equal((await emit(overflow.s,'shuttle',{seq:0,kind:'enter',shuttleId:bus.id})).ok,false);assert.equal(game.snapshot().shuttles![0].passengerIds.length,SHUTTLE.capacity);overflow.s.disconnect();
 assert.equal((await emit(a.s,'shuttle',{seq:2,kind:'exit',x:999})).ok,false);
 assert.equal((await emit(a.s,'airdrop',{x:0,z:0})).ok,false);assert.equal((await emit(a.s,'attack',{seq:0,yaw:0})).reason,'busy');assert.equal((await emit(a.s,'combat',{seq:0,kind:'dodge',x:1,z:0})).reason,'busy');
 a.s.emit('drive',{seq:100,throttle:1,steer:1,brake:false});a.s.emit('input',{seq:100,x:1,z:0,run:true});await wait(12500);
 const moving=game.snapshot(),v=moving.shuttles![0];assert.ok(v.distance!==bus.distance);for(const id of[a.id,b.id]){const p=moving.players.find(p=>p.id===id)!;assert.equal(p.shuttleId,bus.id);assert.ok(Math.hypot(p.x-v.x,p.z-v.z)<.001);}
 assert.equal((await emit(a.s,'shuttle',{seq:3,kind:'exit'})).ok,true);const exited=game.snapshot().players.find(p=>p.id===a.id)!;assert.equal(exited.shuttleId,null);assert.equal(blocked(exited),false);assert.equal(shuttleContains(game.snapshot().shuttles![0],exited),false);assert.equal(game.snapshot().shuttles![0].passengerIds.length,SHUTTLE.capacity-1);
 b.s.disconnect();for(const rider of extra)rider.s.disconnect();await wait(100);assert.equal(game.snapshot().shuttles![0].passengerIds.length,0);
 const returned=io(url,{transports:['websocket'],reconnection:false});sockets.push(returned);await new Promise<void>(r=>returned.once('connect',r));const w=await emit(returned,'join',{mode:'resume',token:b.token,color:0});assert.equal(w.playerId,b.id);assert.equal(w.snapshot.players.find((p:any)=>p.id===b.id).shuttleId,null);
 const c=await join();assert.ok(c.id);assert.equal(game.snapshot().shuttles![0].passengerIds.length,0);
 }finally{for(const s of sockets)s.disconnect();await game.close();}
});
