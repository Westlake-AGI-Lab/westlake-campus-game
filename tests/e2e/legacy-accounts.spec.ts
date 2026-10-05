import {test,expect} from '@playwright/test';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLegacyAccount} from '../legacy-account-fixture';
import {TEST_PASSWORD} from '../account-helpers';

test('旧账号和旧浏览器会话自动升级，原用户名与密码可登录且公开名字不再泄露登录名',async({browser})=>{
 const dir=await mkdtemp(join(tmpdir(),'westlake-legacy-browser-')),path=join(dir,'accounts.sqlite');
 const legacy=createLegacyAccount(path,TEST_PASSWORD),probe=createServer();
 await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=String((probe.address() as any).port);await new Promise<void>(r=>probe.close(()=>r()));
 const url='http://127.0.0.1:'+port;let server:ChildProcess|undefined;
 const context=await browser.newContext();
 await context.addInitScript(({token,name})=>{
  if(!sessionStorage.getItem('legacy-fixture-initialized')){
   sessionStorage.setItem('westlake-account-session',JSON.stringify({token,name,color:0}));sessionStorage.setItem('legacy-fixture-initialized','yes');
  }
 },{token:legacy.token,name:legacy.username});
 const page=await context.newPage(),debug=()=>page.evaluate(()=>(window as any).__campusDebug);
 try{
  server=spawn(process.execPath,['dist-server/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:port,ACCOUNT_DB:path},stdio:'pipe'});
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Legacy test server exited');try{if((await fetch(url+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}expect(ready).toBe(true);
  await page.goto(url);await expect(page.locator('#entry')).toBeHidden();await expect.poll(async()=>(await debug()).connected).toBe(true);
  const first=await debug();expect(first.playerId).toBe(legacy.id);expect(first.local.name).not.toBe(legacy.username);expect(first.local.name).toHaveLength(3);expect(first.local.x).toBe(3);expect(first.local.z).toBe(2);expect(first.local.kills).toBe(7);expect(first.local.deaths).toBe(4);expect(JSON.stringify(first.world)).not.toContain(legacy.username);
  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('westlake-account-session')!));expect(saved.username).toBe(legacy.username);expect(saved.displayName).toBe(first.local.name);expect(saved).not.toHaveProperty('name');
  await page.locator('#logout').click();await page.locator('#username').fill(legacy.username);await page.locator('#password').fill(TEST_PASSWORD);await page.locator('#enter-campus').click();await expect(page.locator('#entry')).toBeHidden();
  const again=await debug();expect(again.playerId).toBe(legacy.id);expect(again.local.name).toBe(first.local.name);expect(again.local.kills).toBe(7);expect(again.local.deaths).toBe(4);expect(again.errors).toEqual([]);
 }finally{
  await context.close();if(server&&server.exitCode===null){const done=new Promise<void>(r=>server!.once('exit',()=>r()));server.kill('SIGTERM');await done;}await rm(dir,{recursive:true,force:true});
 }
});
