import {spawn} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {registerPage} from './account-test-utils.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const server=spawn(process.execPath,['dist-server/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:'3016',ACCOUNT_DB:':memory:'},stdio:'ignore'});
let browser;const errors=[];
try{
 const url='http://127.0.0.1:3016';let ready=false;for(let n=0;n<100;n++){try{if((await fetch(url+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Isolated art server did not start');
 browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:1600,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await registerPage(page,url,2);
 await mkdir('reports/screenshots',{recursive:true});const metrics={};
 for(const id of['aerial','loop','water','hall']){await page.locator('#views-toggle').click();await page.locator(`[data-view-id="${id}"]`).click();await page.waitForTimeout(500);await page.screenshot({path:`reports/screenshots/art-${id}.png`,style:'#hud,#labels{visibility:hidden!important}'});metrics[id]=await page.evaluate(()=>window.__campusDebug.render);}
 await page.locator('#home').click();await page.waitForTimeout(300);await page.screenshot({path:'reports/screenshots/art-player.png'});
 await expect(page.locator('#entry')).toBeHidden();if(errors.length)throw Error(JSON.stringify(errors));await writeFile('reports/art-verification.json',JSON.stringify({status:'PASS',version:'1.4.0',checkedAt:new Date().toISOString(),errors,metrics},null,2));console.log(JSON.stringify({status:'PASS',errors,metrics}));
}finally{await browser?.close();if(server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}}
