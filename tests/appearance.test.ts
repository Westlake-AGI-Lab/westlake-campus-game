import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {io,type Socket} from 'socket.io-client';
import {AccountStore} from '../server/accounts';
import {createGame} from '../server/game';
import {createLegacyAccount} from './legacy-account-fixture';
import {TEST_PASSWORD,registration} from './account-helpers';
import {defaultAppearance,validAppearance,copyAppearance,randomAppearance,decodeAppearance,type Appearance} from '../shared/appearance';
import type {Welcome,JoinReply} from '../shared/types';
const custom:Appearance={skin:4,hair:3,hairColor:5,outfit:2,coat:3,pants:2,accessory:1};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

test('appearance accepts only bounded palette fields and rejects malformed, arbitrary or gameplay-changing options',()=>{
 assert.ok(validAppearance(custom));assert.ok(validAppearance(defaultAppearance()));for(let i=0;i<50;i++)assert.ok(validAppearance(randomAppearance()));
 for(const value of[null,[],{}, {...custom,skin:-1},{...custom,hair:5},{...custom,hairColor:NaN},{...custom,outfit:1.2},{...custom,coat:6},{...custom,accessory:5},{...custom,scale:9},{...custom,texture:'https://example.com/private'}])assert.equal(validAppearance(value),false);
 const copy=copyAppearance(custom);copy.hair=0;assert.equal(custom.hair,3);assert.throws(()=>decodeAppearance('{broken'));assert.throws(()=>decodeAppearance(JSON.stringify({...custom,accessory:99})));
});
test('stored customization survives reopen, login, token, position updates and v2 migration preserves every old field',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'westlake-appearance-')),path=join(dir,'accounts.sqlite');let store=new AccountStore(path);
 try{
  const value={...custom},account=await store.register('custom-appearance','云风禾',TEST_PASSWORD,{x:3,z:2},value);value.skin=0;const token=store.issueToken(account.id);
  store.save([{...account,x:5,z:4,kills:7,deaths:3}]);store.close();store=new AccountStore(path);assert.deepEqual((await store.login('custom-appearance',TEST_PASSWORD)).appearance,custom);assert.deepEqual(store.resume(token).appearance,custom);assert.deepEqual(store.resolveAppearance(account.id,0),custom);assert.equal((await store.login('custom-appearance',TEST_PASSWORD)).kills,7);
  await assert.rejects(store.register('bad-appearance','云风禾',TEST_PASSWORD,{x:3,z:2},{...custom,scale:3}),e=>(e as any).code==='appearance');
  store.close();const legacyPath=join(dir,'v2.sqlite');const fixture=createLegacyAccount(legacyPath,TEST_PASSWORD);const oldDb=new DatabaseSync(legacyPath);oldDb.exec("ALTER TABLE accounts ADD COLUMN display_name TEXT NOT NULL DEFAULT '';UPDATE accounts SET display_name='晴风禾';PRAGMA user_version=2;");const before=oldDb.prepare('SELECT * FROM accounts').get()!;oldDb.close();
  store=new AccountStore(legacyPath);const migrated=store.db.prepare('SELECT * FROM accounts').get()!;for(const[k,v]of Object.entries(before))assert.deepEqual(migrated[k],v,k);assert.equal(migrated.appearance_json,null);assert.equal(store.db.prepare('PRAGMA user_version').get()!.user_version,3);
  assert.equal(store.resume(fixture.token).id,fixture.id);assert.deepEqual(store.resolveAppearance(fixture.id,2),defaultAppearance(2));assert.deepEqual(store.resolveAppearance(fixture.id,5),defaultAppearance(2));assert.equal((await store.login(fixture.username,TEST_PASSWORD)).displayName,'晴风禾');
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
test('real sockets synchronize customized avatars, reject forged edits and keep saved appearance through reconnect and restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'westlake-avatar-wire-')),path=join(dir,'accounts.sqlite'),clients:Socket[]=[];
 async function boot(){const http=createServer(),game=createGame(http,{databasePath:path});await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));return{game,url:`http://127.0.0.1:${(http.address() as any).port}`};}
 let server=await boot();
 async function request(payload:unknown){const s=io(server.url,{transports:['websocket'],reconnection:false});clients.push(s);const w=await new Promise<JoinReply>(r=>s.on('connect',()=>s.emit('join',payload,r)));return{s,w};}
 try{
  const auth={...registration(0),appearance:{...custom}},a=await request(auth);assert.ok(!('error' in a.w));const welcome=a.w as Welcome;
  const b=await request(registration(2));assert.ok(!('error' in b.w));assert.deepEqual((b.w as Welcome).snapshot.players.find(p=>p.id===welcome.playerId)!.appearance,custom);assert.equal(server.game.snapshot().players.find(p=>p.id===welcome.playerId)!.color,custom.coat);
  const snapshot=server.game.snapshot();snapshot.players[0].appearance!.hair=0;assert.equal(server.game.snapshot().players[0].appearance!.hair,3);
  const bad=await request({...registration(),appearance:{...custom,speed:99}});assert.equal((bad.w as any).code,'appearance');
  a.s.disconnect();await wait(70);const resumed=await request({mode:'resume',token:welcome.token,color:5});assert.ok(!('error' in resumed.w));assert.deepEqual((resumed.w as Welcome).snapshot.players.find(p=>p.id===welcome.playerId)!.appearance,custom);
  for(const s of clients)s.disconnect();await server.game.close();server=await boot();
  const loggedIn=await request({mode:'login',username:auth.username,password:TEST_PASSWORD,color:0});assert.ok(!('error' in loggedIn.w));assert.deepEqual((loggedIn.w as Welcome).snapshot.players[0].appearance,custom);assert.equal((loggedIn.w as Welcome).playerId,welcome.playerId);
  const spoof=await request({mode:'login',username:auth.username,password:TEST_PASSWORD,color:0,appearance:defaultAppearance()});assert.ok('error' in spoof.w);
 }finally{for(const s of clients)s.disconnect();await server.game.close();await rm(dir,{recursive:true,force:true});}
});
