import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {io,type Socket} from 'socket.io-client';
import {AccountStore} from '../server/accounts';
import {createGame} from '../server/game';
import {isAllowedName,APPROVED_NAMES} from '../shared/names';
import {normalizeUsername} from '../shared/usernames';
import {CONFIG} from '../shared/config';
import {campus} from '../shared/world';
import {TEST_PASSWORD} from './account-helpers';
import {createLegacyAccount} from './legacy-account-fixture';
import type {Welcome,JoinReply,Snapshot} from '../shared/types';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

test('public vocabulary rejects arbitrary, disguised and blocked display names',()=>{
 assert.ok(APPROVED_NAMES.length>10000);assert.ok(isAllowedName('云风禾'));
 for(const name of['江泽月','管理员','校园访客','云风禾 ','云\u200b风禾','<script>','abc','云风','云风禾月','习近月'])assert.equal(isAllowedName(name),false,name);
});
test('private usernames are normalized without applying the public display-name policy',()=>{
 assert.equal(normalizeUsername('  Player.ONE  '),'player.one');assert.equal(normalizeUsername('Ｐｌａｙｅｒ＿１'),'player_1');
 assert.equal(normalizeUsername('江泽月'),'江泽月');assert.equal(normalizeUsername('a'.repeat(32)),'a'.repeat(32));
 for(const username of['ab','a'.repeat(33),'two words','abc\u200b','<script>','../','---','',123])assert.equal(normalizeUsername(username),undefined);
});
test('concurrent normalized duplicate usernames are rejected; repeated display names and saved identity survive reopen',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'westlake-accounts-')),path=join(dir,'accounts.sqlite');let store=new AccountStore(path);
 try{
  const results=await Promise.allSettled([store.register('Private.Owner','云风禾',TEST_PASSWORD,campus.spawnPoints[0]),store.register('private.owner','晴风禾',TEST_PASSWORD,campus.spawnPoints[0])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.code,'duplicate');
  const account=await store.login('PRIVATE.OWNER',TEST_PASSWORD),token=store.issueToken(account.id);
  const first=await store.register('friend.one','云风禾',TEST_PASSWORD,campus.spawnPoints[0]),second=await store.register('friend.two','云风禾',TEST_PASSWORD,campus.spawnPoints[0]);assert.notEqual(first.id,second.id);assert.equal(first.displayName,second.displayName);
  assert.notEqual(store.db.prepare('SELECT password_hash FROM accounts WHERE id=?').get(account.id)!.password_hash,TEST_PASSWORD);
  assert.ok(!store.db.prepare('PRAGMA table_info(accounts)').all().some(row=>['hp','color','yaw','life'].includes(String(row.name))));
  const pendingLogin=store.login('private.owner',TEST_PASSWORD);store.save([{...account,x:account.x+3,z:account.z-2,kills:7,deaths:4}]);assert.equal((await pendingLogin).kills,7);store.close();store=new AccountStore(path);
  const restored=await store.login('private.owner',TEST_PASSWORD);assert.equal(restored.id,account.id);assert.equal(restored.displayName,account.displayName);assert.equal(restored.x,account.x+3);assert.equal(restored.kills,7);assert.equal(restored.deaths,4);assert.equal(store.resume(token).id,account.id);
  await assert.rejects(store.login('private.owner','incorrect-pass'),{code:'credentials'});
  await assert.rejects(store.register('bad-public-name','江泽月',TEST_PASSWORD,campus.spawnPoints[0]),{code:'displayName'});
  await assert.rejects(store.register('云风禾','云风禾',TEST_PASSWORD,campus.spawnPoints[0]),{code:'displayName'});
  await assert.rejects(store.register('bad user','晴风禾',TEST_PASSWORD,campus.spawnPoints[0]),{code:'username'});
  const privateOnly=await store.register('江泽月','晴风禾',TEST_PASSWORD,campus.spawnPoints[0]);assert.equal(privateOnly.displayName,'晴风禾');
  assert.equal((await readFile(path)).includes(Buffer.from(TEST_PASSWORD)),false);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
test('legacy migration preserves credentials, tokens, IDs, positions and records while separating public names; migration is idempotent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'westlake-legacy-')),path=join(dir,'accounts.sqlite');
 const legacy=createLegacyAccount(path,TEST_PASSWORD);let store=new AccountStore(path);
 try{
  const row=store.db.prepare('SELECT * FROM accounts').get()!;
  for(const [key,value]of Object.entries(legacy.before))assert.deepEqual(row[key],value,key);
  const account=await store.login(legacy.username,TEST_PASSWORD);assert.equal(account.id,legacy.id);assert.ok(isAllowedName(account.displayName));assert.notEqual(account.displayName,legacy.username);assert.equal(account.kills,7);assert.equal(account.deaths,4);assert.equal(account.x,3);assert.equal(account.z,2);assert.equal(store.resume(legacy.token).id,legacy.id);
  assert.equal(store.db.prepare('PRAGMA user_version').get()!.user_version,3);store.close();store=new AccountStore(path);
  assert.equal((await store.login(legacy.username,TEST_PASSWORD)).displayName,account.displayName);assert.equal(store.resume(legacy.token).id,legacy.id);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
test('real socket login: private usernames never enter public snapshots; duplicate sessions, reload and restart retain saves',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'westlake-login-')),path=join(dir,'accounts.sqlite'),sockets:Socket[]=[],broadcasts:Snapshot[]=[];
 const boot=async()=>{const http=createServer(),game=createGame(http,{databasePath:path});await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));return{game,url:`http://127.0.0.1:${(http.address() as any).port}`};};
 let server=await boot();
 async function request(payload:unknown){const s=io(server.url,{transports:['websocket'],reconnection:false});sockets.push(s);s.on('world',v=>broadcasts.push(v));const w=await new Promise<JoinReply>(r=>s.on('connect',()=>s.emit('join',payload,r)));return{s,w};}
 try{
  const username='private-owner-credential',otherUsername='private-observer-credential';
  const a=await request({mode:'register',username,displayName:'云风禾',password:TEST_PASSWORD,color:1});assert.ok(!('error' in a.w));const welcome=a.w as Welcome;assert.equal(welcome.username,username);
  const b=await request({mode:'register',username:otherUsername,displayName:'云风禾',password:TEST_PASSWORD,color:2});assert.ok(!('error' in b.w));assert.equal((b.w as Welcome).username,otherUsername);assert.equal(server.game.snapshot().count,2);assert.notEqual((b.w as Welcome).playerId,welcome.playerId);
  const duplicate=await request({mode:'register',username,displayName:'晴风禾',password:TEST_PASSWORD,color:2});assert.equal((duplicate.w as any).code,'duplicate');
  const wrong=await request({mode:'login',username,password:'incorrect-pass',color:2});assert.equal((wrong.w as any).code,'credentials');
  const another=await request({mode:'login',username,password:TEST_PASSWORD,color:2});assert.equal((another.w as any).code,'online');
  const byPublicName=await request({mode:'login',username:'云风禾',password:TEST_PASSWORD,color:2});assert.equal((byPublicName.w as any).code,'credentials');
  const spoof=await request({mode:'register',username,displayName:'晴风禾',password:TEST_PASSWORD,color:2,kills:10});assert.ok('error' in spoof.w);
  let seq=0;for(let i=0;i<7;i++){a.s.emit('input',{seq:++seq,x:1,z:0,run:false});await wait(100);}a.s.emit('input',{seq:++seq,x:0,z:0,run:false});await wait(70);
  const before={...server.game.snapshot().players.find(p=>p.id===welcome.playerId)!};assert.ok(before.x>welcome.snapshot.players[0].x+2);
  a.s.disconnect();await wait(50);const back=await request({mode:'resume',token:welcome.token,color:1});assert.equal((back.w as Welcome).playerId,welcome.playerId);assert.equal(server.game.snapshot().players.find(p=>p.id===welcome.playerId)!.x,before.x);
  for(const snapshot of[welcome.snapshot,(b.w as Welcome).snapshot,...broadcasts,server.game.snapshot()]){
   const wire=JSON.stringify(snapshot);assert.ok(!wire.includes(username)&&!wire.includes(otherUsername));
   for(const player of snapshot.players){assert.equal(player.name,'云风禾');for(const key of['username','password','password_hash','salt','token','token_hash'])assert.ok(!Object.hasOwn(player,key),key);}
  }
  for(const s of sockets)s.disconnect();await server.game.close();
  const store=new AccountStore(path);const account=await store.login(username,TEST_PASSWORD);store.save([{...account,kills:3,deaths:2}]);store.close();
  server=await boot();const restarted=await request({mode:'resume',token:welcome.token,color:1});assert.equal((restarted.w as Welcome).playerId,welcome.playerId);const restored=server.game.snapshot().players[0];assert.equal(restored.name,'云风禾');assert.equal(restored.x,before.x);assert.equal(restored.kills,3);assert.equal(restored.deaths,2);assert.equal(restored.hp,100);assert.equal(server.game.snapshot().count,1);
 }finally{for(const s of sockets)s.disconnect();await server.game.close();await rm(dir,{recursive:true,force:true});}
});
test('room accepts 128 independent accounts, rejects the 129th and frees a slot after leaving',async()=>{
 assert.equal(CONFIG.maxPlayers,128);
 const dir=await mkdtemp(join(tmpdir(),'westlake-capacity-')),path=join(dir,'accounts.sqlite'),tokens:string[]=[];
 const store=new AccountStore(path);
 try{for(let i=0;i<=128;i++){const account=await store.register('capacity_private_'+i,'云风禾',TEST_PASSWORD,campus.spawnPoints[0]);tokens.push(store.issueToken(account.id));}}finally{store.close();}
 const http=createServer(),game=createGame(http,{databasePath:path}),clients:Socket[]=[];await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`;
 async function enter(token:string,username?:string){const s=io(url,{transports:['websocket'],reconnection:false});clients.push(s);const w=await new Promise<JoinReply>(r=>s.on('connect',()=>s.emit('join',username?{mode:'login',username,password:TEST_PASSWORD,color:0}:{mode:'resume',token,color:0},r)));return{s,w};}
 try{
  for(const [i,token] of tokens.slice(0,128).entries()){const {w}=await enter(token,'capacity_private_'+i);assert.ok(!('error' in w),'all 128 players can log in behind the same source IP');}
  for(let seq=0;seq<10;seq++){for(const s of clients)s.emit('input',{seq,x:1,z:0,run:true});await wait(100);}
  assert.equal(game.snapshot().count,128);assert.ok(game.snapshot().players.every(p=>p.ack>=8));
  assert.equal(game.snapshot().count,128);assert.equal(new Set(game.snapshot().players.map(p=>p.id)).size,128);assert.ok(!JSON.stringify(game.snapshot()).includes('capacity_private_'));
  const denied=await enter(tokens[128]);assert.ok('error' in denied.w);assert.equal((denied.w as any).code,'full');
  clients[0].emit('leave');await wait(100);assert.equal(game.snapshot().count,127);
  const admitted=await enter(tokens[128]);assert.ok(!('error' in admitted.w));assert.equal(game.snapshot().count,128);
 }finally{for(const s of clients)s.disconnect();await game.close();await rm(dir,{recursive:true,force:true});}
});
