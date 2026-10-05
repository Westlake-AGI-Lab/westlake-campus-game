import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {io,type Socket} from 'socket.io-client';
import {COMBAT,CONFIG} from '../shared/config';
import {fighterState,fighterMovement} from '../shared/fighter';
import {campus,blocked,move} from '../shared/world';
import {resolveDefense,validateCombatAction,validateAttack,punchTarget} from '../server/combat';
import {createGame} from '../server/game';
import {registration} from './account-helpers';
import type {Player,Welcome,AttackReply} from '../shared/types';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const actor=(x:number,z:number,extra:Partial<Player>={}):Player=>({...fighterState(),x,z,id:'actor',name:'云风禾',color:0,yaw:0,moving:false,ack:0,hp:100,kills:0,deaths:0,life:0,relocation:0,punchAt:0,hitAt:0,protectedUntil:0,...extra});

test('competitive schemas reject forged resources, timings, direction magnitude and replay-like sequence values',()=>{
 assert.ok(validateAttack({seq:1,yaw:0,kind:'heavy'}));assert.equal(validateAttack({seq:1,yaw:0,kind:'explosion'}),false);
 assert.ok(validateCombatAction({seq:1,kind:'guard',active:true,yaw:0}));assert.ok(validateCombatAction({seq:1,kind:'dodge',x:1,z:0}));
 for(const v of[{seq:1,kind:'dodge',x:0,z:0},{seq:1,kind:'dodge',x:2,z:0},{seq:1,kind:'dodge',x:NaN,z:0},{seq:1,kind:'guard',active:true,yaw:Infinity},{seq:1,kind:'guard',active:true,yaw:0,energy:100},{seq:-1,kind:'dodge',x:1,z:0},{seq:1,kind:'dodge',x:1,z:0,duration:9999}])assert.equal(validateCombatAction(v),false);
});
test('front guard, timed parry, rear attack and heavy guard-break form distinct counters',()=>{
 const a=actor(0,0,{id:'a'}),b=actor(1,0,{id:'b',yaw:-Math.PI/2,guardUntil:2000,guardAt:1000});
 assert.deepEqual(resolveDefense(a,b,'light',1500),{damage:5,defense:'block'});
 assert.deepEqual(resolveDefense(a,b,'light',1100),{damage:0,defense:'parry'});assert.equal(a.stunnedUntil,1550);
 b.yaw=Math.PI/2;assert.deepEqual(resolveDefense(a,b,'light',1500),{damage:25});
 b.yaw=-Math.PI/2;assert.deepEqual(resolveDefense(a,b,'heavy',1500),{damage:25,defense:'break'});assert.equal(b.guardUntil,0);assert.equal(b.stunnedUntil,1950);
 b.dodgeUntil=2000;const origin=campus.spawnPoints[0];Object.assign(a,origin,{yaw:Math.PI/2});Object.assign(b,{x:origin.x+1,z:origin.z});assert.equal(punchTarget(a,[b],1500),undefined);
});
test('dodge uses solid-world movement, guard slows walking and stun freezes both normal and dodge movement',()=>{
 const p=actor(campus.spawnPoints[0].x,campus.spawnPoints[0].z),i={x:1,z:0,run:true},normal=move(p,i,.05);
 p.guardUntil=2000;const guarded=fighterMovement(p,i,.05,1000);assert.ok(guarded.x-p.x<(normal.x-p.x)/2);
 p.stunnedUntil=2000;p.dodgeUntil=2000;p.dodgeX=1;assert.deepEqual(fighterMovement(p,i,.05,1000),{x:p.x,z:p.z});
 const edge=actor(campus.meta.bounds.minX+CONFIG.playerRadius+1,campus.meta.bounds.minZ+20,{dodgeUntil:2000,dodgeX:-1,dodgeZ:0});
 // Pick a free border point so the test exercises movement rather than starts inside a collider.
 for(let z=campus.meta.bounds.minZ+20;blocked(edge)&&z<campus.meta.bounds.maxZ;z+=5)edge.z=z;
 assert.equal(blocked(edge),false);const landing=fighterMovement(edge,i,.25,1000);assert.equal(blocked(landing),false);assert.ok(landing.x>=campus.meta.bounds.minX+CONFIG.playerRadius);
});
test('real sockets: block, parry, delayed heavy break, dodge, resources, cooldowns and guard lease are authoritative',async()=>{
 const http=createServer(),game=createGame(http),clients:Socket[]=[];await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`;
 async function join(){const s=io(url,{transports:['websocket'],reconnection:false});clients.push(s);const w=await new Promise<Welcome>(r=>s.on('connect',()=>s.emit('join',registration(),r)));return{s,w};}
 const find=(id:string)=>game.snapshot().players.find(p=>p.id===id)!;
 let keeper:ReturnType<typeof setInterval>|undefined;
 try{
  const a=await join(),b=await join();let seq=0,combatSeq=0,attackSeq=0;
  while(find(b.w.playerId).x-find(a.w.playerId).x>1.6){a.s.emit('input',{seq:++seq,x:1,z:0,run:false});await wait(100);assert.ok(seq<25);}
  a.s.emit('input',{seq:++seq,x:0,z:0,run:false});await wait(70);
  const guard=(active:boolean)=>new Promise<AttackReply>(r=>b.s.emit('combat',{seq:++combatSeq,kind:'guard',active,yaw:-Math.PI/2},r));
  const punch=(kind:'light'|'heavy'='light')=>new Promise<AttackReply>(r=>a.s.emit('attack',{seq:++attackSeq,yaw:Math.PI/2,kind},r));
  assert.equal((await guard(true)).ok,true);keeper=setInterval(()=>{void guard(true);},80);await wait(250);
  const block=await punch();assert.equal(block.punch?.defense,'block');assert.equal(find(b.w.playerId).hp,95);assert.ok(find(b.w.playerId).energy<100);
  clearInterval(keeper);keeper=undefined;await guard(false);await wait(650);await guard(true);
  const parry=await punch();assert.equal(parry.punch?.defense,'parry');assert.equal(find(b.w.playerId).hp,95);assert.ok(find(a.w.playerId).stunnedUntil>Date.now());
  await guard(false);await wait(650);await guard(true);keeper=setInterval(()=>{void guard(true);},80);await wait(220);
  const heavy=await punch('heavy');assert.equal(heavy.charging,true);assert.equal(find(b.w.playerId).hp,95);assert.ok(find(a.w.playerId).heavyUntil>Date.now());assert.equal((await punch()).reason,'cooldown');
  await wait(250);assert.equal(find(b.w.playerId).hp,95);await wait(450);assert.equal(find(b.w.playerId).hp,70);assert.ok(find(b.w.playerId).stunnedUntil>Date.now());
  clearInterval(keeper);keeper=undefined;await guard(false);await wait(900);
  const next=await punch('heavy');assert.equal(next.charging,true);await wait(450);
  const dodge=await new Promise<AttackReply>(r=>b.s.emit('combat',{seq:++combatSeq,kind:'dodge',x:0,z:1},r));assert.equal(dodge.ok,true);assert.ok(find(b.w.playerId).dodgeUntil>Date.now());assert.ok(find(b.w.playerId).energy<75);
  const rejected=await new Promise<AttackReply>(r=>b.s.emit('combat',{seq:++combatSeq,kind:'dodge',x:0,z:1},r));assert.equal(rejected.ok,false);
  await wait(400);assert.equal(find(b.w.playerId).hp,70);assert.equal(blocked(find(b.w.playerId)),false);
  const energy=find(b.w.playerId).energy;await wait(1200);assert.ok(find(b.w.playerId).energy>energy);
  await guard(true);await wait(COMBAT.guardLeaseMs+100);assert.ok(find(b.w.playerId).guardUntil<=Date.now());
 }finally{if(keeper)clearInterval(keeper);for(const s of clients)s.disconnect();await game.close();}
});
