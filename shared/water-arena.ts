import {campus,insidePolygon,nearestPath} from './world';
import type {Point} from './types';

// The competitive crop uses the same campus coordinates, uniformly scaled 1:2.
export const WATER_CAMPUS={scale:.5,origin:{x:0,z:-75},bounds:{minX:-235,maxX:215,minZ:-355,maxZ:215},ids:['E10','E0','library','beacon']} as const;
export const toWaterPoint=(p:Point):Point=>({x:(p.x-WATER_CAMPUS.origin.x)*WATER_CAMPUS.scale,z:(p.z-WATER_CAMPUS.origin.z)*WATER_CAMPUS.scale});
export const WATER_BOUNDS={minX:-117.5,maxX:107.5,minZ:-140,maxZ:145};
export const WATER_BUILDINGS=campus.buildings.filter(b=>(WATER_CAMPUS.ids as readonly string[]).includes(b.id));
export type ArenaBox={x:number;y:number;z:number;w:number;h:number;d:number;rotation:number;color:string;kind:'building'|'screen'|'planter'|'crate';objectId?:string};
const scaledBox=(x:number,z:number,w:number,d:number,h:number,rotation=0,objectId=''):ArenaBox=>({...toWaterPoint({x,z}),y:h*.25,w:w*.5,d:d*.5,h:h*.5,rotation,color:'#deded2',kind:'building',objectId});
const structure:ArenaBox[]=[];
for(const b of WATER_BUILDINGS){
 if(b.kind==='loop'){
  // A closed facade for this outdoor match; no hidden or unfinished interiors.
  const start=b.arc![0]*Math.PI/180,end=b.arc![1]*Math.PI/180,n=Math.ceil((end-start)*b.radius!/6),step=(end-start)/n;
  for(let i=0;i<n;i++){const a=start+(i+.5)*step,r=(b.innerRadius!+b.outerRadius!)/2;structure.push(scaledBox(b.x+Math.cos(a)*r,b.z+Math.sin(a)*r,(b.outerRadius!-b.innerRadius!),2*r*Math.tan(step/2)+.12,b.h,a,b.id));}
 }else if(b.kind==='hall'){
  // Inscribed solid body plus overlapping tangent strips match the circular wall.
  const r=b.radius!;structure.push(scaledBox(b.x,b.z,r*1.4,r*1.4,24,0,b.id));
  for(let i=0;i<48;i++){const a=i/48*Math.PI*2;structure.push(scaledBox(b.x+Math.cos(a)*(r-2),b.z+Math.sin(a)*(r-2),4,2*r*Math.tan(Math.PI/48)+.2,14,a,b.id));}
 }else if(b.parts)for(const p of b.parts)structure.push(scaledBox(p.x,p.z,p.w,p.d,p.h,p.rotation||0,b.id));
 else structure.push(scaledBox(b.x,b.z,b.radius!*2,b.radius!*2,b.h,0,b.id));
}
const cover=(x:number,z:number,w:number,d:number,h:number,rotation:number,kind:'screen'|'planter'|'crate'):ArenaBox=>({x,y:h/2,z,w,d,h,rotation,kind,color:kind==='screen'?'#689b9c':kind==='planter'?'#b5b299':'#c6a47a'});
export const WATER_COVER: ArenaBox[]=[
 cover(-15,-92,8,.65,2.5,0,'screen'),cover(8,-65,11,.65,2.5,.35,'screen'),
 cover(-38,-63,8,.65,2.5,-.25,'screen'),cover(-69,-40,7,.65,2.5,.5,'screen'),
 cover(-44,-22,12,.65,2.5,-.3,'screen'),cover(-8,-6,10,.65,2.5,.5,'screen'),
 cover(-13,37,10,.65,2.5,-.25,'screen'),cover(-25,59,9,.65,2.5,.2,'screen'),
 cover(60,-40,10,.65,2.5,-.45,'screen'),cover(75,34,8,.65,2.5,0,'screen'),
 cover(-65,-68,4,2,1.15,0,'planter'),cover(-49,-48,4,2,1.15,.3,'planter'),
 cover(-34,7,5,2,1.15,0,'planter'),cover(3,52,5,2,1.15,-.3,'planter'),
 cover(-74,-61,2.5,2,1.55,0,'crate'),cover(-6,11,2.5,2,1.55,0,'crate'),
 cover(67,8,2.5,2,1.55,0,'crate'),cover(-47,40,2.5,2,1.55,0,'crate'),
];
export const WATER_BOXES=[...structure,...WATER_COVER];
export const WATER_SITES=[{id:'A',...toWaterPoint({x:-110,z:-194}),name:'图书中心前庭'},{id:'B',...toWaterPoint({x:0,z:-30}),name:'学术会堂西庭'}];
export const WATER_SPAWNS={attack:{x:-12,z:-84,yaw:Math.PI},defend:{x:-25,z:75,yaw:0}};
export function waterBoxContains(p:Point,b:ArenaBox,pad=0){const dx=p.x-b.x,dz=p.z-b.z,c=Math.cos(b.rotation),s=Math.sin(b.rotation);return Math.abs(c*dx+s*dz)<b.w/2+pad&&Math.abs(-s*dx+c*dz)<b.d/2+pad;}
const intersects=(points:Point[])=>points.some(p=>p.x>-235&&p.x<215&&p.z>-355&&p.z<215);
export const WATER_ROADS=campus.roads.filter(r=>intersects(r.points)).map(r=>({...r,width:r.width*.5,points:r.points.map(toWaterPoint)}));
export const WATER_BANKS=campus.waterBodies.filter(w=>intersects(w.outer)).map(w=>({...w,outer:w.outer.map(toWaterPoint),inner:w.inner.map(toWaterPoint),holes:w.holes?.map(h=>h.map(toWaterPoint))}));
export const WATER_BRIDGES=[...campus.bridges,...campus.waterWalkways||[]].filter(b=>intersects(b.points)).map(b=>({...b,w:b.w*.5,points:b.points.map(toWaterPoint)}));
export function waterInChannel(p:Point){return WATER_BANKS.some(w=>insidePolygon(p,w.outer)&&![w.inner,...w.holes||[]].some(h=>insidePolygon(p,h)))&&!WATER_BRIDGES.some(b=>nearestPath(p,b.points).distance<b.w/2-.36);}
