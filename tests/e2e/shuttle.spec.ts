import {test,expect,type Page} from '@playwright/test';
import {registerPage} from '../account-helpers';
import {campus,blocked} from '../../shared/world';
import {shuttleContains} from '../../shared/shuttle';
const debug=(p:Page)=>p.evaluate(()=>(window as any).__campusDebug);
async function approach(page:Page,id:string){
 if(await page.locator('#map-panel').isHidden())await page.locator('#map-toggle').click();if(!((await page.locator('#map-panel').getAttribute('class'))||'').includes('expanded'))await page.locator('#map-expand').click();
 const d=await debug(page),bus=d.world.shuttles.find((b:any)=>b.id===id),ahead=bus.speed>0?10:0,point={x:bus.x+Math.sin(bus.yaw)*ahead+Math.cos(bus.yaw)*4,z:bus.z+Math.cos(bus.yaw)*ahead-Math.sin(bus.yaw)*4};
 // Stand just ahead of a moving bus: it yields to the waiting passenger before boarding.
 if(ahead){point.x=bus.x+Math.sin(bus.yaw)*10;point.z=bus.z+Math.cos(bus.yaw)*10;}
 const rect=(await page.locator('#map').boundingBox())!,b=campus.meta.bounds;
 await page.locator('#map').click({position:{x:(20+(point.x-b.minX)/(b.maxX-b.minX)*520)/560*rect.width,y:(20+(point.z-b.minZ)/(b.maxZ-b.minZ)*480)/520*rect.height}});
 const relocation=d.local.relocation;await page.locator('#airdrop').click();await expect.poll(async()=>(await debug(page)).local.relocation).toBeGreaterThan(relocation);await page.locator('#map-expand').click();await expect(page.locator('#shuttle-toggle')).toBeEnabled({timeout:25000});
}
test('校车固定环线、站点搜索、双页面同乘同步、行驶中安全下车与刷新存档',async({context})=>{
 test.setTimeout(90000);const a=await context.newPage(),b=await context.newPage(),errors:string[]=[];for(const p of[a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
 await registerPage(a);await registerPage(b);await expect.poll(async()=>(await debug(a)).world.shuttles.length).toBe(2);
 await a.locator('#destination-search').fill('校车站');await expect(a.locator('#building-results')).toContainText('南门校车站');await a.locator('#destination-search').fill('南门校车站');await a.locator('#destination-search').press('Enter');await expect(a.locator('#selected-place')).toContainText('南门校车站');await a.keyboard.press('Escape');
 await a.locator('#ambience-panel summary').click();await a.locator('#ambience-time').selectOption('13');await a.locator('#ambience-weather').selectOption('clear');await a.locator('#ambience-panel summary').click();
 const id='shuttle-1';await approach(a,id);await a.keyboard.press('KeyB');await expect.poll(async()=>(await debug(a)).local.shuttleId).toBe(id);await expect(a.locator('#vehicle-toggle')).toBeDisabled();await expect(a.locator('#attack-toggle')).toBeDisabled();await expect(a.locator('#airdrop')).toBeDisabled();await expect(a.locator('#home')).toBeDisabled();
 await approach(b,id);await b.locator('#shuttle-toggle').click();await expect.poll(async()=>(await debug(b)).local.shuttleId).toBe(id);await expect.poll(async()=>(await debug(a)).shuttles.find((v:any)=>v.id===id).visibleSeats).toBe(2);
 const before=(await debug(a)).local;await expect.poll(async()=>(await debug(a)).world.shuttles.find((v:any)=>v.id===id).speed,{timeout:20000}).toBeGreaterThan(0);await a.waitForTimeout(700);const after=(await debug(a)).local;expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThan(3);
 for(const p of[a,b]){const d=await debug(p),bus=d.world.shuttles.find((v:any)=>v.id===id);expect(Math.hypot(d.local.x-bus.x,d.local.z-bus.z)).toBeLessThan(.01);}
 await a.screenshot({path:'reports/screenshots/shuttle-riding.png'});await a.locator('#shuttle-locate').click();await a.waitForTimeout(250);await a.screenshot({path:'reports/screenshots/shuttle-exterior.png'});await a.keyboard.press('Escape');
 await a.locator('#shuttle-toggle').click();await expect.poll(async()=>(await debug(a)).local.shuttleId).toBeNull();const exited=(await debug(a)).local,bus=(await debug(a)).world.shuttles.find((v:any)=>v.id===id);expect(blocked(exited)).toBe(false);expect(shuttleContains(bus,exited)).toBe(false);await expect(a.locator('#attack-toggle')).toBeEnabled();await a.screenshot({path:'reports/screenshots/shuttle-exit.png'});
 await b.reload();await expect.poll(async()=>(await debug(b)).connected).toBe(true);expect((await debug(b)).local.shuttleId).toBeNull();await expect.poll(async()=>(await debug(a)).world.shuttles.find((v:any)=>v.id===id).passengerIds.length).toBe(0);
 await a.locator('#overview-toggle').click();await a.waitForTimeout(500);await a.locator('#map-expand').click();await a.screenshot({path:'reports/screenshots/shuttle-overview.png'});expect(errors).toEqual([]);await a.close();await b.close();
});
