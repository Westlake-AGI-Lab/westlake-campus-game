import {CONFIG} from '../../shared/config';
import {registerPage,loginPage} from '../account-helpers';
import {test,expect,type Page} from '@playwright/test';
const debug=(p:Page)=>p.evaluate(()=>(window as any).__campusDebug);
async function join(p:Page,_name:string,color=0){return registerPage(p,color);}
test('同一浏览器三账号独立身份、真实移动、气泡、后加入快照和刷新恢复',async({context},info)=>{
 const a=await context.newPage(),b=await context.newPage();await join(a,'同路人',0);await join(b,'同路人',2);
 await expect.poll(async()=>(await debug(a)).world.count).toBe(2);
 const aid=(await debug(a)).playerId,bid=(await debug(b)).playerId;expect(aid).not.toBe(bid);
 const before=(await debug(a)).local;await a.bringToFront();await a.locator('#world').click({position:{x:600,y:340}});await a.keyboard.down('KeyW');await a.waitForTimeout(1200);await a.keyboard.up('KeyW');
 await expect.poll(async()=>{const s=await debug(b);return Math.hypot(s.world.players.find((p:any)=>p.id===aid).x-before.x,s.world.players.find((p:any)=>p.id===aid).z-before.z);}).toBeGreaterThan(2);
 const c=await context.newPage();await join(c,'新访客',1);await expect.poll(async()=>(await debug(c)).world.count).toBe(3);const cid=(await debug(c)).playerId;expect(new Set([aid,bid,cid]).size).toBe(3);
 for(const p of[a,b,c])await expect.poll(async()=>(await debug(p)).world.count).toBe(3);
 expect((await debug(c)).world.players.find((p:any)=>p.id===bid).color).toBe(2);
 await a.locator('#chat-toggle').click();await a.locator('[data-message-id=wave]').click();await expect.poll(async()=>(await debug(c)).bubbles.length).toBe(1);await expect(c.locator('.bubble').filter({hasText:'👋'})).toBeVisible();
 await a.bringToFront();await a.screenshot({path:'reports/screenshots/multiplayer.png'});await c.waitForTimeout(3200);expect((await debug(c)).bubbles.length).toBe(0);
 await b.close();await expect.poll(async()=>(await debug(c)).world.count,{timeout:2000}).toBe(2);await c.reload();await expect(c.locator('#entry')).toBeHidden();await expect.poll(async()=>(await debug(c)).connected).toBe(true);expect((await debug(c)).playerId).toBe(cid);await expect.poll(async()=>(await debug(c)).world.count).toBe(2);
 const other=await context.browser()!.newContext();const d=await other.newPage();await join(d,'另一浏览器',4);await expect.poll(async()=>(await debug(a)).world.count).toBe(3);await other.close();
 await info.attach('真实联机视角',{path:'reports/screenshots/multiplayer.png',contentType:'image/png'});
 await a.close();await c.close();
});
test('断网恢复原角色、清理失焦输入、只访问 localhost',async({context})=>{
 const p=await context.newPage();const external:string[]=[];await context.route('**/*',r=>{const u=new URL(r.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)){external.push(u.href);r.abort();}else r.continue();});await join(p,'恢复测试');const id=(await debug(p)).playerId;
 await p.locator('#world').click({position:{x:600,y:340}});await p.keyboard.down('KeyW');await p.waitForTimeout(400);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(600);const stopped=(await debug(p)).local;await p.waitForTimeout(500);expect(Math.hypot((await debug(p)).local.x-stopped.x,(await debug(p)).local.z-stopped.z)).toBeLessThan(.3);await p.keyboard.up('KeyW');
 await context.setOffline(true);await expect.poll(async()=>(await debug(p)).connected,{timeout:CONFIG.pingInterval+CONFIG.pingTimeout+3000}).toBe(false);await context.setOffline(false);await expect.poll(async()=>(await debug(p)).connected,{timeout:10000}).toBe(true);expect((await debug(p)).playerId).toBe(id);expect((await debug(p)).world.count).toBe(1);expect(external).toEqual([]);expect((await debug(p)).errors).toEqual([]);await p.close();
});
