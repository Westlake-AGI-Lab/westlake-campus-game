import {registerPage,registration} from './account-test-utils.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const campus=JSON.parse(await readFile('data/campus.json','utf8'));
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await registerPage(page,'http://127.0.0.1:3000');
for(const v of campus.validationViews){await page.locator('#views-toggle').click();await page.locator(`[data-view-id="${v.id}"]`).click();await page.waitForTimeout(180);await page.screenshot({path:`reports/screenshots/view-${v.id}.png`,style:'#hud,#labels{visibility:hidden!important}'});}
await writeFile('reports/region-capture.json',JSON.stringify({capturedAt:new Date().toISOString(),views:campus.validationViews.map(v=>v.id),errors},null,2));await browser.close();
