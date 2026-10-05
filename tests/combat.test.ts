import {registration} from './account-helpers';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {io,type Socket} from 'socket.io-client';
import {COMBAT} from '../shared/config';
import {campus,blocked,heightAt} from '../shared/world';
import type {Player,Point,Welcome,AttackReply} from '../shared/types';
import {validateAttack,punchTarget,punchLineClear,respawnPoints,chooseRespawn,regenerateHealth} from '../server/combat';
import {createGame} from '../server/game';
import {playerSize} from '../shared/player-size';
import {fighterState} from '../shared/fighter';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const player=(id:string,p:Point,extra:Partial<Player>={}):Player=>({...fighterState(),...p,id,name:id,color:0,yaw:Math.PI/2,moving:false,ack:0,hp:100,kills:0,deaths:0,life:0,relocation:0,punchAt:0,hitAt:0,protectedUntil:0,...extra});

test('attack schema accepts only finite facing and monotonic-sequence fields',()=>{
 assert.ok(validateAttack({seq:1,yaw:Math.PI}));
 for(const value of [null,{}, {seq:-1,yaw:0},{seq:1.5,yaw:0},{seq:1,yaw:NaN},{seq:1,yaw:Infinity},{seq:1,yaw:4},{seq:1,yaw:0,targetId:'victim'},{seq:1,yaw:0,damage:100},{seq:1,yaw:0,hp:100}])assert.equal(validateAttack(value),false);
});

test('punch chooses nearest player in reach and facing; shields, walls and self block hits',()=>{
 const origin=campus.spawnPoints[0],a=player('a',origin),near=player('near',{x:a.x+1,z:a.z}),far=player('far',{x:a.x+1.8,z:a.z}),behind=player('behind',{x:a.x-1,z:a.z});
 assert.equal(punchTarget(a,[a,behind,far,near],1000)?.id,'near');
 assert.equal(punchTarget(a,[player('out',{x:a.x+2.5,z:a.z}),behind],1000),undefined);
 assert.equal(punchTarget(a,[{...near,protectedUntil:1001}],1000),undefined);
 assert.equal(punchTarget(a,[{...near,protectedUntil:1000}],1000)?.id,'near');
 const wall=campus.colliders.map(c=>{
  const alongWidth=c.w<c.d,half=(alongWidth?c.w:c.d)/2+.5;
  const dx=alongWidth?Math.cos(c.rotation):-Math.sin(c.rotation),dz=alongWidth?Math.sin(c.rotation):Math.cos(c.rotation);
  return {a:{x:c.x-dx*half,z:c.z-dz*half},b:{x:c.x+dx*half,z:c.z+dz*half}};
 }).find(v=>Math.hypot(v.a.x-v.b.x,v.a.z-v.b.z)<=COMBAT.punchRange&&!blocked(v.a)&&!blocked(v.b)&&Math.abs(heightAt(v.a)-heightAt(v.b))<1.5);
 assert.ok(wall,'real thin campus collider with reachable endpoints');
 assert.equal(punchLineClear(wall.a,wall.b),false);
 assert.equal(punchTarget(player('a',wall.a,{yaw:Math.atan2(wall.b.x-wall.a.x,wall.b.z-wall.a.z)}),[player('b',wall.b)],1000),undefined);
});

test('random respawn pool is dry and collision-free; avoids occupied and nearby locations',()=>{
 const pool=respawnPoints();assert.ok(pool.length>100);
 for(const p of pool){assert.equal(blocked(p),false);assert.ok(heightAt(p)<.05);}
 const death=pool[0],occupied=pool.find(p=>Math.hypot(p.x-death.x,p.z-death.z)>25)!;
 const outcomes=new Set<string>();
 for(let i=0;i<20;i++){
  const next=chooseRespawn(death,[occupied],pool,()=>i/20);
  assert.ok(Math.hypot(next.x-death.x,next.z-death.z)>=COMBAT.respawnMinDistance);
  assert.ok(Math.hypot(next.x-occupied.x,next.z-occupied.z)>3);
  outcomes.add(JSON.stringify(next));
 }
 assert.ok(outcomes.size>10);
 assert.throws(()=>chooseRespawn(death,[],[]));
});

