import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {APPROVED_NAMES} from '../shared/names';
export const TEST_PASSWORD='campus-test-123';
let next=Math.floor(Math.random()*APPROVED_NAMES.length);
export const nextName=()=>APPROVED_NAMES[next++%APPROVED_NAMES.length];
export const registration=(color=0)=>({mode:'register' as const,username:'test_'+randomUUID().slice(0,12),displayName:nextName(),password:TEST_PASSWORD,color});
export async function registerPage(page:Page,color=0,url='/',options:{username?:string;displayName?:string}={}){
 const auth={...registration(color),...options};await page.goto(url);await page.locator('#auth-register').click();await page.locator('#username').fill(auth.username);
 for(let i=0;i<3;i++)await page.locator('#name-part-'+i).selectOption(auth.displayName[i]);
 await page.locator('#password').fill(TEST_PASSWORD);await page.locator('.color-choice').nth(color).click();await page.locator('#enter-campus').click();
 await expect(page.locator('#entry')).toBeHidden();await expect.poll(async()=>await page.evaluate(()=>(window as any).__campusDebug.connected)).toBe(true);return auth.username;
}
export async function loginPage(page:Page,username:string,color=0,url='/'){
 await page.goto(url);if(await page.locator('#entry').isHidden())return;
 await page.locator('#auth-login').click();await page.locator('#username').fill(username);await page.locator('#password').fill(TEST_PASSWORD);if(await page.locator('.color-choice').nth(color).isVisible())await page.locator('.color-choice').nth(color).click();await page.locator('#enter-campus').click();await expect(page.locator('#entry')).toBeHidden();
}
