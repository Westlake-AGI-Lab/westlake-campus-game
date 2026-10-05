import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
const campus=JSON.parse(await readFile('data/campus.json','utf8'));
const a=campus.meta.alignment,s=a.scale,[ox,oz]=a.originPixels;
const point=(x,z)=>[x/s+ox,z/s+oz];
let svg='';
function rect(b,color='#d44531'){const[x,y]=point(b.x,b.z);svg+=`<rect x="${x-b.w/s/2}" y="${y-b.d/s/2}" width="${b.w/s}" height="${b.d/s}" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-width="1.2" transform="rotate(${(b.rotation||0)*180/Math.PI},${x},${y})"/>`;}
for(const b of campus.buildings){if(b.kind==='loop'){const pts=[];for(let i=0;i<=120;i++){const aa=(b.arc[0]+(b.arc[1]-b.arc[0])*i/120)*Math.PI/180;pts.push(point(b.x+Math.cos(aa)*b.outerRadius,b.z+Math.sin(aa)*b.outerRadius).join(','));}svg+=`<polyline points="${pts.join(' ')}" fill="none" stroke="#d44531" stroke-width="2"/>`;}else if(b.radius){const[x,y]=point(b.x,b.z);svg+=`<circle cx="${x}" cy="${y}" r="${b.radius/s}" fill="none" stroke="#d44531" stroke-width="1.3"/>`;}else for(const p of b.parts||[b])rect(p);const[x,y]=point(b.x,b.z);svg+=`<text x="${x}" y="${y}" font-size="10" fill="#9e1f12">${b.id}</text>`;}
for(const b of campus.bridges)rect(b,'#136cbb');
for(const r of campus.roads)svg+=`<polyline points="${r.points.map(p=>point(p.x,p.z).join(',')).join(' ')}" fill="none" stroke="#ce981b" stroke-width="${r.width/s}" stroke-opacity=".4"/>`;
const image='henn_westlakeuniversity_plan_masterplan.jpg';
await writeFile('references/plan-overlay.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1888" height="1334" viewBox="0 0 1888 1334"><image href="${image}" xlink:href="${image}" width="1888" height="1334"/>${svg}</svg>`);
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:1888,height:1334}});
await page.goto('file://'+resolve('references/plan-overlay.svg'));await page.screenshot({path:'references/plan-overlay.png'});await browser.close();
