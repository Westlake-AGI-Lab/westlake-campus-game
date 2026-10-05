import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
const audit=JSON.parse(await readFile('assets-src/region-audit.json','utf8'));
await mkdir('references/region-views',{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:1100,height:850}});
for(const r of audit.regions){const[x0,y0,x1,y1]=r.planBounds;const w=x1-x0,h=y1-y0;await writeFile(`references/region-views/${r.id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="850" viewBox="${x0} ${y0} ${w} ${h}"><image href="../henn_westlakeuniversity_plan_masterplan.jpg" width="1888" height="1334"/></svg>`);await page.goto('file://'+resolve(`references/region-views/${r.id}.svg`));await page.screenshot({path:`references/region-views/${r.id}.png`});}
await browser.close();
