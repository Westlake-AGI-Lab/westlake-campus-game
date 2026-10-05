import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {campus,blocked,move} from '../shared/world';
import {collisionQuery} from '../shared/navigation-geometry';
import {planRoute,landingPoint,validMapPoint,navigationGraph} from '../shared/navigation';
import {destinations} from '../shared/destinations';
import {createGame} from '../server/game';
import {AccountStore} from '../server/accounts';
import type {AirdropReply,Welcome,Point} from '../shared/types';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('navigation collision index agrees with authoritative physics across campus and bridge decks',()=>{
 const fast=collisionQuery(),b=campus.meta.bounds;let seed=41;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<2500;i++){const p={x:b.minX+random()*(b.maxX-b.minX),z:b.minZ+random()*(b.maxZ-b.minZ)};assert.equal(fast.blocked(p),blocked(p),JSON.stringify(p));}
 for(const bridge of [...campus.bridges,...(campus.waterWalkways||[])])for(const p of bridge.points)assert.equal(fast.blocked(p),blocked(p),bridge.id);
});
test('safe airdrop resolves walls and water, retains free coordinates and avoids players; schema rejects spoofing',()=>{
 for(const value of [null,{}, {x:NaN,z:0},{x:Infinity,z:0},{x:1e6,z:0},{x:0,z:0,damage:100}])assert.equal(validMapPoint(value),false);
 const free=campus.spawnPoints[0];assert.deepEqual(landingPoint(free),free);assert.ok(Math.hypot(landingPoint(free,[free])!.x-free.x,landingPoint(free,[free])!.z-free.z)>1.5);
 for(const p of [{x:campus.colliders[0].x,z:campus.colliders[0].z},...destinations.filter(d=>d.building).map(d=>d.point),{x:450,z:-37.8}]){const next=landingPoint(p);assert.ok(next);assert.equal(blocked(next),false);}
});
test('every building and all listed destinations have a route; representative routes pass continuous shared movement',async()=>{
 const results=destinations.map(d=>{const r=planRoute(campus.spawnPoints[0],d.point,d.building);assert.ok(r.ok,d.name+('error' in r?' '+r.error:''));if(!r.ok)throw Error(d.name);for(const p of r.path)assert.equal(blocked(p),false,d.name);return{id:d.id,name:d.name,status:'PASS',distance:r.distance,adjusted:r.adjusted};});
 const pairs=[{start:campus.spawnPoints[0],target:destinations.find(d=>d.id==='library')!.point,building:true},{start:{x:275,z:260},target:{x:355,z:327},building:false},{start:{x:0,z:630},target:campus.spawnPoints[0],building:false},{start:{x:123,z:86},target:{x:183,z:128},building:false}];
 for(const pair of pairs){const route=planRoute(pair.start,pair.target,pair.building);assert.ok(route.ok);if(!route.ok)continue;let p=route.path[0];for(const goal of route.path.slice(1)){let tries=0;while(Math.hypot(goal.x-p.x,goal.z-p.z)>.025){assert.ok(++tries<20000,'route walking stalled');const d=Math.hypot(goal.x-p.x,goal.z-p.z),next=move(p,{x:(goal.x-p.x)/d,z:(goal.z-p.z)/d,run:false},Math.min(.025,d/4.6));assert.ok(Math.hypot(next.x-p.x,next.z-p.z)>1e-7,'blocked segment');p=next;}}}
 await writeFile('reports/navigation-route-audit.json',JSON.stringify({status:'PASS',testedAt:new Date().toISOString(),graph:navigationGraph,destinations:results,continuousRoutes:pairs.length},null,2));
});
test('real sockets: airdrop is authoritative, synced and immediately saved; records and health stay intact',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'westlake-airdrop-')),path=join(dir,'accounts.sqlite'),store=new AccountStore(path),account=await store.register('navigation-owner','云风禾','campus-test-123',campus.spawnPoints[0]);store.save([{...account,kills:7,deaths:4}]);store.close();
 const http=createServer(),game=createGame(http,{databasePath:path}),clients:Socket[]=[];await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`;
 async function enter(payload:unknown){const s=io(url,{transports:['websocket'],reconnection:false});clients.push(s);const w=await new Promise<Welcome>(r=>s.on('connect',()=>s.emit('join',payload,r)));return{s,w};}
 const drop=(s:Socket,p:unknown)=>new Promise<AirdropReply>(r=>s.emit('airdrop',p,r));let saved:Point|undefined;
 try{const a=await enter({mode:'login',username:'navigation-owner',password:'campus-test-123',color:0}),b=await enter({mode:'register',username:'navigation-observer',displayName:'晴风禾',password:'campus-test-123',color:1});let snapshot:any;b.s.on('world',v=>snapshot=v);
  assert.equal((await drop(a.s,{x:0,z:0,hp:1000})).ok,false);const bridge=campus.bridges[3],requested=bridge.points[Math.floor(bridge.points.length/2)],reply=await drop(a.s,requested);if(!reply.ok)throw Error(reply.error);assert.ok(reply.ok);saved=reply.point;const p=game.snapshot().players.find(p=>p.id===a.w.playerId)!;assert.equal(p.relocation,1);assert.equal(p.kills,7);assert.equal(p.deaths,4);assert.equal(p.hp,100);assert.equal((await drop(a.s,campus.spawnPoints[0])).ok,false);await wait(100);assert.equal(snapshot.players.find((p:any)=>p.id===a.w.playerId).x,saved.x);
  const observerDrop=await drop(b.s,saved);assert.ok(observerDrop.ok);if(observerDrop.ok)assert.ok(Math.hypot(observerDrop.point.x-saved.x,observerDrop.point.z-saved.z)>1.5);
 }finally{for(const s of clients)s.disconnect();await game.close();}
 try{const reopened=new AccountStore(path),restored=await reopened.login('navigation-owner','campus-test-123');assert.equal(restored.x,saved!.x);assert.equal(restored.z,saved!.z);assert.equal(restored.kills,7);assert.equal(restored.deaths,4);reopened.close();}finally{await rm(dir,{recursive:true,force:true});}
});
