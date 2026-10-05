import {registerPage,registration} from './account-test-utils.mjs';
import {chromium} from '@playwright/test';
import {io} from 'socket.io-client';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const port='3012',url='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['dist-server/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:port,ACCOUNT_DB:':memory:'},stdio:'ignore'});
let browser;const bots=[],attackIntervals=[];let punchesSent=0;
try{
 for(let i=0;i<100;i++){try{if((await fetch(url+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:false});
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>{const host=new URL(r.request().url()).hostname;if(!['localhost','127.0.0.1'].includes(host)){external.push(r.request().url());r.abort();}else r.continue();});
 await registerPage(page,url);await page.bringToFront();await page.locator('#navigation-open').click();await page.locator('#destination').selectOption('library');await page.locator('#navigate').click();await page.waitForFunction(()=>window.__campusDebug.navigation.path.length>1);await page.locator('#navigation-open').click();
 for(let i=0;i<9;i++){const socket=io(url,{transports:['websocket'],reconnection:false});bots.push(socket);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('bot join timeout')),5000);socket.on('connect',()=>socket.emit('join',registration(i%6),()=>{clearTimeout(timer);resolve();}));});let seq=0;attackIntervals.push(setInterval(()=>{socket.emit('attack',{seq:++seq,yaw:Math.PI});punchesSent++;},700));}
 const gpu=await page.evaluate(()=>{const gl=document.querySelector('#world').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 const hardware={cpu:execFileSync('sysctl',['-n','machdep.cpu.brand_string']).toString().trim(),os:execFileSync('sw_vers',['-productVersion']).toString().trim(),browser:browser.version(),gpu};
 const samples=[],start=Date.now();
 for(const mode of['ground','overview']){
  if(mode==='overview')await page.locator('#overview-toggle').click();
  for(let j=0;j<3;j++){
   if(mode==='ground'){await page.keyboard.down(j%2?'KeyS':'KeyW');await page.waitForTimeout(1200);await page.keyboard.up(j%2?'KeyS':'KeyW');}
   await page.waitForTimeout(mode==='ground'?8800:10000);
   const d=await page.evaluate(()=>window.__campusDebug),frames=d.frames.slice(-600).sort((a,b)=>a-b);
   const sample={mode,elapsedMs:Date.now()-start,medianFps:1000/frames[Math.floor(frames.length/2)],p95FrameMs:frames[Math.floor(frames.length*.95)],slowFramesOver33ms:frames.filter(v=>v>33.34).length,drawCalls:d.render.calls,triangles:d.render.triangles,online:d.world.count,entities:d.entities.length};samples.push(sample);console.log(sample);
  }
 }
 await page.screenshot({path:'reports/screenshots/update-performance.png'});
 const result={status:!errors.length&&!external.length&&samples.every(s=>s.online===10&&s.medianFps>=30)?'PASS':'FAIL',testedAt:new Date().toISOString(),durationMs:Date.now()-start,scope:'Targeted current-version verification: 30 seconds walking plus 30 seconds full-campus overview; one foreground Chrome page with active route and map plus nine protocol clients punching every 700 ms. Previous 15-minute results are historical baseline.',hardware,samples,errors,external,punchesSent};
 result.clientSha256=createHash('sha256').update(await readFile('dist/index.html')).digest('hex');
 result.serverSha256=createHash('sha256').update(await readFile('dist-server/index.js')).digest('hex');
 result.modelSha256=createHash('sha256').update(await readFile('data/campus.json')).digest('hex');
 await writeFile('reports/update-performance-results.json',JSON.stringify(result,null,2));console.log(result.status);
 if(result.status!=='PASS')process.exitCode=1;
}finally{for(const timer of attackIntervals)clearInterval(timer);for(const b of bots){b.emit('leave');b.disconnect();}if(browser)await browser.close();server.kill('SIGTERM');}
