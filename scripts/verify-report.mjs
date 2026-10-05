import {chromium} from '@playwright/test';import {resolve} from 'node:path';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[];
for(const [file,expected,preview] of [['acceptance.html',29,'report-preview.png'],['region-audit.html',19,'region-report-preview.png']]){
 const errors=[],handler=e=>errors.push(e.message);page.on('pageerror',handler);await page.goto('file://'+resolve('reports/'+file));
 await page.locator('img').evaluateAll(async imgs=>{for(const img of imgs)img.loading='eager';await Promise.all(imgs.map(async img=>{try{await img.decode();}catch{}}));});
 const broken=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.hidden&&(!i.complete||i.naturalWidth===0)).map(i=>i.src)),comparisons=await page.locator('.comparison').count();
 await page.screenshot({path:'reports/screenshots/'+preview});results.push({file,status:errors.length||broken.length||comparisons!==expected?'FAIL':'PASS',errors,brokenImages:broken,comparisons});page.off('pageerror',handler);
}
await browser.close();const result={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',pages:results};await writeFile('reports/report-validation.json',JSON.stringify(result,null,2));console.log(result);if(result.status!=='PASS')process.exitCode=1;
