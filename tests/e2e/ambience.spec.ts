import {test,expect,type Page} from '@playwright/test';
import {registerPage} from '../account-helpers';
const debug=(p:Page)=>p.evaluate(()=>(window as any).__campusDebug);
test('昼夜天气同步、独立预览、校园猫打招呼和深夜实验室彩蛋',async({context})=>{
 const a=await context.newPage(),b=await context.newPage(),errors:string[]=[];
 for(const p of[a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
 await registerPage(a);await registerPage(b);const sa=(await debug(a)).ambience.state,sb=(await debug(b)).ambience.state;expect(Math.abs(sa.hour-sb.hour)).toBeLessThan(.03);expect(sa.weather).toBe(sb.weather);
 await a.locator('#ambience-panel summary').click();await a.locator('#ambience-time').selectOption('13');await a.locator('#ambience-weather').selectOption('rain');await expect.poll(async()=>(await debug(a)).ambience.rain).toBe(true);expect((await debug(b)).ambience.preview).toBe(false);
 await a.locator('#views-toggle').click();await a.locator('[data-view-id="aerial"]').click();await a.waitForTimeout(400);await a.screenshot({path:'reports/screenshots/ambience-rain.png'});await a.keyboard.press('Escape');
 await a.locator('#ambience-time').selectOption('23');await a.locator('#ambience-weather').selectOption('clear');await expect.poll(async()=>(await debug(a)).ambience.labVisible).toBe(true);
 await a.locator('#destination-search').fill('深夜实验室');await a.locator('#destination-search').press('Enter');await a.locator('#airdrop').click();await expect(a.locator('#ambience-notice')).toBeVisible();await a.locator('#find-lab').click();await a.waitForTimeout(400);await a.screenshot({path:'reports/screenshots/ambience-lab.png'});await a.keyboard.press('Escape');
 await a.locator('#ambience-time').selectOption('13');await expect(a.locator('#ambience-notice')).toBeHidden();
 await a.waitForTimeout(2200);await a.locator('#destination-search').fill('校园猫');await a.locator('#destination-search').press('Enter');await a.locator('#airdrop').click();await expect(a.locator('#cat-greet')).toBeVisible();await a.locator('#cat-greet').click();await expect.poll(async()=>(await debug(a)).ambience.cats.some((c:any)=>c.heart)).toBe(true);await a.screenshot({path:'reports/screenshots/ambience-cat.png'});
 expect((await debug(a)).render.calls).toBeGreaterThan(0);await a.setViewportSize({width:390,height:844});await a.locator('#map-toggle').click();await expect(a.locator('#ambience-time')).toBeInViewport();await a.screenshot({path:'reports/screenshots/ambience-mobile.png'});await a.locator('#ambience-time').selectOption('auto');await a.locator('#ambience-weather').selectOption('auto');await expect.poll(async()=>(await debug(a)).ambience.preview).toBe(false);expect(errors).toEqual([]);await a.close();await b.close();
});
