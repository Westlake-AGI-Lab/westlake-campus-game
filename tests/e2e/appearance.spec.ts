import {test,expect,type Page} from '@playwright/test';
import {registration,registerPage,loginPage,TEST_PASSWORD} from '../account-helpers';
import {APPEARANCE_OPTIONS,validAppearance,type Appearance} from '../../shared/appearance';
const debug=(page:Page)=>page.evaluate(()=>(window as any).__campusDebug);
const custom:Appearance={skin:4,hair:4,hairColor:3,outfit:2,coat:3,pants:2,accessory:4};

test('注册实时预览、随机搭配、外观同步与退出/刷新恢复；窄屏可以完成定制',async({context},info)=>{
 const a=await context.newPage(),b=await context.newPage(),errors:string[]=[];for(const page of[a,b])page.on('pageerror',e=>errors.push(e.message));
 const auth=registration(3);await a.goto('/');await expect(a.locator('#appearance-editor')).toBeHidden();await a.locator('#auth-register').click();await expect(a.locator('#appearance-editor')).toBeVisible();await expect(a.locator('#avatar-preview-note')).toContainText('外观不影响');
 await a.locator('#avatar-random').click();expect(validAppearance(JSON.parse((await a.locator('#avatar-preview').getAttribute('data-appearance'))!))).toBe(true);
 for(const key of Object.keys(custom).filter(k=>k!=='coat') as (keyof Appearance)[])await a.locator('#avatar-'+key).selectOption(String(custom[key]));await a.locator('.color-choice').nth(3).click();
 expect(JSON.parse((await a.locator('#avatar-preview').getAttribute('data-appearance'))!)).toEqual(custom);
 await a.locator('#username').fill(auth.username);for(let i=0;i<3;i++)await a.locator('#name-part-'+i).selectOption(auth.displayName[i]);await a.locator('#password').fill(TEST_PASSWORD);
 await a.locator('#appearance-editor').scrollIntoViewIfNeeded();await a.screenshot({path:'reports/screenshots/avatar-customization.png'});await info.attach('注册外观预览',{path:'reports/screenshots/avatar-customization.png',contentType:'image/png'});
 await a.locator('#enter-campus').click();await expect(a.locator('#entry')).toBeHidden();const id=(await debug(a)).playerId;expect((await debug(a)).local.appearance).toEqual(custom);
 const observerName=await registerPage(b,2);await expect.poll(async()=>(await debug(b)).world.count).toBe(2);
 expect((await debug(b)).world.players.find((p:any)=>p.id===id).appearance).toEqual(custom);expect((await debug(b)).entities.find((p:any)=>p.id===id).appearance).toEqual(custom);
 await a.bringToFront();await a.locator('#world').click({position:{x:600,y:340}});await a.keyboard.down('KeyD');await a.waitForTimeout(700);await a.keyboard.up('KeyD');await a.screenshot({path:'reports/screenshots/avatar-campus.png'});
 await a.locator('#logout').click();await expect(a.locator('#appearance-editor')).toBeHidden();await loginPage(a,auth.username,0);expect((await debug(a)).local.appearance).toEqual(custom);expect((await debug(a)).local.color).toBe(3);await a.reload();await expect(a.locator('#entry')).toBeHidden();expect((await debug(a)).entities.find((p:any)=>p.id===id).appearance).toEqual(custom);
 await b.locator('#logout').click();await b.setViewportSize({width:390,height:844});await b.locator('#auth-register').click();await expect(b.locator('#appearance-editor')).toBeVisible();await b.locator('#avatar-hair').selectOption('3');await b.locator('#avatar-outfit').selectOption('1');await b.locator('#avatar-accessory').selectOption('1');await b.locator('#avatar-preview').scrollIntoViewIfNeeded();await expect(b.locator('#avatar-preview')).toBeInViewport();
 for(const key of ['skin','hair','hairColor','outfit','pants','accessory'] as const)expect(await b.locator('#avatar-'+key+' option').count()).toBe(APPEARANCE_OPTIONS[key].length);
 const second=registration();await b.locator('#username').fill(second.username);for(let i=0;i<3;i++)await b.locator('#name-part-'+i).selectOption(second.displayName[i]);await b.locator('#password').fill(TEST_PASSWORD);await b.locator('#enter-campus').click();await expect(b.locator('#entry')).toBeHidden();expect((await debug(b)).local.appearance.hair).toBe(3);expect(errors).toEqual([]);expect(observerName).not.toBe(auth.username);await a.close();await b.close();
});
