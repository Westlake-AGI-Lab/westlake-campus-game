import {campus,blocked,insidePolygon,nearestPath,bridgeAt,heightAt} from '../shared/world';
import {writeFileSync} from 'node:fs';
const wet=(p:{x:number;z:number})=>campus.waterBodies.some(w=>insidePolygon(p,w.outer)&&!insidePolygon(p,w.inner));
const bridges=campus.bridges.map(b=>{const failures=b.points.filter(p=>blocked(p));return{id:b.id,bankEndpoints:b.points.filter((_,i)=>i===0||i===b.points.length-1).map(p=>({point:p,dry:!wet(p)})),blockedCentrePoints:failures,waterSamples:b.points.filter(wet).length,maximumWalkHeight:Math.max(...b.points.map(heightAt))};});
console.log(bridges.map(b=>({id:b.id,dry:b.bankEndpoints.map(v=>v.dry),blocked:b.blockedCentrePoints.length,water:b.waterSamples})));
const ids=new Set(campus.buildings.map(b=>b.id));const buildingColliders=campus.colliders.filter(c=>ids.has((c as any).objectId));
const crossings=campus.roads.map(r=>{let count=0,total=0;const examples=[];for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],len=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(len/2);for(let n=0;n<steps;n++){const p={x:a.x+(b.x-a.x)*n/steps,z:a.z+(b.z-a.z)*n/steps};total++;const c=buildingColliders.find(c=>{const cs=Math.cos(c.rotation),sn=Math.sin(c.rotation),dx=p.x-c.x,dz=p.z-c.z;return Math.abs(cs*dx+sn*dz)<c.w/2&&Math.abs(-sn*dx+cs*dz)<c.d/2;});if(c){count++;if(examples.length<2)examples.push({point:p,object:(c as any).objectId});}}}return{id:r.id,count,total,examples};}).filter(r=>r.count);
console.log(crossings);writeFileSync('reports/road-crossings.json',JSON.stringify(crossings,null,2));
type Rect={x:number;z:number;w:number;d:number;rotation?:number};
function overlaps(a:Rect,b:Rect){
 const axes=(r:Rect)=>{const c=Math.cos(r.rotation||0),s=Math.sin(r.rotation||0);return [{x:c,z:s},{x:-s,z:c}];};
 const aa=axes(a),bb=axes(b),radius=(r:Rect,axes:{x:number;z:number}[],n:{x:number;z:number})=>r.w/2*Math.abs(axes[0].x*n.x+axes[0].z*n.z)+r.d/2*Math.abs(axes[1].x*n.x+axes[1].z*n.z);
 return [...aa,...bb].every(n=>Math.abs((a.x-b.x)*n.x+(a.z-b.z)*n.z)<radius(a,aa,n)+radius(b,bb,n));
}
const courts=(campus as typeof campus&{courts:Rect[]}).courts.map((c,i)=>({index:i,buildingIntersections:buildingColliders.filter(b=>overlaps(c,b)).map(b=>(b as any).objectId),roadIntersections:campus.roads.filter(r=>r.points.slice(1).some((b,j)=>{const a=r.points[j];return overlaps(c,{x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:Math.hypot(b.x-a.x,b.z-a.z),d:r.width,rotation:Math.atan2(b.z-a.z,b.x-a.x)});})).map(r=>r.id)}));
const stairs=(campus.stairs||[]).map(s=>{const bottom=heightAt({x:s.x,z:s.z+s.d/2}),top=heightAt({x:s.x,z:s.z-s.d/2-s.landingD/2});return {id:s.id,bottom,top,expectedRise:s.rise,status:Math.abs(top-bottom-s.rise)<.01?'PASS':'FAIL'};});
const status=bridges.every(b=>b.bankEndpoints.every(e=>e.dry)&&!b.blockedCentrePoints.length)&&!crossings.length&&courts.every(c=>!c.buildingIntersections.length&&!c.roadIntersections.length)&&stairs.every(s=>s.status==='PASS')?'PASS':'FAIL';
writeFileSync('reports/region-physics-audit.json',JSON.stringify({status,bridges,courts,stairs},null,2));
console.log({status,courtIntersections:courts.filter(c=>c.buildingIntersections.length||c.roadIntersections.length),stairs});if(status!=='PASS')process.exitCode=1;
