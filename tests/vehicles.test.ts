import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {io,type Socket} from 'socket.io-client';
import {createGame} from '../server/game';
import {registration} from './account-helpers';
import {createVehicles,vehicleBlocked,vehicleExit,vehicleContains,validDrive,validVehicleAction,stepVehicle,VEHICLE} from '../shared/vehicles';
import {campus,blocked} from '../shared/world';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('vehicles: safe parking, bounded commands, swept collision, steering, reverse, braking and safe exit',()=>{
 const cars=createVehicles();assert.equal(cars.length,4);for(const c of cars){assert.equal(vehicleBlocked(c,cars),false);const exit=vehicleExit(c,cars,[])!;assert.ok(exit);assert.equal(blocked(exit),false);assert.ok(cars.every(v=>!vehicleContains(v,exit)));}
 assert.ok(validDrive({seq:0,throttle:1,steer:-1,brake:false}));for(const v of [{seq:1,throttle:NaN,steer:0,brake:false},{seq:1,throttle:2,steer:0,brake:false},{seq:1,throttle:1,steer:0,brake:false,x:8}])assert.equal(validDrive(v),false);
 assert.ok(validVehicleAction({seq:1,kind:'enter',vehicleId:'car-1'}));for(const v of [{seq:1,kind:'enter',vehicleId:'car-99'},{seq:1,kind:'exit',driverId:'other'},{seq:-1,kind:'exit'}])assert.equal(validVehicleAction(v),false);
 let car={...cars[0]};for(let i=0;i<60;i++)car=stepVehicle(car,{throttle:1,steer:0,brake:false},.05);assert.ok(car.x<cars[0].x-10);assert.ok(car.speed<=VEHICLE.maxSpeed);for(let i=0;i<60;i++)car=stepVehicle(car,{throttle:0,steer:0,brake:true},.05);assert.equal(car.speed,0);assert.equal(vehicleBlocked(car),false);
 const turned=stepVehicle({...cars[0],speed:5},{throttle:0,steer:1,brake:false},.05);assert.ok(turned.yaw>cars[0].yaw);
 const reverse=stepVehicle(cars[0],{throttle:-1,steer:0,brake:false},.1);assert.ok(reverse.speed<0);assert.ok(reverse.x>cars[0].x);
 const wall=campus.colliders[0];assert.equal(vehicleBlocked({...cars[0],x:wall.x,z:wall.z}),true);assert.equal(vehicleBlocked({...cars[0],x:campus.meta.bounds.minX+1}),true);
 const stopped=stepVehicle({...cars[0],speed:12},{throttle:1,steer:0,brake:false},.1,[],[{x:cars[0].x-3,z:cars[0].z}]);assert.equal(stopped.speed,0);
});
test('real sockets: exclusive car ownership, driver-only movement, parked handoff, disconnect release and late snapshot',async()=>{
 const http=createServer(),game=createGame(http,{databasePath:':memory:'});await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`,sockets:Socket[]=[];
 const emit=(s:Socket,event:string,value:unknown)=>new Promise<any>(r=>s.emit(event,value,r));
 async function join(){const s=io(url,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise<void>(r=>s.once('connect',r));const w=await emit(s,'join',registration());return {s,id:w.playerId,token:w.token};}
 try{
 const a=await join(),b=await join(),car=game.snapshot().vehicles![0];
 assert.equal((await emit(a.s,'vehicle',{seq:1,kind:'enter',vehicleId:car.id})).ok,false);
 assert.equal((await emit(a.s,'airdrop',{x:car.x,z:car.z+3})).ok,true);assert.equal((await emit(b.s,'airdrop',{x:car.x,z:car.z-3})).ok,true);await wait(430);
 const [one,two]=await Promise.all([emit(a.s,'vehicle',{seq:2,kind:'enter',vehicleId:car.id}),emit(b.s,'vehicle',{seq:1,kind:'enter',vehicleId:car.id})]);assert.equal(Number(one.ok)+Number(two.ok),1);
 const driver=one.ok?a:b,other=one.ok?b:a;assert.equal(game.snapshot().vehicles![0].driverId,driver.id);
 other.s.emit('drive',{seq:1,throttle:1,steer:0,brake:false});driver.s.emit('drive',{seq:1,throttle:1,steer:0,brake:false,x:999});await wait(100);assert.equal(game.snapshot().vehicles![0].x,car.x);
 for(let seq=2;seq<=12;seq++){driver.s.emit('drive',{seq,throttle:1,steer:0,brake:false});await wait(50);}assert.ok(game.snapshot().vehicles![0].x<car.x-.3);
 assert.equal((await emit(driver.s,'airdrop',{x:0,z:0})).ok,false);assert.equal((await emit(driver.s,'attack',{seq:0,yaw:0})).reason,'busy');
 const last=game.snapshot().vehicles![0];await wait(1200);assert.equal(game.snapshot().vehicles![0].speed,0);const parked={...game.snapshot().vehicles![0]};assert.ok(parked.x<=last.x);
 assert.equal((await emit(driver.s,'vehicle',{seq:3,kind:'exit'})).ok,true);assert.equal(game.snapshot().vehicles![0].driverId,null);assert.equal(game.snapshot().vehicles![0].x,parked.x);assert.equal(game.snapshot().players.find(p=>p.id===driver.id)!.vehicleId,null);
 await wait(1600);assert.equal((await emit(other.s,'airdrop',{x:parked.x,z:parked.z-3})).ok,true);assert.equal((await emit(other.s,'vehicle',{seq:4,kind:'enter',vehicleId:car.id})).ok,true);
 other.s.disconnect();await wait(100);assert.equal(game.snapshot().vehicles![0].driverId,null);assert.equal(game.snapshot().vehicles![0].speed,0);
 const c=await join();assert.ok(c.id);assert.equal(game.snapshot().vehicles![0].x,parked.x);assert.equal(game.snapshot().vehicles![0].driverId,null);
 const returned=io(url,{transports:['websocket'],reconnection:false});sockets.push(returned);await new Promise<void>(r=>returned.once('connect',r));const w=await emit(returned,'join',{mode:'resume',token:other.token,color:0});assert.equal(w.playerId,other.id);assert.equal(w.snapshot.players.find((p:any)=>p.id===other.id).vehicleId,null);
 }finally{for(const s of sockets)s.disconnect();await game.close();}
});
