import {registration} from './account-helpers';
import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {io,Socket} from 'socket.io-client';import {createGame} from '../server/game';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('authoritative server: independent IDs, malformed input, rate limits, range, resume and offline cleanup',async()=>{const http=createServer(),game=createGame(http);await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`;const sockets:Socket[]=[];
 async function join(token:string|null=null){const s=io(url,{transports:['websocket'],reconnection:false});sockets.push(s);const w:any=await new Promise(r=>s.on('connect',()=>s.emit('join',token?{mode:'resume',color:2,token}:registration(2),r)));return{s,w};}
 try{const a=await join(),b=await join();assert.notEqual(a.w.playerId,b.w.playerId);assert.equal(game.snapshot().count,2);assert.equal(a.w.snapshot.players[0].name.length,3);const before=game.snapshot().players.find(p=>p.id===a.w.playerId)!;
 a.s.emit('input',{seq:1,x:0,z:-1,run:false,playerId:b.w.playerId});a.s.emit('input',{seq:2,x:99,z:99,run:true});a.s.emit('input',{seq:3,x:'NaN',z:0,run:false});await wait(120);assert.deepEqual(game.snapshot().players.find(p=>p.id===a.w.playerId),before);
 a.s.emit('input',{seq:4,x:0,z:-1,run:false});await wait(200);const moved=game.snapshot().players.find(p=>p.id===a.w.playerId)!;assert.ok(moved.z<before.z-.5);assert.equal(game.snapshot().players.find(p=>p.id===b.w.playerId)!.z,b.w.snapshot.players.find((p:any)=>p.id===b.w.playerId).z);
 await wait(650);const stopped=game.snapshot().players.find(p=>p.id===a.w.playerId)!;await wait(250);assert.equal(game.snapshot().players.find(p=>p.id===a.w.playerId)!.z,stopped.z);
 let bubbles=0;b.s.on('bubble',()=>bubbles++);a.s.emit('say','free text');a.s.emit('say','wave');a.s.emit('say','wave');await wait(100);assert.equal(bubbles,1);
 for(let i=10;i<300;i++)a.s.emit('input',{seq:i,x:0,z:-1,run:false});await wait(100);assert.ok(game.stats().rejected>200);
 a.s.disconnect();await wait(100);assert.equal(game.snapshot().count,1);const recovered=await join(a.w.token);assert.equal(recovered.w.playerId,a.w.playerId);assert.equal(recovered.w.resumed,true);assert.equal(game.snapshot().count,2);
 const third=await join(a.w.token);assert.equal(third.w.code,'online');assert.equal(game.snapshot().count,2);
 }finally{for(const s of sockets)s.disconnect();await game.close();}
});
test('40 metre chat range and abnormal silent TCP heartbeat cleanup under 15 seconds',async()=>{const http=createServer(),game=createGame(http);await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`;const clients:Socket[]=[];
 async function join(){const s=io(url,{transports:['websocket'],reconnection:false});clients.push(s);const w:any=await new Promise(r=>s.on('connect',()=>s.emit('join',registration(1),r)));return{s,w};}
 try{const a=await join(),b=await join();let bubbles=0;b.s.on('bubble',()=>bubbles++);a.s.emit('say','hello');await wait(100);assert.equal(bubbles,1);for(let i=0;i<80;i++){b.s.emit('input',{seq:i,x:1,z:0,run:true});await wait(100);}const ps=game.snapshot().players;assert.ok(Math.hypot(ps[0].x-ps[1].x,ps[0].z-ps[1].z)>40);a.s.emit('say','wave');await wait(100);assert.equal(bubbles,1);
 const raw=(b.s.io.engine.transport as any).ws._socket;raw.pause();const began=Date.now();while(game.snapshot().count===2&&Date.now()-began<15000)await wait(100);assert.equal(game.snapshot().count,1);assert.ok(Date.now()-began<15000);raw.destroy();
 }finally{for(const s of clients)s.disconnect();await game.close();}
});
