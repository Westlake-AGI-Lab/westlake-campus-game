import {test,expect} from '@playwright/test';
import {registerPage,loginPage,TEST_PASSWORD} from '../account-helpers';
const debug=(p:import('@playwright/test').Page)=>p.evaluate(()=>(window as any).__campusDebug);
test('私有用户名与候选字显示名字注册、重复拒绝、密码验证、退出登录、位置保存与刷新恢复',async({context},info)=>{
 const a=await context.newPage(),b=await context.newPage();const username=await registerPage(a,3),initial=await debug(a),displayName=initial.local.name,id=initial.playerId;
 await b.goto('/');await b.locator('#auth-register').click();await expect(b.locator('#username')).toBeEditable();await expect(b.locator('#display-name')).toHaveAttribute('readonly','');await b.locator('#username').fill(username);
 for(let i=0;i<3;i++)await b.locator('#name-part-'+i).selectOption('江泽月'[i]);await expect(b.locator('#enter-campus')).toBeDisabled();await expect(b.locator('#name-rule')).toContainText('不可用');
 for(let i=0;i<3;i++)await b.locator('#name-part-'+i).selectOption(displayName[i]);await b.locator('#password').fill(TEST_PASSWORD);await b.screenshot({path:'reports/screenshots/account-register.png'});await b.locator('#enter-campus').click();await expect(b.locator('#entry-error')).toContainText('已注册');
 await b.locator('#auth-login').click();await expect(b.locator('#display-name-group')).toBeHidden();await b.locator('#username').fill(username);await b.locator('#password').fill('incorrect-pass');await b.locator('#enter-campus').click();await expect(b.locator('#entry-error')).toContainText('密码');
 await b.locator('#password').fill(TEST_PASSWORD);await b.locator('#enter-campus').click();await expect(b.locator('#entry-error')).toContainText('在线');expect((await debug(a)).world.count).toBe(1);
 await a.bringToFront();await a.locator('#world').click({position:{x:600,y:340}});await a.keyboard.down('KeyD');await a.waitForTimeout(800);await a.keyboard.up('KeyD');await a.waitForTimeout(150);const before={...(await debug(a)).local};
 await a.locator('#logout').click();await expect(a.locator('#entry')).toBeVisible();await expect.poll(async()=>(await debug(a)).connected).toBe(false);await loginPage(b,username,3);await expect.poll(async()=>(await debug(b)).connected).toBe(true);expect((await debug(b)).playerId).toBe(id);expect(Math.hypot((await debug(b)).local.x-before.x,(await debug(b)).local.z-before.z)).toBeLessThan(.1);await expect(b.locator('#my-name')).toHaveText(displayName);
 await b.reload();await expect(b.locator('#entry')).toBeHidden();await expect.poll(async()=>(await debug(b)).connected).toBe(true);expect((await debug(b)).playerId).toBe(id);await expect(b.locator('.color-choice').nth(3)).toHaveAttribute('aria-pressed','true');expect((await debug(b)).errors).toEqual([]);await b.screenshot({path:'reports/screenshots/account-restored.png'});
 const saved=await b.evaluate(()=>JSON.parse(sessionStorage.getItem('westlake-account-session')!));expect(saved.username).toBe(username);expect(saved.displayName).toBe(displayName);expect(saved).not.toHaveProperty('password');
 await info.attach('独立登录用户名与显示名字',{path:'reports/screenshots/account-register.png',contentType:'image/png'});await info.attach('恢复存档',{path:'reports/screenshots/account-restored.png',contentType:'image/png'});await a.close();await b.close();
});
test('两个账号可以使用同一显示名字，角色与广播不暴露私有用户名',async({context})=>{
 const a=await context.newPage(),b=await context.newPage(),displayName='云风禾';
 const usernameA=await registerPage(a,0,'/',{displayName}),usernameB=await registerPage(b,2,'/',{displayName});
 await expect.poll(async()=>(await debug(a)).world.count).toBe(2);
 const aid=(await debug(a)).playerId,bid=(await debug(b)).playerId;expect(aid).not.toBe(bid);
 for(const page of[a,b]){
  await expect(page.locator('#my-name')).toHaveText(displayName);
  const snapshot=(await debug(page)).world,wire=JSON.stringify(snapshot);expect(wire).not.toContain(usernameA);expect(wire).not.toContain(usernameB);
  for(const player of snapshot.players){expect(player.name).toBe(displayName);expect(player).not.toHaveProperty('username');expect(player).not.toHaveProperty('token');}
  const text=await page.locator('#hud').innerText();expect(text).not.toContain(usernameA);expect(text).not.toContain(usernameB);
 }
 await expect(b.locator(`[data-player-id="${aid}"] .nickname`)).toHaveText(displayName);
 await a.close();await b.close();
});
