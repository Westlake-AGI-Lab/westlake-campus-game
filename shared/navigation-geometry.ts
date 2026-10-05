import {campus} from './world';
import {CONFIG} from './config';
import type {Box,Point} from './types';
const bucketSize=32;
const key=(x:number,z:number)=>`${Math.floor(x/bucketSize)},${Math.floor(z/bucketSize)}`;
function add<T>(map:Map<string,T[]>,value:T,minX:number,maxX:number,minZ:number,maxZ:number){
 for(let x=Math.floor(minX/bucketSize);x<=Math.floor(maxX/bucketSize);x++)for(let z=Math.floor(minZ/bucketSize);z<=Math.floor(maxZ/bucketSize);z++){const k=`${x},${z}`,list=map.get(k)||[];list.push(value);map.set(k,list);}
}
function bounds(points:Point[]){return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};}
function crossings(points:Point[],z:number){const xs:number[]=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.z>z)!==(b.z>z))xs.push((b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x);}return xs.sort((a,b)=>a-b);}
function inRow(x:number,xs:number[]){let lo=0,hi=xs.length;while(lo<hi){const mid=(lo+hi)>>1;if(xs[mid]<=x)lo=mid+1;else hi=mid;}return !!(lo%2);}
/** Same collision rules as world.blocked, indexed for navigation rather than ticks. */
export function collisionQuery(){
 const boxes=new Map<string,(Box&{c:number;s:number;halfW:number;halfD:number})[]>(),bridges=new Map<string,{segments:{a:Point;b:Point;dx:number;dz:number;length2:number}[];radius2:number}[]>();
 for(const box of campus.colliders){const c=Math.cos(box.rotation),s=Math.sin(box.rotation),halfW=box.w/2+CONFIG.playerRadius,halfD=box.d/2+CONFIG.playerRadius,dx=Math.abs(c)*halfW+Math.abs(s)*halfD,dz=Math.abs(s)*halfW+Math.abs(c)*halfD;add(boxes,{...box,c,s,halfW,halfD},box.x-dx,box.x+dx,box.z-dz,box.z+dz);}
 for(const bridge of [...campus.bridges,...(campus.waterWalkways||[])]){const r=bridge.w/2-CONFIG.playerRadius,b=bounds(bridge.points),segments=bridge.points.slice(1).map((p,i)=>{const a=bridge.points[i],dx=p.x-a.x,dz=p.z-a.z;return{a,b:p,dx,dz,length2:dx*dx+dz*dz};});add(bridges,{segments,radius2:r*r},b.minX-r,b.maxX+r,b.minZ-r,b.maxZ+r);}
 const waters=campus.waterBodies.map(w=>({...bounds(w.outer),outer:w.outer,holes:[w.inner,...(w.holes||[])]}));
 const rows=new Map<number,{minX:number;maxX:number;outer:number[];holes:number[][]}[]>();
 function blocked(p:Point){
  const b=campus.meta.bounds,r=CONFIG.playerRadius;if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||p.x<b.minX+r||p.x>b.maxX-r||p.z<b.minZ+r||p.z>b.maxZ-r)return true;
  for(const box of boxes.get(key(p.x,p.z))||[]){const dx=p.x-box.x,dz=p.z-box.z;if(Math.abs(box.c*dx+box.s*dz)<box.halfW&&Math.abs(-box.s*dx+box.c*dz)<box.halfD)return true;}
  let row=rows.get(p.z);if(!row){if(rows.size>12000)rows.clear();row=waters.filter(w=>p.z>=w.minZ&&p.z<=w.maxZ).map(w=>({minX:w.minX,maxX:w.maxX,outer:crossings(w.outer,p.z),holes:w.holes.map(h=>crossings(h,p.z))}));rows.set(p.z,row);}
  if(!row.some(w=>p.x>=w.minX&&p.x<=w.maxX&&inRow(p.x,w.outer)&&!w.holes.some(h=>inRow(p.x,h))))return false;
  for(const bridge of bridges.get(key(p.x,p.z))||[])for(const seg of bridge.segments){const t=Math.max(0,Math.min(1,((p.x-seg.a.x)*seg.dx+(p.z-seg.a.z)*seg.dz)/seg.length2)),dx=p.x-seg.a.x-t*seg.dx,dz=p.z-seg.a.z-t*seg.dz;if(dx*dx+dz*dz<bridge.radius2)return false;}
  return true;
 }
 function clear(a:Point,b:Point,spacing=.15){const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/spacing));for(let i=0;i<=steps;i++){const t=i/steps;if(blocked({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}))return false;}return true;}
 return{blocked,clear};
}
