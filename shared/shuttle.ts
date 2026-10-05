import {campus,insideBox,heightAt,bridgeAt} from './world';
import {collisionQuery} from './navigation-geometry';
import {vehicleContains,type Vehicle} from './vehicles';
import type {Point} from './types';
export const SHUTTLE=Object.freeze({length:7.8,width:2.5,capacity:12,speed:10,enterRange:6,dwellMs:12000,exitPauseMs:2000});
export type Shuttle=Point&{id:string;yaw:number;speed:number;distance:number;passengerIds:string[];nextStop:number;dwellUntil:number;blocked:boolean};
export type ShuttleAction={seq:number;kind:'enter';shuttleId:string}|{seq:number;kind:'exit'};
export type ShuttleReply={ok:true}|{ok:false;error:string};
const query=collisionQuery();
// Game route follows modeled campus perimeter roads, not a real operator timetable.
const north=campus.roads.find(r=>r.id==='north-border')!.points;
const anchors:Point[]=[{x:-656.1,z:668},...north.map(p=>({x:Math.min(p.x,694),z:p.z})),{x:694,z:668}];
export const SHUTTLE_ROUTE:Point[]=[];
function line(a:Point,b:Point){const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)));for(let i=0;i<count;i++)SHUTTLE_ROUTE.push({x:a.x+(b.x-a.x)*i/count,z:a.z+(b.z-a.z)*i/count});}
const corners=anchors.map((p,i)=>{const a=anchors[(i+anchors.length-1)%anchors.length],b=anchors[(i+1)%anchors.length],da=Math.hypot(a.x-p.x,a.z-p.z),db=Math.hypot(b.x-p.x,b.z-p.z),r=Math.min(6,da/3,db/3);return {p,entry:{x:p.x+(a.x-p.x)/da*r,z:p.z+(a.z-p.z)/da*r},exit:{x:p.x+(b.x-p.x)/db*r,z:p.z+(b.z-p.z)/db*r}};});
for(let i=0;i<corners.length;i++){const c=corners[i];for(let k=0;k<16;k++){const t=k/16;SHUTTLE_ROUTE.push({x:(1-t)**2*c.entry.x+2*t*(1-t)*c.p.x+t*t*c.exit.x,z:(1-t)**2*c.entry.z+2*t*(1-t)*c.p.z+t*t*c.exit.z});}line(c.exit,corners[(i+1)%corners.length].entry);}
const lengths=SHUTTLE_ROUTE.map((p,i)=>Math.hypot(p.x-SHUTTLE_ROUTE[(i+1)%SHUTTLE_ROUTE.length].x,p.z-SHUTTLE_ROUTE[(i+1)%SHUTTLE_ROUTE.length].z));
const offsets:number[]=[];let total=0;for(const length of lengths){offsets.push(total);total+=length;}
export const SHUTTLE_ROUTE_LENGTH=total;
export function shuttlePose(distance:number){const d=((distance%total)+total)%total;let lo=0,hi=offsets.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(offsets[mid]<=d)lo=mid;else hi=mid-1;}const a=SHUTTLE_ROUTE[lo],b=SHUTTLE_ROUTE[(lo+1)%SHUTTLE_ROUTE.length],f=lengths[lo]?(d-offsets[lo])/lengths[lo]:0;return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw:Math.atan2(b.x-a.x,b.z-a.z)};}
const stopDefinitions=[['south','南门校车站',-4.88,668],['west-south','西南生活区校车站',-656.1,542],['west-north','西北生活区校车站',-656.1,-420],['north','北门校车站',-10.98,-695.12],['east-college','东侧书院校车站',694,-100],['sports','体育区校车站',694,440]] as const;
export const SHUTTLE_STOPS=stopDefinitions.map(([id,name,x,z])=>{let index=0,best=Infinity;for(let i=0;i<SHUTTLE_ROUTE.length;i++){const d=Math.hypot(SHUTTLE_ROUTE[i].x-x,SHUTTLE_ROUTE[i].z-z);if(d<best){best=d;index=i;}}const pose=shuttlePose(offsets[index]);const point={x:pose.x+Math.cos(pose.yaw)*4,z:pose.z-Math.sin(pose.yaw)*4};return {id:'shuttle-stop-'+id,name,distance:offsets[index],point,pose};}).sort((a,b)=>a.distance-b.distance);
export function createShuttles(now:number):Shuttle[]{return ['south','north'].map((id,i)=>{const stop=SHUTTLE_STOPS.find(s=>s.id==='shuttle-stop-'+id)!,nextStop=(SHUTTLE_STOPS.indexOf(stop)+1)%SHUTTLE_STOPS.length;return {id:'shuttle-'+(i+1),...stop.pose,distance:stop.distance,speed:0,passengerIds:[],nextStop,dwellUntil:now+SHUTTLE.dwellMs,blocked:false};});}
export function validShuttleAction(v:unknown):v is ShuttleAction{if(!v||typeof v!=='object')return false;const o=v as Record<string,unknown>;return Number.isSafeInteger(o.seq)&&Number(o.seq)>=0&&Number(o.seq)<1e12&&(o.kind==='exit'?Object.keys(o).length===2&&Object.keys(o).every(k=>['seq','kind'].includes(k)):o.kind==='enter'&&Object.keys(o).length===3&&Object.keys(o).every(k=>['seq','kind','shuttleId'].includes(k))&&typeof o.shuttleId==='string'&&/^shuttle-[12]$/.test(o.shuttleId));}
export function shuttleContains(v:Point&{yaw:number},p:Point,pad=.45){return insideBox(p,{x:v.x,z:v.z,w:SHUTTLE.width,d:SHUTTLE.length,rotation:-v.yaw},pad);}
export function shuttleFootprint(v:Point&{yaw:number}){const points:Point[]=[];for(const x of[-1.25,0,1.25])for(const z of[-3.9,-1.95,0,1.95,3.9])points.push({x:v.x+Math.cos(v.yaw)*x+Math.sin(v.yaw)*z,z:v.z-Math.sin(v.yaw)*x+Math.cos(v.yaw)*z});return points;}
export function shuttleStaticBlocked(v:Point&{yaw:number}){return shuttleFootprint(v).some(p=>query.blocked(p)||heightAt(p)>.35&&!bridgeAt(p));}
export function shuttleExit(v:Shuttle,cars:Vehicle[],buses:Shuttle[],people:Point[]=[]):Point|undefined{for(const r of[3,4,5,7,10,13])for(const angle of[Math.PI/2,-Math.PI/2,Math.PI*.75,-Math.PI*.75,Math.PI,0]){const a=v.yaw+angle,p={x:v.x+Math.sin(a)*r,z:v.z+Math.cos(a)*r};if(!query.blocked(p)&&cars.every(c=>!vehicleContains(c,p))&&buses.every(b=>!shuttleContains(b,p))&&people.every(o=>Math.hypot(o.x-p.x,o.z-p.z)>1.5))return p;}}
export function stepShuttle(v:Shuttle,dt:number,now:number,cars:Vehicle[]=[],people:Point[]=[],buses:Shuttle[]=[]):Shuttle{
 const next={...v,passengerIds:[...v.passengerIds],speed:0,blocked:false};if(now<v.dwellUntil)return next;
 const remaining=(SHUTTLE_STOPS[v.nextStop].distance-v.distance+total)%total,travel=Math.min(SHUTTLE.speed*Math.max(0,Math.min(dt,.1)),remaining);
 const candidate={...next,...shuttlePose(v.distance+travel),distance:(v.distance+travel)%total};
 if(shuttleStaticBlocked(candidate)||cars.some(c=>Math.hypot(c.x-candidate.x,c.z-candidate.z)<6.4)||people.some(p=>shuttleContains(candidate,p,.8))||buses.some(b=>b.id!==v.id&&Math.hypot(b.x-candidate.x,b.z-candidate.z)<8.6)){next.blocked=true;return next;}
 Object.assign(next,candidate,{speed:SHUTTLE.speed});if(remaining<=travel+.001){next.distance=SHUTTLE_STOPS[v.nextStop].distance;Object.assign(next,shuttlePose(next.distance));next.speed=0;next.dwellUntil=now+SHUTTLE.dwellMs;next.nextStop=(v.nextStop+1)%SHUTTLE_STOPS.length;}
 return next;
}
