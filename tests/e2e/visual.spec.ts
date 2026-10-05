import {registerPage,loginPage} from '../account-helpers';
import {test,expect} from '@playwright/test';
import {campus} from '../../shared/world';
test('完整校园渲染、全部可复现视角、回到起点与鼠标视角',async({page})=>{
 await registerPage(page);await page.waitForTimeout(1500);await page.screenshot({path:'reports/screenshots/ground-final.png'});
 const initial=await page.evaluate(()=>(window as any).__campusDebug);expect(initial.render.triangles).toBeGreaterThan(10000);expect(initial.dataObjects).toBe(campus.buildings.length);expect(initial.errors).toEqual([]);
 for(const v of campus.validationViews){await page.locator('#views-toggle').click();await page.locator(`[data-view-id=${v.id}]`).click();await page.waitForTimeout(700);await page.screenshot({path:`reports/screenshots/view-${v.id}.png`,style:'#hud,#labels{visibility:hidden!important}'});const camera=await page.evaluate(()=>(window as any).__campusDebug.camera);expect(camera.position).toEqual(v.position);}
 await page.keyboard.press('Escape');await page.locator('#world').click({position:{x:500,y:320}});await page.keyboard.down('KeyD');await page.waitForTimeout(800);await page.keyboard.up('KeyD');await page.locator('#home').click();await expect.poll(async()=>{const d=await page.evaluate(()=>(window as any).__campusDebug);return Math.hypot(d.local.x-campus.spawnPoints[0].x,d.local.z-campus.spawnPoints[0].z);}).toBeLessThan(.2);
 const before=await page.evaluate(()=>(window as any).__campusDebug.camera.position);await page.mouse.move(500,320);await page.mouse.down();await page.mouse.move(630,350,{steps:4});await page.mouse.up();const after=await page.evaluate(()=>(window as any).__campusDebug.camera.position);expect(after).not.toEqual(before);
});

test('滚轮缩到全校、地标与玩家位置、旋转和窄窗口适配、返回原漫游距离',async({page})=>{
 await registerPage(page);
 const before=await page.evaluate(()=>(window as any).__campusDebug);
 await page.mouse.move(650,360);for(let i=0;i<6;i++)await page.mouse.wheel(0,1000);
 await expect.poll(async()=>{const d=await page.evaluate(()=>(window as any).__campusDebug);return Math.abs(d.camera.distance-d.camera.zoomDistance);}).toBeLessThan(.5);
 async function checkFit(){const d=await page.evaluate(()=>(window as any).__campusDebug);for(const[x,y,z]of d.camera.campusCorners){expect(Math.abs(x)).toBeLessThan(.9);expect(Math.abs(y)).toBeLessThan(.9);expect(z).toBeLessThan(1);}expect(Math.hypot(d.local.x-before.local.x,d.local.z-before.local.z)).toBeLessThan(.1);await expect(page.locator('#player-pin')).toBeVisible();expect(await page.locator('.landmark-label:visible').count()).toBeGreaterThan(15);await expect(page.locator('[data-building-id=E10]')).toBeVisible();await expect(page.locator('[data-building-id=E6-E7]')).toBeVisible();}
 await checkFit();
 for(let n=1;n<=19;n++){const code='C'+n,b=campus.buildings.find(b=>b.codes?.includes(code))!;const label=page.locator(`[data-building-id="${b.id}"]`);await expect(label).toHaveText(code);await expect(label).toHaveAttribute('aria-label',new RegExp(code));}
 for(const code of Array.from({length:19},(_,i)=>'C'+(i+1))){const b=campus.buildings.find(b=>b.codes?.includes(code))!;await expect(page.locator(`[data-building-id="${b.id}"]`)).toBeVisible();}
 await page.screenshot({path:'reports/screenshots/campus-overview.png'});
 await page.mouse.move(600,350);await page.mouse.down();await page.mouse.move(710,350,{steps:6});await page.mouse.up();await page.mouse.wheel(0,1000);await page.waitForTimeout(1000);await checkFit();
 await page.setViewportSize({width:760,height:1000});await page.waitForTimeout(1000);await checkFit();await page.screenshot({path:'reports/screenshots/campus-overview-narrow.png'});
 await page.keyboard.press('KeyF');await expect.poll(async()=>{const d=await page.evaluate(()=>(window as any).__campusDebug);return d.camera.distance;}).toBeLessThan(100);await expect(page.locator('#player-pin')).toBeHidden();
 const restored=await page.evaluate(()=>(window as any).__campusDebug.camera);expect(restored.zoomDistance).toBeLessThan(100);
 await page.locator('#overview-toggle').click();await expect(page.locator('#player-pin')).toBeVisible();await page.keyboard.press('KeyF');
 await expect.poll(async()=>{const d=await page.evaluate(()=>(window as any).__campusDebug);return d.camera.distance;}).toBeLessThan(100);const returned=await page.evaluate(()=>(window as any).__campusDebug);expect(returned.camera.zoomDistance).toEqual(restored.zoomDistance);expect(returned.errors).toEqual([]);
});
