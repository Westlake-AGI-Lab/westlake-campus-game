import {test,expect} from '@playwright/test';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {registerPage} from '../account-helpers';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('实际服务进程重启后两账号恢复同一角色与位置，无旧角色或假人数',async({context})=>{
 const dir=await mkdtemp(join(tmpdir(),'westlake-e2e-restart-'));
 const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=String((probe.address() as any).port);await new Promise<void>(r=>probe.close(()=>r()));let server:ChildProcess|undefined;const url='http://127.0.0.1:'+port;
 async function boot(){server=spawn(process.execPath,['dist-server/index.js'],{env:{...process.env,PORT:port,HOST:'127.0.0.1',ACCOUNT_DB:join(dir,'accounts.sqlite')},stdio:'pipe'});for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('server exited before ready');try{if((await fetch(url+'/health')).ok)return;}catch{}await sleep(100);}throw Error('restart server failed');}
 async function stop(){if(server&&server.exitCode===null){const exited=new Promise<void>(r=>server!.once('exit',()=>r()));server.kill('SIGTERM');await exited;}}
 const pages=[await context.newPage(),await context.newPage()];
 const debug=(p:typeof pages[number])=>p.evaluate(()=>(window as any).__campusDebug);
 try{await boot();for(const p of pages)await registerPage(p,0,url);await pages[0].locator('#world').click({position:{x:600,y:340}});await pages[0].keyboard.down('KeyD');await pages[0].waitForTimeout(600);await pages[0].keyboard.up('KeyD');await pages[0].waitForTimeout(150);
  const old=(await Promise.all(pages.map(debug))).map(d=>({...d.local}));await stop();await expect.poll(async()=>(await debug(pages[0])).connected).toBe(false);await expect(pages[0].locator('#online')).toHaveText('— 人在线');await boot();
  for(let i=0;i<pages.length;i++){const p=pages[i];await expect.poll(async()=>{const d=await debug(p);return d.connected&&d.world.count===2;},{timeout:12000}).toBe(true);const d=await debug(p);expect(d.playerId).toBe(old[i].id);expect(d.entities.length).toBe(2);expect(Math.hypot(d.local.x-old[i].x,d.local.z-old[i].z)).toBeLessThan(.1);}
 }finally{for(const p of pages)await p.close();await stop();await rm(dir,{recursive:true,force:true});}
});
