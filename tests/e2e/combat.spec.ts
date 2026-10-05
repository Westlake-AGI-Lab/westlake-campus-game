import {registerPage,loginPage} from '../account-helpers';
import {test,expect,type Page} from '@playwright/test';
const debug=(p:Page)=>p.evaluate(()=>(window as any).__campusDebug);
async function join(p:Page,_name:string,color=0){return registerPage(p,color);}
test('真实双页面拳击、血槽同步、四拳击倒、随机复活与头顶战绩',async({context},info)=>{
 const a=await context.newPage(),b=await context.newPage(),errors:string[]=[];
 for(const p of[a,b])p.on('pageerror',e=>errors.push(e.message));
 const aname=await join(a,'拳击玩家',0),bname=await join(b,'校园对手',2);await expect.poll(async()=>(await debug(a)).world.count).toBe(2);
 const aid=(await debug(a)).playerId,bid=(await debug(b)).playerId,before=(await debug(b)).local;
 await a.bringToFront();await a.locator('#world').click({position:{x:600,y:340}});await a.keyboard.down('KeyD');await a.waitForTimeout(700);await a.keyboard.up('KeyD');
 await expect.poll(async()=>{const d=await debug(a),target=d.world.players.find((p:any)=>p.id===bid);return Math.hypot(d.local.x-target.x,d.local.z-target.z);}).toBeLessThan(2.4);
 await a.keyboard.press('KeyJ');await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','75');
 await expect(a.locator('#attack-toggle')).toBeDisabled();await a.keyboard.press('KeyJ');await a.waitForTimeout(100);await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','75');
 const targetLabel=a.locator(`[data-player-id="${bid}"]`);await expect(targetLabel.locator('[role=progressbar]')).toHaveAttribute('aria-valuenow','75');await expect(targetLabel.locator('.combat-stats')).toHaveText('击倒 0 · 倒地 0');
 await a.screenshot({path:'reports/screenshots/combat-hit.png'});
 // All three input methods share the same cooldown and authoritative damage.
 await expect(a.locator('#attack-toggle')).toBeEnabled();await a.keyboard.press('Space');await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','50');
 await expect(a.locator('#attack-toggle')).toBeEnabled();await a.locator('#attack-toggle').click();await expect(a.locator('#attack-toggle')).toBeDisabled();await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','25');
 await expect(a.locator('#attack-toggle')).toBeEnabled();await a.keyboard.press('KeyJ');await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','100');
 await expect(a.locator('#my-kills')).toHaveText('1');await expect(b.locator('#my-deaths')).toHaveText('1');
 await expect(a.locator(`[data-player-id="${aid}"] .combat-stats`)).toHaveText('击倒 1 · 倒地 0');await expect(targetLabel.locator('.combat-stats')).toHaveText('击倒 0 · 倒地 1');
 await expect.poll(async()=>(await debug(a)).entities.find((e:any)=>e.id===aid).scale).toBeGreaterThan(1.05);
 await expect.poll(async()=>(await debug(a)).entities.find((e:any)=>e.id===bid).scale).toBeLessThan(.95);
 const after=(await debug(b)).local;expect(after.id).toBe(bid);expect(after.life).toBe(1);expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThanOrEqual(25);expect((await debug(a)).world.count).toBe(2);
 await b.bringToFront();await expect(b.locator('#combat-protection')).toBeVisible();await b.waitForTimeout(160);await b.screenshot({path:'reports/screenshots/combat-respawn.png'});expect(errors).toEqual([]);expect((await debug(a)).errors).toEqual([]);expect((await debug(b)).errors).toEqual([]);
 for(const file of['combat-hit','combat-respawn'])await info.attach(file,{path:`reports/screenshots/${file}.png`,contentType:'image/png'});
 await a.locator('#logout').click();await b.locator('#logout').click();await loginPage(a,aname);await loginPage(b,bname,2);await expect(a.locator('#my-kills')).toHaveText('1');await expect(b.locator('#my-deaths')).toHaveText('1');expect((await debug(a)).playerId).toBe(aid);expect((await debug(b)).playerId).toBe(bid);expect(Math.hypot((await debug(b)).local.x-after.x,(await debug(b)).local.z-after.z)).toBeLessThan(.1);await expect.poll(async()=>(await debug(b)).entities.find((e:any)=>e.id===bid).scale).toBeLessThan(.95);await a.close();await b.close();
});


test('真实双页面自动回血同步，出拳与受伤重置延迟，血量不超过上限',async({context})=>{
 const a=await context.newPage(),b=await context.newPage();
 await registerPage(a,0);await registerPage(b,2);const aid=(await debug(a)).playerId,bid=(await debug(b)).playerId;
 await expect(a.locator('#online')).toContainText('/ 128');
 await a.bringToFront();await a.locator('#world').click({position:{x:600,y:340}});await a.keyboard.down('KeyD');await a.waitForTimeout(700);await a.keyboard.up('KeyD');
 await a.keyboard.press('KeyJ');await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','75');
 await a.waitForTimeout(4500);await expect(b.locator('#my-health')).toHaveAttribute('aria-valuenow','75');
 await expect.poll(async()=>(await debug(b)).local.hp,{timeout:4000}).toBeGreaterThanOrEqual(77);
 await expect.poll(async()=>{const d=await debug(a);return d.world.players.find((p:any)=>p.id===bid).hp;}).toBe((await debug(b)).local.hp);
 // Turn away and miss. Even a missed outgoing punch pauses the injured player's regeneration.
 await b.bringToFront();await b.keyboard.down('KeyD');await b.waitForTimeout(100);await b.keyboard.up('KeyD');await b.keyboard.press('KeyJ');
 const hp=(await debug(b)).local.hp;await b.waitForTimeout(1800);expect((await debug(b)).local.hp).toBe(hp);
 await expect.poll(async()=>(await debug(b)).local.hp,{timeout:6000}).toBeGreaterThan(hp);
 expect((await debug(b)).local.hp).toBeLessThanOrEqual(100);expect((await debug(a)).world.players.find((p:any)=>p.id===aid).hp).toBe(100);
 await a.close();await b.close();
});
