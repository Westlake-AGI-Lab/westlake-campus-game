import {test,expect,type Page} from '@playwright/test';
import {registerPage} from '../account-helpers';
import {blocked} from '../../shared/world';
const debug=(p:Page)=>p.evaluate(()=>(window as any).__campusDebug);

test('楼号与楼名一键定位、高亮、键盘搜索、无结果、返回以及导航空降',async({page},info)=>{
 await registerPage(page);await expect(page.locator('#destination-search')).toBeVisible();const before=(await debug(page)).local,camera=(await debug(page)).camera;
 for(const [query,id]of Object.entries({C1:'res-21',C2:'res-25',C3:'res-26',F1:'res-10',F2:'res-12',F3:'res-11',F6:'map-F6',F7:'map-F7'})){
  await page.locator('#destination-search').fill(query);await expect(page.locator('#building-results button')).toHaveCount(1);await expect(page.locator('#building-results button')).toContainText(query);await page.locator('#building-results button').click();await expect.poll(async()=>(await debug(page)).camera.target).toBe('building:'+id);await expect(page.locator('#building-pin')).toBeVisible();expect((await debug(page)).navigation.focusObjects).toBeGreaterThan(0);expect(Math.hypot((await debug(page)).local.x-before.x,(await debug(page)).local.z-before.z)).toBeLessThan(.1);
 }
 await page.locator('#destination-search').fill('Ｆ １');await page.locator('#destination-search').press('Enter');expect((await debug(page)).camera.target).toBe('building:res-10');await expect(page.locator('#return-building')).toBeInViewport();await expect(page.locator('#navigate')).toBeInViewport();await page.screenshot({path:'reports/screenshots/building-search-focus.png'});
 await page.locator('#return-building').click();await expect(page.locator('#building-pin')).toBeHidden();expect((await debug(page)).camera.zoomDistance).toBe(camera.zoomDistance);expect((await debug(page)).navigation.focusObjects).toBe(0);
 await page.keyboard.down('KeyD');await page.waitForTimeout(350);await page.keyboard.up('KeyD');expect((await debug(page)).local.x).toBeGreaterThan(before.x+.6);
 await page.locator('#destination-search').fill('F18');await expect(page.locator('#building-results button')).toHaveCount(0);await expect(page.locator('#search-status')).toContainText('没有找到');
 await page.locator('#destination-search').fill('食堂');await expect.poll(()=>page.locator('#building-results button').count()).toBeGreaterThanOrEqual(5);await page.screenshot({path:'reports/screenshots/building-search-results.png'});
 await page.locator('#destination-search').fill('图书馆');await page.locator('#destination-search').press('ArrowDown');await page.keyboard.press('Enter');expect((await debug(page)).camera.target).toBe('building:library');await expect(page.locator('#selected-place')).toHaveText('图书中心（E12）');
 await page.locator('#map-expand').click();await expect(page.locator('#destination-search')).toBeInViewport();await expect(page.locator('#return-building')).toBeInViewport();await expect(page.locator('#navigate')).toBeInViewport();await page.screenshot({path:'reports/screenshots/building-search-map.png'});await page.locator('#map-expand').click();
 await page.locator('#navigate').click();await expect.poll(async()=>(await debug(page)).navigation.path.length,{timeout:10000}).toBeGreaterThan(1);expect((await debug(page)).camera.target).toBe('');await page.locator('#airdrop').click();await expect.poll(async()=>(await debug(page)).local.relocation).toBe(1);expect(blocked((await debug(page)).local)).toBe(false);await expect.poll(async()=>(await debug(page)).navigation.active).toBeUndefined();expect((await debug(page)).errors).toEqual([]);
 await page.setViewportSize({width:760,height:1000});await page.locator('#destination-search').fill('C10');await page.locator('#destination-search').press('Enter');await expect(page.locator('#building-pin')).toBeVisible();await expect(page.locator('#navigate')).toBeInViewport();await page.screenshot({path:'reports/screenshots/building-search-narrow.png'});await page.keyboard.press('Escape');expect((await debug(page)).camera.target).toBe('');expect((await debug(page)).navigation.focusObjects).toBe(0);
 for(const name of ['building-search-focus','building-search-results','building-search-map'])await info.attach(name,{path:`reports/screenshots/${name}.png`,contentType:'image/png'});
});
