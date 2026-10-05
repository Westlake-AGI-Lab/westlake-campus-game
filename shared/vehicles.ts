import {collisionQuery} from './navigation-geometry';
import {campus,insideBox,heightAt,bridgeAt} from './world';
import type {Point} from './types';
export type Vehicle=Point&{id:string;color:number;yaw:number;speed:number;driverId:string|null};
export type DriveInput={seq:number;throttle:number;steer:number;brake:boolean};
export type VehicleAction={seq:number;kind:'enter';vehicleId:string}|{seq:number;kind:'exit'};
export type VehicleReply={ok:true}|{ok:false;error:string};
export const VEHICLE=Object.freeze({length:4.4,width:2,enterRange:4.5,maxSpeed:15,reverseSpeed:5,acceleration:6,brake:14,friction:3,turnRate:1.4,inputTimeout:350});
export const PARKING=Object.freeze({x:-635,z:542,w:18,d:40,point:{x:-644,z:542}});
const query=collisionQuery();
export function createVehicles():Vehicle[]{return Array.from({length:4},(_,i)=>({id:'car-'+(i+1),x:PARKING.x,z:530+i*8,color:i,yaw:-Math.PI/2,speed:0,driverId:null}));}
export function validDrive(value:unknown):value is DriveInput{
 if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;
 return Object.keys(v).length===4&&Object.keys(v).every(k=>['seq','throttle','steer','brake'].includes(k))&&Number.isSafeInteger(v.seq)&&Number(v.seq)>=0&&Number(v.seq)<1e12&&typeof v.throttle==='number'&&Number.isFinite(v.throttle)&&Math.abs(v.throttle)<=1&&typeof v.steer==='number'&&Number.isFinite(v.steer)&&Math.abs(v.steer)<=1&&typeof v.brake==='boolean';
}
export function validVehicleAction(value:unknown):value is VehicleAction{
 if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;
 return Number.isSafeInteger(v.seq)&&Number(v.seq)>=0&&Number(v.seq)<1e12&&(v.kind==='exit'?Object.keys(v).length===2&&Object.keys(v).every(k=>['seq','kind'].includes(k)):v.kind==='enter'&&Object.keys(v).length===3&&Object.keys(v).every(k=>['seq','kind','vehicleId'].includes(k))&&typeof v.vehicleId==='string'&&/^car-[1-4]$/.test(v.vehicleId));
}
export function vehicleContains(v:Vehicle,p:Point,pad=.45){return insideBox(p,{x:v.x,z:v.z,w:VEHICLE.width,d:VEHICLE.length,rotation:-v.yaw},pad);}
export function vehicleFootprint(v:Vehicle):Point[]{const c=Math.cos(v.yaw),s=Math.sin(v.yaw),points:Point[]=[];for(const x of[-1,0,1])for(const z of[-2.2,-1.1,0,1.1,2.2])points.push({x:v.x+c*x+s*z,z:v.z-s*x+c*z});return points;}
function boxesOverlap(a:Vehicle,b:{x:number;z:number;w:number;d:number;rotation:number}){
 const ac=Math.cos(-a.yaw),as=Math.sin(-a.yaw),bc=Math.cos(b.rotation),bs=Math.sin(b.rotation),dx=b.x-a.x,dz=b.z-a.z;
 const axes=[[ac,as],[-as,ac],[bc,bs],[-bs,bc]];
 return axes.every(([x,z])=>Math.abs(dx*x+dz*z)<Math.abs(ac*x+as*z)*VEHICLE.width/2+Math.abs(-as*x+ac*z)*VEHICLE.length/2+Math.abs(bc*x+bs*z)*(b.w/2+.15)+Math.abs(-bs*x+bc*z)*(b.d/2+.15));
}
export function vehicleBlocked(v:Vehicle,others:Vehicle[]=[],people:Point[]=[]){
 // Check a conservative enclosing circle against other cars, and a sampled footprint against static obstacles.
 if(others.some(o=>o.id!==v.id&&Math.hypot(o.x-v.x,o.z-v.z)<VEHICLE.length+.3)||people.some(p=>vehicleContains(v,p,.8)))return true;
 if(campus.colliders.some(b=>boxesOverlap(v,b)))return true;
 return vehicleFootprint(v).some(p=>query.blocked(p)||heightAt(p)>.35&&!bridgeAt(p));
}
export function stepVehicle(v:Vehicle,input:Pick<DriveInput,'throttle'|'steer'|'brake'>,dt:number,others:Vehicle[]=[],people:Point[]=[]):Vehicle{
 const next={...v};dt=Math.max(0,Math.min(dt,.1));const steps=Math.max(1,Math.ceil(dt/.02)),step=dt/steps;
 for(let n=0;n<steps;n++){
  const slowing=input.brake?VEHICLE.brake:!input.throttle?VEHICLE.friction:Math.sign(input.throttle)!==Math.sign(next.speed)&&Math.abs(next.speed)>.1?VEHICLE.brake:0;
  if(slowing)next.speed=Math.sign(next.speed)*Math.max(0,Math.abs(next.speed)-slowing*step);else next.speed+=input.throttle*VEHICLE.acceleration*step;
  next.speed=Math.max(-VEHICLE.reverseSpeed,Math.min(VEHICLE.maxSpeed,next.speed));
  const yaw=next.yaw+input.steer*VEHICLE.turnRate*Math.min(1,Math.abs(next.speed)/4)*Math.sign(next.speed)*step;
  const candidate={...next,yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),x:next.x+Math.sin(yaw)*next.speed*step,z:next.z+Math.cos(yaw)*next.speed*step};
  if(vehicleBlocked(candidate,others,people)){next.speed=0;break;}Object.assign(next,candidate);
 }
 return next;
}
export function vehicleExit(v:Vehicle,cars:Vehicle[],players:Point[],allowed:(p:Point)=>boolean=()=>true):Point|undefined{
 for(const r of[2,3,4,6])for(const angle of[Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI/4,-Math.PI/4,Math.PI*.75,-Math.PI*.75]){const a=v.yaw+angle,p={x:v.x+Math.sin(a)*r,z:v.z+Math.cos(a)*r};if(allowed(p)&&!query.blocked(p)&&cars.every(c=>!vehicleContains(c,p))&&players.every(o=>Math.hypot(o.x-p.x,o.z-p.z)>1.5))return p;}
}
