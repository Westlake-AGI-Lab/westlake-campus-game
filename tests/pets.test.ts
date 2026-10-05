import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {io,type Socket} from 'socket.io-client';
import {createGame} from '../server/game';
import {registration} from './account-helpers';
import {createPets,petAction,stepPet,validPetAction} from '../shared/pets';
import {fighterState} from '../shared/fighter';
import {blocked} from '../shared/world';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('pets: validated commands, proximity, one per species, exclusive ownership, feeding cooldown and collision-safe following',()=>{
 const pets=createPets(),p={...fighterState(),...pets[0],id:'owner',vehicleId:null,shuttleId:null} as any;
 assert.equal(pets.length,7);assert.ok(pets.every(p=>!blocked(p)));assert.ok(validPetAction({id:'pet-1',kind:'feed'}));for(const v of [{id:'pet-1',kind:'steal'},{id:'pet-1',kind:'adopt',ownerId:'other'},null])assert.equal(validPetAction(v),false);
 assert.equal(petAction(pets[0],{...p,x:999},pets,'adopt',10000).ok,false);assert.equal(petAction(pets[0],p,pets,'adopt',10000).ok,true);
 assert.equal(petAction(pets[0],{...p,id:'other'},pets,'adopt',10000).ok,false);assert.equal(petAction(pets[0],{...p,id:'other'},pets,'release',10000).ok,false);
 assert.equal(petAction(pets[1],{...p,x:pets[1].x,z:pets[1].z},pets,'adopt',10000).ok,false);
 assert.equal(petAction(pets[0],p,pets,'feed',10000).ok,true);assert.equal(petAction(pets[0],p,pets,'feed',11000).ok,false);
 for(let i=0;i<300;i++){stepPet(pets[0],{...p,x:p.x+10,z:p.z+6},10000+i*50,.05);assert.equal(blocked(pets[0]),false);}assert.ok(Math.hypot(pets[0].x-(p.x+10),pets[0].z-(p.z+6))<4);
 assert.equal(petAction(pets[0],p,pets,'release',15000).ok,true);assert.equal(pets[0].ownerId,null);
});
test('real sockets: adoption races, feed sync, dog assists only owner attacks, release transfer, restart and private snapshots',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'campus-pets-')),db=join(dir,'pets.sqlite');let http=createServer(),game=createGame(http,{databasePath:db});await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));let url=`http://127.0.0.1:${(http.address() as any).port}`;const sockets:Socket[]=[];
 const emit=(s:Socket,event:string,value:unknown)=>new Promise<any>(r=>s.emit(event,value,r));
 async function connect(auth:any){const s=io(url,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise<void>(r=>s.once('connect',r));const w=await emit(s,'join',auth);return {s,id:w.playerId,token:w.token,auth};}
 try{
 const a=await connect(registration()),b=await connect(registration()),dog=game.snapshot().pets!.find(p=>p.kind==='dog')!;
 assert.equal((await emit(a.s,'pet',{id:dog.id,kind:'adopt'})).ok,false);
 await emit(a.s,'airdrop',{x:dog.x,z:dog.z});await emit(b.s,'airdrop',{x:dog.x+2,z:dog.z});await wait(500);
 const [ra,rb]=await Promise.all([emit(a.s,'pet',{id:dog.id,kind:'adopt'}),emit(b.s,'pet',{id:dog.id,kind:'adopt'})]);assert.equal(Number(ra.ok)+Number(rb.ok),1);const owner=ra.ok?a:b,other=ra.ok?b:a;
 await wait(450);assert.equal((await emit(owner.s,'pet',{id:dog.id,kind:'feed'})).ok,true);assert.ok(game.snapshot().pets!.find(p=>p.id===dog.id)!.fedAt>0);
 await wait(2100);assert.equal(game.snapshot().players.find(p=>p.id===other.id)!.hp,100);assert.equal(game.snapshot().pets!.find(p=>p.id===dog.id)!.attackAt,0);
 const source=game.snapshot().players.find(p=>p.id===owner.id)!;const target=game.snapshot().players.find(p=>p.id===other.id)!;
 const hit=await emit(owner.s,'attack',{seq:1,yaw:Math.atan2(target.x-source.x,target.z-source.z)});assert.equal(hit.ok,true);assert.equal(hit.punch.targetId,other.id);await wait(250);assert.ok(game.snapshot().players.find(p=>p.id===other.id)!.hp<75);assert.ok(game.snapshot().pets!.find(p=>p.id===dog.id)!.attackAt>0);
 const hp=game.snapshot().players.find(p=>p.id===other.id)!.hp;await wait(300);assert.equal(game.snapshot().players.find(p=>p.id===other.id)!.hp,hp);
 await wait(450);assert.equal((await emit(other.s,'pet',{id:dog.id,kind:'release'})).ok,false);await wait(450);assert.equal((await emit(owner.s,'pet',{id:dog.id,kind:'release'})).ok,true);
 const free=game.snapshot().pets!.find(p=>p.id===dog.id)!;await wait(2000);await emit(other.s,'airdrop',{x:free.x,z:free.z});await wait(500);assert.equal((await emit(other.s,'pet',{id:dog.id,kind:'adopt'})).ok,true);
 const cat=game.snapshot().pets![0];await wait(2100);await emit(other.s,'airdrop',{x:cat.x,z:cat.z});await wait(500);assert.equal((await emit(other.s,'pet',{id:cat.id,kind:'adopt'})).ok,true);
 assert.ok(!JSON.stringify(game.snapshot()).includes(a.auth.username));for(const s of sockets)s.disconnect();await wait(100);await game.close();
 http=createServer();game=createGame(http,{databasePath:db});await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${(http.address() as any).port}`;
 assert.equal(game.snapshot().pets!.find(p=>p.id===dog.id)!.ownerId,other.id);const returned=await connect({mode:'login',username:other.auth.username,password:other.auth.password,color:0});assert.equal(returned.id,other.id);await wait(100);assert.equal(game.snapshot().pets!.filter(p=>p.ownerId===other.id).length,2);
 }finally{for(const s of sockets)s.disconnect();await game.close();rmSync(dir,{recursive:true,force:true});}
});
