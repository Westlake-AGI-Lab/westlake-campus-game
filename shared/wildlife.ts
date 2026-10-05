import {campus,blocked} from './world';
import type {Point} from './types';
// Ambient cats never obstruct or affect players. Verify the entire tiny roaming loop.
export const CAT_PATHS=([[4,84],[-106,39],[124,69],[-236,204]] as number[][]).map(([x,z])=>{
 for(let radius=2;radius>=0;radius-=.25){const points=Array.from({length:64},(_,k)=>({x:x+Math.cos(k/64*Math.PI*2)*radius,z:z+Math.sin(k/64*Math.PI*2)*radius}));if(points.every(p=>!blocked(p)))return points;}
 const p=campus.spawnPoints[0];return [{...p}];
});
export function catPose(clock:number,i:number){
 const seconds=clock/1000+i*17,cycle=Math.floor(seconds/45),phase=((seconds%45)+45)%45,rest=phase>=27,progress=(cycle*27+Math.min(phase,27))*.6,points=CAT_PATHS[i];
 const index=((Math.floor(progress)%points.length)+points.length)%points.length,a=points[index],b=points[(index+1)%points.length],f=progress-Math.floor(progress);
 return {point:{x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f} as Point,yaw:Math.atan2(b.x-a.x,b.z-a.z),rest};
}
export const LAB_BUILDING=campus.buildings.find(b=>b.id==='E1-E3')!;
export const LAB_PART=LAB_BUILDING.parts?.[0]||LAB_BUILDING;
export const LAB_POINT={x:LAB_PART.x,z:LAB_PART.z-LAB_PART.d/2-9};