test('real sockets: four punches, cooldown and spoof rejection, random full-health respawn, stats and resume',async()=>{
 const http=createServer(),game=createGame(http),clients:Socket[]=[];
 await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(http.address() as any).port}`;
 async function join(name:string,token:string|null=null){const s=io(url,{transports:['websocket'],reconnection:false});clients.push(s);const w=await new Promise<Welcome>(r=>s.on('connect',()=>s.emit('join',token?{mode:'resume',color:0,token}:registration(0),r)));return{s,w};}
 const attack=(s:Socket,seq:number,yaw=Math.PI/2,extra={})=>new Promise<AttackReply>(r=>s.emit('attack',{seq,yaw,...extra},r));
 const find=(id:string)=>game.snapshot().players.find(p=>p.id===id)!;
 try{
  const a=await join('出拳者'),b=await join('对手');let inputSeq=0;
  assert.equal((await attack(a.s,0,Math.PI/2,{targetId:b.w.playerId,damage:100})).reason,'invalid');
  assert.equal(find(b.w.playerId).hp,100);
  while(Math.hypot(find(a.w.playerId).x-find(b.w.playerId).x,find(a.w.playerId).z-find(b.w.playerId).z)>1.6){a.s.emit('input',{seq:++inputSeq,x:1,z:0,run:false});await wait(100);assert.ok(inputSeq<20);}
  a.s.emit('input',{seq:++inputSeq,x:0,z:0,run:false});await wait(70);
  const initial={...find(b.w.playerId)};
  assert.equal((await attack(a.s,1)).punch?.targetId,b.w.playerId);assert.equal(find(b.w.playerId).hp,75);
  assert.equal((await attack(a.s,1)).reason,'invalid');assert.equal((await attack(a.s,2)).reason,'cooldown');assert.equal(find(b.w.playerId).hp,75);
  for(let seq=3;seq<=5;seq++){await wait(COMBAT.punchCooldownMs+20);const result=await attack(a.s,seq);assert.equal(result.ok,true);assert.equal(result.punch?.targetId,b.w.playerId);assert.equal(result.punch?.knockout,seq===5);}
  const revived=find(b.w.playerId);assert.equal(revived.hp,100);assert.equal(revived.deaths,1);assert.equal(revived.life,1);assert.equal(find(a.w.playerId).kills,1);
  assert.ok(Math.hypot(revived.x-initial.x,revived.z-initial.z)>=25);assert.equal(blocked(revived),false);assert.equal(heightAt(revived),0);assert.ok(revived.protectedUntil>Date.now());assert.equal(game.snapshot().count,2);
  b.s.emit('home');await wait(100);assert.equal(find(b.w.playerId).deaths,1);assert.ok(find(b.w.playerId).protectedUntil>Date.now());
  // Move the attacker back toward the returned player using only permitted input.
  while(Math.hypot(find(a.w.playerId).x-find(b.w.playerId).x,find(a.w.playerId).z-find(b.w.playerId).z)>1.6){a.s.emit('input',{seq:++inputSeq,x:-1,z:0,run:false});await wait(100);assert.ok(inputSeq<40);}
  a.s.emit('input',{seq:++inputSeq,x:0,z:0,run:false});await wait(70);
  assert.equal((await attack(b.s,1)).punch?.targetId,a.w.playerId);assert.equal(find(b.w.playerId).protectedUntil,0);assert.equal(find(a.w.playerId).hp,75);
  a.s.emit('home');await wait(100);assert.equal(find(a.w.playerId).hp,75);assert.equal(find(a.w.playerId).kills,1);
  b.s.disconnect();await wait(50);const recovered=await join('恢复',b.w.token);assert.equal(recovered.w.playerId,b.w.playerId);assert.equal(recovered.w.resumed,true);assert.equal(find(b.w.playerId).deaths,1);assert.equal((await attack(recovered.s,1)).reason,'cooldown');
  a.s.disconnect();await wait(50);const recoveredA=await join('恢复A',a.w.token);assert.equal(find(recoveredA.w.playerId).hp,75);assert.equal(find(recoveredA.w.playerId).kills,1);
  const fresh=await join('新角色');assert.equal(find(fresh.w.playerId).kills,0);assert.equal(find(fresh.w.playerId).deaths,0);assert.equal(find(fresh.w.playerId).hp,100);
 }finally{for(const s of clients)s.disconnect();await game.close();}
});


test('record-derived size grows and shrinks, cancels equal records and respects both bounds',()=>{
 assert.equal(playerSize({kills:0,deaths:0}),1);
 assert.equal(playerSize({kills:1,deaths:0}),1.06);
 assert.equal(playerSize({kills:0,deaths:1}),.94);
 assert.equal(playerSize({kills:21,deaths:21}),1);
 assert.equal(playerSize({kills:1000,deaths:0}),COMBAT.maxSize);
 assert.equal(playerSize({kills:0,deaths:1000}),COMBAT.minSize);
});
test('regeneration waits after damage and outgoing punches, heals integer steps, clamps health and never revives',()=>{
 const p=player('regen',campus.spawnPoints[0],{hp:75,hitAt:10000});
 let cursor=10000;cursor=regenerateHealth(p,14999,cursor);assert.equal(p.hp,75);
 cursor=regenerateHealth(p,15999,cursor);assert.equal(p.hp,75);
 cursor=regenerateHealth(p,16000,cursor);assert.equal(p.hp,77);
 cursor=regenerateHealth(p,16050,cursor);assert.equal(p.hp,77);
 p.punchAt=16500;cursor=regenerateHealth(p,22000,cursor);assert.equal(p.hp,77);
 cursor=regenerateHealth(p,22500,cursor);assert.equal(p.hp,79);
 p.hitAt=23000;cursor=regenerateHealth(p,29000,cursor);assert.equal(p.hp,81);
 cursor=regenerateHealth(p,100000,cursor);assert.equal(p.hp,100);
 p.hp=0;regenerateHealth(p,200000,cursor);assert.equal(p.hp,0);
 // Reconnecting starts at current time and cannot collect the offline interval.
 p.hp=75;p.hitAt=10000;p.punchAt=0;cursor=regenerateHealth(p,300000,300000);assert.equal(p.hp,75);
 regenerateHealth(p,301000,cursor);assert.equal(p.hp,77);
});
