import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {AccountStore} from '../server/accounts';
test('historical boards persist offline records, use competition ranks, paginate and only expose public fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'campus-board-')),path=join(dir,'accounts.sqlite');let store=new AccountStore(path);
 try{
  const a=await store.register('private-board-owner','云风禾','test-password',{x:0,z:0}),b=await store.register('private-board-friend','云风禾','test-password',{x:0,z:0});
  store.save([{...a,kills:9,deaths:2},{...b,kills:9,deaths:5}]);
  const insert=store.db.prepare('INSERT INTO accounts(id,name,display_name,salt,password_hash,x,z,kills,deaths,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(let i=0;i<22;i++)insert.run('fixture-'+i,'private-fixture-'+i,'晴风禾','test-salt','test-hash',0,0,8,0,0);
  const zero=await store.register('private-board-zero','晴风禾','test-password',{x:0,z:0});store.close();store=new AccountStore(path);
  const first=store.leaderboard('kills',0,a.id);assert.equal(first.total,24);assert.equal(first.rows.length,20);assert.deepEqual(first.rows.slice(0,3).map(r=>r.rank),[1,1,3]);assert.equal(first.me.rank,1);
  const last=store.leaderboard('kills',999,a.id);assert.equal(last.page,1);assert.equal(last.rows.length,4);assert.equal(new Set([...first.rows,...last.rows].map(r=>r.id)).size,24);
  const deaths=store.leaderboard('deaths',0,a.id);assert.equal(deaths.rows[0].id,b.id);assert.equal(deaths.me.rank,2);assert.equal(store.leaderboard('kills',0,zero.id).me.rank,null);
  assert.deepEqual(Object.keys(first.rows[0]).sort(),['deaths','id','kills','name','rank']);assert.ok(!JSON.stringify(first).includes('private-'));assert.equal(store.db.prepare('PRAGMA user_version').get()!.user_version,3);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
import {createServer} from 'node:http';import {io} from 'socket.io-client';import {createGame} from '../server/game';
test('socket board requires login, validates pagination, includes offline records and never accepts client scores',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'campus-board-socket-')),path=join(dir,'accounts.sqlite'),store=new AccountStore(path);
 const a=await store.register('private-socket-owner','云风禾','test-password',{x:0,z:0}),b=await store.register('private-offline-friend','晴风禾','test-password',{x:0,z:0});store.save([{...a,kills:2,deaths:3},{...b,kills:7,deaths:1}]);store.close();
 const http=createServer(),game=createGame(http,{databasePath:path});await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const socket=io(`http://127.0.0.1:${(http.address() as any).port}`,{transports:['websocket'],reconnection:false});const request=(event:string,v:unknown)=>new Promise<any>(r=>socket.emit(event,v,r));
 try{await new Promise<void>(r=>socket.on('connect',r));assert.equal((await request('leaderboard',{kind:'kills',page:0})).ok,false);await request('join',{mode:'login',username:'private-socket-owner',password:'test-password',color:0});
  for(const v of [{kind:'name',page:0},{kind:'kills',page:-1},{kind:'kills',page:1.2},null])assert.equal((await request('leaderboard',v)).ok,false);
  const reply=await request('leaderboard',{kind:'kills',page:0,kills:999});assert.equal(reply.ok,true);assert.equal(reply.board.rows[0].id,b.id);assert.equal(reply.board.me.kills,2);assert.equal(reply.board.me.rank,2);assert.ok(!JSON.stringify(reply).includes('private-'));
 }finally{socket.disconnect();await game.close();await rm(dir,{recursive:true,force:true});}
});
