import {registerPage,loginPage,TEST_PASSWORD} from './account-test-utils.mjs';
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const url=process.env.DEPLOY_URL||'http://127.0.0.1:3000',origin=new URL(url).origin;
const verifyService=process.env.DEPLOY_VERIFY_SERVICE||'westlake-campus.service';
if(!/^[a-z0-9-]+\.service$/.test(verifyService))throw Error('Invalid service name');
const smokeOnly=process.env.DEPLOY_SMOKE_ONLY==='1';
if(smokeOnly&&process.env.DEPLOY_VERIFY_RESTART==='1')throw Error('Production smoke check must not restart the service');
const manifest=JSON.parse(await readFile('deployment/release.json','utf8'));
const appVersion=JSON.parse(await readFile('package.json','utf8')).version;expect(manifest.appVersion).toBe(appVersion);
const versionHealth=await(await fetch(url+'/health')).json();expect(versionHealth.version).toBe(appVersion);
const ssh=command=>{const host=process.env.DEPLOY_SSH_HOST;if(!host||host.startsWith('-')||!/^[a-zA-Z0-9_.@:-]+$/.test(host))throw Error('Set DEPLOY_SSH_HOST to the authorized test/deployment host');return execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','-o','ServerAliveInterval=5','-o','ServerAliveCountMax=2',host,command],{encoding:'utf8',timeout:15000}).trim();};
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const a=await context.newPage(),b=await context.newPage(),errors=[],external=[],checks=[];
const debug=p=>p.evaluate(()=>window.__campusDebug);
for(const p of[a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(r.url());});}
async function join(p,_name,color){return registerPage(p,url,color);}
try{
 for(const [file,hash] of Object.entries(manifest.files).filter(([p])=>p.startsWith('dist/'))){const response=await fetch(url+'/'+file.slice(5));if(!response.ok)throw Error(file+' HTTP '+response.status);const actual=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');expect(actual).toBe(hash);}
 checks.push('All served production assets match the local release SHA-256 manifest');
 if(smokeOnly){
  await a.goto(url);await expect(a.locator('#app-version')).toHaveText('v'+appVersion);await expect(a.locator('#auth-login')).toBeVisible();await expect(a.locator('#password')).toHaveAttribute('type','password');await a.locator('#auth-register').click();await expect(a.locator('#display-name')).toHaveAttribute('readonly','');for(let i=0;i<3;i++)expect(await a.locator('#name-part-'+i+' option').count()).toBe(24);await a.screenshot({path:'reports/screenshots/server-account-entry.png'});
  const health=await(await fetch(url+'/health')).json();expect(health.status).toBe('ok');const isolated=JSON.parse(await readFile('reports/deployment-testroom-results.json','utf8'));expect(isolated.status).toBe('PASS');
  const facts=ssh(`systemctl --user show ${verifyService} -p ActiveState -p MainPID -p Restart -p NRestarts; systemctl --user is-enabled ${verifyService}; loginctl show-user user -p Linger`);expect(facts).toContain('ActiveState=active');expect(facts).toContain('enabled');expect(facts).toContain('Linger=yes');expect(errors).toEqual([]);expect(external).toEqual([]);
  const result={status:'PASS',testedAt:new Date().toISOString(),url,scope:'Production assets, private-username/public-display-name/password registration UI and health. Full account/combat/navigation/airdrop/restart tests ran on the same release in the isolated room.',release:manifest.release,checks:[...checks,'Production register/login UI exposes private username, 3 public candidate selectors and a password field'],health,productionServiceFacts:facts,isolatedAccountVerification:isolated,manifest};await writeFile(process.env.DEPLOY_REPORT||'reports/deployment-results.json',JSON.stringify(result,null,2));console.log('Production registration UI, release hashes and service: PASS');
 }else{
 const authA=await join(a,'部署验证 A',0),authB=await join(b,'部署验证 B',2);await expect(a.locator('#app-version')).toHaveText('v'+appVersion);await expect(b.locator('#app-version')).toHaveText('v'+appVersion);checks.push('Package, release manifest, browser badge and server health versions match');
 const c=await context.newPage();await c.goto(url);await c.locator('#auth-register').click();await c.locator('#username').fill(authA.username);for(let i=0;i<3;i++)await c.locator('#name-part-'+i).selectOption(authA.displayName[i]);await c.locator('#password').fill(TEST_PASSWORD);await c.locator('#enter-campus').click();await expect(c.locator('#entry-error')).toContainText('已注册');await c.locator('#auth-login').click();await c.locator('#username').fill(authA.username);await c.locator('#password').fill('incorrect-pass');await c.locator('#enter-campus').click();await expect(c.locator('#entry-error')).toContainText('密码');await c.locator('#password').fill(TEST_PASSWORD);await c.locator('#enter-campus').click();await expect(c.locator('#entry-error')).toContainText('在线');await c.close();checks.push('Private-username and public-name registration, duplicate rejection, wrong password and one online character per account');
 const aid=(await debug(a)).playerId,bid=(await debug(b)).playerId,before=(await debug(b)).local;
 for(const page of[a,b]){const d=await debug(page);expect(d.world.players.find(p=>p.id===aid).name).toBe(authA.displayName);for(const username of[authA.username,authB.username])expect(JSON.stringify(d.world)).not.toContain(username);await expect(page.locator('#online')).toContainText('/ 128');}
 checks.push('Public snapshots contain only display names; private usernames are absent; HUD shows the 128-player limit');
 await expect.poll(async()=>{const d=await debug(a);return [aid,bid].every(id=>d.world.players.some(p=>p.id===id));}).toBe(true);
 if(!smokeOnly)expect((await debug(a)).world.count).toBe(2);
 expect(aid).not.toBe(bid);expect((await debug(a)).dataObjects).toBe(81);
 const beforeA=(await debug(a)).local;
 await a.bringToFront();await a.locator('#world').click({position:{x:600,y:340}});await a.keyboard.down('KeyD');await a.waitForTimeout(700);await a.keyboard.up('KeyD');
 if(!smokeOnly){
 await expect.poll(async()=>{const d=await debug(a),p=d.world.players.find(p=>p.id===bid);return Math.hypot(d.local.x-p.x,d.local.z-p.z);}).toBeLessThan(2.4);
 await a.keyboard.press('KeyJ');await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','75');await expect(a.locator(`[data-player-id="${bid}"] [role=progressbar]`)).toHaveAttribute('aria-valuenow','75');
 await a.screenshot({path:'reports/screenshots/server-combat-hit.png'});
 await expect(a.locator('#attack-toggle')).toBeEnabled();await a.keyboard.press('Space');await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','50');
 await expect(a.locator('#attack-toggle')).toBeEnabled();await a.locator('#attack-toggle').click();await expect(a.locator('#attack-toggle')).toBeDisabled();await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','25');
 await expect(a.locator('#attack-toggle')).toBeEnabled();await a.keyboard.press('KeyJ');await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','100');await expect(a.locator('#my-kills')).toHaveText('1');await expect(b.locator('#my-deaths')).toHaveText('1');
 await expect(a.locator(`[data-player-id="${aid}"] .combat-stats`)).toHaveText('击倒 1 · 倒地 0');await expect(a.locator(`[data-player-id="${bid}"] .combat-stats`)).toHaveText('击倒 0 · 倒地 1');
 await expect.poll(async()=>(await debug(a)).entities.find(e=>e.id===aid).scale).toBeGreaterThan(1.05);await expect.poll(async()=>(await debug(a)).entities.find(e=>e.id===bid).scale).toBeLessThan(.95);checks.push('Knockout enlarges the attacker to 106% and shrinks the victim to 94% in actual rendered entities');
 const after=(await debug(b)).local;expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThanOrEqual(25);expect(after.id).toBe(bid);expect(after.life).toBe(1);
 await b.bringToFront();await expect(b.locator('#combat-protection')).toBeVisible();await b.waitForTimeout(160);await b.screenshot({path:'reports/screenshots/server-respawn.png'});
 checks.push('Two real Chrome pages: independent IDs, movement, J / Space / button punching, health, knockout, random full-health respawn and overhead stats');
 }else{
  await expect.poll(async()=>{const p=(await debug(b)).world.players.find(p=>p.id===aid);return Math.hypot(p.x-beforeA.x,p.z-beforeA.z);}).toBeGreaterThan(1);
  await a.screenshot({path:'reports/screenshots/server-production.png'});checks.push('Production room: two independent Chrome players joined alongside existing players and observed authoritative movement');
 }
 await a.locator('#logout').click();await b.locator('#logout').click();await loginPage(a,authA);await loginPage(b,authB);await expect(a.locator('#my-kills')).toHaveText('1');await expect(b.locator('#my-deaths')).toHaveText('1');expect((await debug(a)).playerId).toBe(aid);expect((await debug(b)).playerId).toBe(bid);checks.push('Password login after logout retains IDs, kill and death records');
 await a.bringToFront();await a.locator('#overview-toggle').click();await a.waitForFunction(()=>{const d=window.__campusDebug;return d.camera.overview&&d.camera.campusCorners.every(p=>Math.abs(p[0])<.9&&Math.abs(p[1])<.9);});await expect(a.locator('#player-pin')).toBeVisible();await a.screenshot({path:'reports/screenshots/server-overview.png'});checks.push('Full campus overview contains all four bounds and player position');

 const beforeSearch=(await debug(a)).local;
 for(const [query,id]of Object.entries({C1:'res-21',C2:'res-25',C3:'res-26',F1:'res-10',F2:'res-12',F3:'res-11',E12:'library'})){
  await a.locator('#destination-search').fill(query);await expect(a.locator('#building-results button')).toHaveCount(1);await a.locator('#destination-search').press('Enter');expect((await debug(a)).camera.target).toBe('building:'+id);expect((await debug(a)).navigation.focusObjects).toBeGreaterThan(0);await expect(a.locator('#building-pin')).toBeVisible();expect(Math.hypot((await debug(a)).local.x-beforeSearch.x,(await debug(a)).local.z-beforeSearch.z)).toBeLessThan(.1);
 }
 await a.screenshot({path:'reports/screenshots/server-building-search.png'});await a.locator('#return-building').click();await expect(a.locator('#building-pin')).toBeHidden();await a.locator('#destination-search').fill('F18');await expect(a.locator('#search-status')).toContainText('没有找到');await a.locator('#destination-search').fill('图书馆');await a.locator('#destination-search').press('Enter');await expect(a.locator('#selected-place')).toHaveText('图书中心（E12）');
 checks.push('C1/C2/C3/F1/F2/F3 exact building-code search, E12 and library synonym, one-step camera focus and 3D highlight without moving the player, return and rejected old F18 alias');
 await a.locator('#navigate').click();await expect.poll(async()=>(await debug(a)).navigation.path.length,{timeout:10000}).toBeGreaterThan(1);expect((await debug(a)).navigation.sceneObjects).toBe(2);await a.locator('#map-expand').click();await expect(a.locator('#navigation-controls')).toBeInViewport();await expect(a.locator('#navigation-distance')).toBeInViewport();await a.screenshot({path:'reports/screenshots/server-navigation.png'});await a.locator('#map-expand').click();
 const statsBefore=(await debug(a)).local;await a.locator('#airdrop').click();await expect.poll(async()=>(await debug(a)).local.relocation).toBeGreaterThan(statsBefore.relocation);await expect.poll(async()=>(await debug(a)).navigation.active).toBeUndefined();await expect(a.locator('#navigation-note')).toContainText('已到达');const landed=(await debug(a)).local;expect(landed.hp).toBe(statsBefore.hp);expect(landed.kills).toBe(statsBefore.kills);expect(landed.deaths).toBe(statsBefore.deaths);await expect.poll(async()=>{const p=(await debug(b)).world.players.find(p=>p.id===aid);return Math.hypot(p.x-landed.x,p.z-landed.z);}).toBeLessThan(.1);await a.screenshot({path:'reports/screenshots/server-airdrop.png'});await a.locator('#logout').click();await loginPage(a,authA);expect(Math.hypot((await debug(a)).local.x-landed.x,(await debug(a)).local.z-landed.z)).toBeLessThan(.1);
 checks.push('Map destination search, walkable 3D/map route, expanded controls, safe airdrop, arrival, two-page position sync and saved position after password login; health and records unchanged');
 let serviceRecovery={status:'NOT_RUN'};
 if(process.env.DEPLOY_VERIFY_RESTART==='1'){
  const beforePid=ssh(`systemctl --user show ${verifyService} -p MainPID --value`);
  const saved=(await Promise.all([debug(a),debug(b)])).map(d=>({...d.local}));
  ssh(`systemctl --user kill --signal=SIGTERM --kill-who=main ${verifyService}`);
  await expect.poll(async()=>(await debug(a)).connected).toBe(false);
  for(const [p,id] of[[a,aid],[b,bid]])await expect.poll(async()=>{const d=await debug(p);return d.connected&&d.playerId===id;},{timeout:20000}).toBe(true);
  await expect.poll(async()=>(await debug(a)).world.count).toBe(2);await expect.poll(async()=>(await debug(b)).world.count).toBe(2);
  for(const [i,p]of[a,b].entries()){const restored=(await debug(p)).local;expect(restored.id).toBe(saved[i].id);expect(Math.hypot(restored.x-saved[i].x,restored.z-saved[i].z)).toBeLessThan(.1);expect(restored.kills).toBe(saved[i].kills);expect(restored.deaths).toBe(saved[i].deaths);expect(restored.hp).toBe(100);}
  const afterPid=ssh(`systemctl --user show ${verifyService} -p MainPID --value`),facts=ssh(`systemctl --user show ${verifyService} -p ActiveState -p SubState -p Restart -p NRestarts; systemctl --user is-enabled ${verifyService}; loginctl show-user user -p Linger`);
  expect(afterPid).not.toBe(beforePid);expect(facts).toContain('ActiveState=active');expect(facts).toContain('Restart=always');expect(facts).toContain('Linger=yes');
  serviceRecovery={status:'PASS',beforePid:Number(beforePid),afterPid:Number(afterPid),facts};await a.screenshot({path:'reports/screenshots/server-recovered.png'});checks.push('systemd automatically restarted the terminated game process; both pages restored the same account IDs, saved positions and kill/death counts without duplicate players');
 }
 expect(errors).toEqual([]);expect(external).toEqual([]);for(const p of[a,b])expect((await debug(p)).errors).toEqual([]);
 const health=await(await fetch(url+'/health')).json();expect(health.status).toBe('ok');if(smokeOnly)expect(health.online).toBeGreaterThanOrEqual(2);else expect(health.online).toBe(2);
 const result={status:'PASS',testedAt:new Date().toISOString(),url,scope:smokeOnly?'Production room connection, movement and overview; combat and automatic recovery checked in isolated room':'Isolated account/combat/navigation/airdrop and automatic recovery check',release:manifest.release,node:'24.10.0',directory:process.env.DEPLOY_REMOTE_ROOT||'~/apps/westlake-campus/current',service:verifyService,checks,serviceRecovery,errors,external,health,manifest};
 if(smokeOnly){result.productionServiceFacts=ssh(`systemctl --user show ${verifyService} -p ActiveState -p MainPID -p Restart -p NRestarts; systemctl --user is-enabled ${verifyService}; loginctl show-user user -p Linger`);expect(result.productionServiceFacts).toContain('ActiveState=active');expect(result.productionServiceFacts).toContain('enabled');expect(result.productionServiceFacts).toContain('Linger=yes');result.isolatedCombatVerification=JSON.parse(await readFile('reports/deployment-testroom-results.json','utf8'));}
 await writeFile(process.env.DEPLOY_REPORT||'reports/deployment-results.json',JSON.stringify(result,null,2));console.log('Isolated registration, login, combat, saved stats and automatic process recovery: PASS');
 }
}finally{await browser.close();}
