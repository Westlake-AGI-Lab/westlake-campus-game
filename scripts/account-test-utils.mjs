import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';
const policy=JSON.parse(await readFile(new URL('../data/name-policy.json',import.meta.url),'utf8'));
const names=policy.parts[0].flatMap(a=>policy.parts[1].flatMap(b=>policy.parts[2].map(c=>a+b+c))).filter(n=>!policy.blocked.some(word=>n.includes(word)));
let index=Math.floor(Math.random()*names.length);
export const nextName=()=>names[index++%names.length];
export const TEST_PASSWORD='campus-test-123';
export const registration=(color=0)=>({mode:'register',username:'test_'+randomUUID().slice(0,12),displayName:nextName(),password:TEST_PASSWORD,color});
export async function registerPage(page,url,color=0){
 const auth=registration(color);await page.goto(url);await page.locator('#auth-register').click();await page.locator('#username').fill(auth.username);
 for(let i=0;i<3;i++)await page.locator('#name-part-'+i).selectOption(auth.displayName[i]);
 await page.locator('#password').fill(auth.password);await page.locator('.color-choice').nth(color).click();await page.locator('#enter-campus').click();
 await expect(page.locator('#entry')).toBeHidden();await expect.poll(async()=>page.evaluate(()=>window.__campusDebug.connected)).toBe(true);return auth;
}
export async function loginPage(page,auth){await page.locator('#auth-login').click();await page.locator('#username').fill(auth.username);await page.locator('#password').fill(auth.password);await page.locator('#enter-campus').click();await expect(page.locator('#entry')).toBeHidden();}
