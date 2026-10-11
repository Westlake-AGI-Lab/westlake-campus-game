import type {Appearance} from './appearance';
export type Team='blue'|'orange';export type Weapon='sprayer'|'stream'|'precision';export type Vec={x:number;y:number;z:number};
export const WATER={tickMs:50,snapshotMs:100,capacity:20,teamSize:5,buyMs:15000,roundMs:100000,deviceMs:35000,resultsMs:6500,matchMs:16000,winningScore:7,plantMs:3000,defuseMs:10000,kitDefuseMs:5000,speed:5.4,walkSpeed:3.1,crouchSpeed:2.5,gravity:18,jumpSpeed:6.2,maxRewindMs:200} as const;
export const GEAR={sprayer:{name:'泡泡水枪',cost:0,damage:24,interval:300,mag:12,reserve:60,spread:.006,reloadMs:1300},stream:{name:'连发水枪',cost:1200,damage:27,interval:125,mag:24,reserve:96,spread:.01,reloadMs:1900},precision:{name:'精确水枪',cost:1800,damage:65,interval:950,mag:6,reserve:24,spread:.001,reloadMs:2200}} as const;
export type ArenaBox=Vec&{w:number;h:number;d:number;color:string};
export const ARENA={half:36,sites:[{id:'A',x:-22,z:-17},{id:'B',x:22,z:-17}],boxes:[
 {x:0,y:2.5,z:1,w:9,h:5,d:13,color:'#e7dcc0'},
 {x:-16,y:2,z:8,w:12,h:4,d:3,color:'#d0dbcf'},{x:16,y:2,z:8,w:12,h:4,d:3,color:'#d0dbcf'},
 {x:-16,y:2,z:-7,w:3,h:4,d:12,color:'#d0dbcf'},{x:16,y:2,z:-7,w:3,h:4,d:12,color:'#d0dbcf'},
 {x:-26,y:.65,z:17,w:4,h:1.3,d:3,color:'#bca879'},{x:26,y:.65,z:17,w:4,h:1.3,d:3,color:'#bca879'},
 {x:-24,y:.8,z:-22,w:4,h:1.6,d:3,color:'#afc4ae'},{x:24,y:.8,z:-22,w:4,h:1.6,d:3,color:'#afc4ae'},
 {x:0,y:1.2,z:-22,w:8,h:2.4,d:3,color:'#bccbce'},
 {x:-7,y:1.1,z:23,w:3,h:2.2,d:4,color:'#d8ba88'},{x:7,y:1.1,z:23,w:3,h:2.2,d:4,color:'#d8ba88'},
 {x:-30,y:2.2,z:-2,w:3,h:4.4,d:9,color:'#dbcbb4'},{x:30,y:2.2,z:-2,w:3,h:4.4,d:9,color:'#dbcbb4'}] satisfies ArenaBox[]};
export type WaterInput={seq:number;forward:number;side:number;yaw:number;pitch:number;walk:boolean;crouch:boolean;jump:boolean;interact:boolean};
export type WaterPlayer=Vec&{id:string;name:string;appearance:Appearance;team:Team|null;alive:boolean;hp:number;armour:number;credits:number;weapon:Weapon;ammo:number;reserve:number;reloadUntil:number;balloons:number;smokes:number;kit:boolean;yaw:number;pitch:number;crouch:boolean;moving:boolean;ack:number;kills:number;deaths:number;shotAt:number;hitAt:number;spawn:number;};
export type WaterDevice={carrier:string|null;dropped:Vec|null;site:string|null;point:Vec|null;expires:number;progress:number;actor:string|null;action:'plant'|'defuse'|null};
export type WaterBalloon=Vec&{id:number;owner:string;kind:'splash'|'mist';start:Vec;end:Vec;at:number;lands:number};
export type WaterSmoke=Vec&{id:number;expires:number};
export type WaterState={time:number;phase:'waiting'|'buy'|'live'|'results'|'match';round:number;ends:number;attackTeam:Team;scores:Record<Team,number>;winner:Team|null;reason:string;players:WaterPlayer[];device:WaterDevice;balloons:WaterBalloon[];smokes:WaterSmoke[];match:number};
export type WaterWelcome={playerId:string;username:string;token:string;state:WaterState};
export type WaterReply={ok:boolean;error?:string;hit?:boolean;head?:boolean;knockout?:boolean};
export const otherTeam=(t:Team):Team=>t==='blue'?'orange':'blue';
export const eye=(p:Pick<WaterPlayer,'x'|'y'|'z'|'crouch'>):Vec=>({x:p.x,y:p.y+(p.crouch?1.05:1.65),z:p.z});
export function validWaterInput(v:unknown):v is WaterInput{if(!v||typeof v!=='object')return false;const q=v as WaterInput;return Object.keys(q).every(k=>['seq','forward','side','yaw','pitch','walk','crouch','jump','interact'].includes(k))&&Number.isSafeInteger(q.seq)&&q.seq>=0&&[q.forward,q.side,q.yaw,q.pitch].every(Number.isFinite)&&Math.abs(q.forward)<=1&&Math.abs(q.side)<=1&&Math.abs(q.yaw)<=Math.PI&&Math.abs(q.pitch)<=1.35&&['walk','crouch','jump','interact'].every(k=>typeof (q as unknown as Record<string,unknown>)[k]==='boolean');}
export function rayBox(origin:Vec,d:Vec,min:Vec,max:Vec):number{let lo=0,hi=100;for(const a of ['x','y','z'] as const){if(Math.abs(d[a])<1e-8){if(origin[a]<min[a]||origin[a]>max[a])return Infinity;}else{const t1=(min[a]-origin[a])/d[a],t2=(max[a]-origin[a])/d[a];lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(hi<lo)return Infinity;}}return lo;}
const rayWalls=[...ARENA.boxes,{x:-36.4,y:2,z:0,w:.8,h:4,d:73},{x:36.4,y:2,z:0,w:.8,h:4,d:73},{x:0,y:2,z:-36.4,w:73,h:4,d:.8},{x:0,y:2,z:36.4,w:73,h:4,d:.8}];
export function wallDistance(o:Vec,d:Vec){let distance=d.y<-.0001?Math.min(100,-o.y/d.y):100;for(const b of rayWalls)distance=Math.min(distance,rayBox(o,d,{x:b.x-b.w/2,y:b.y-b.h/2,z:b.z-b.d/2},{x:b.x+b.w/2,y:b.y+b.h/2,z:b.z+b.d/2}));return distance;}
export function clearWaterLine(a:Vec,b:Vec){const n=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(n<.01)return true;return wallDistance(a,{x:(b.x-a.x)/n,y:(b.y-a.y)/n,z:(b.z-a.z)/n})>=n-.1;}
export function waterMove(p:Vec,dx:number,dz:number):Vec{const blocked=(x:number,z:number)=>Math.abs(x)>ARENA.half-.5||Math.abs(z)>ARENA.half-.5||ARENA.boxes.some(b=>p.y<b.y+b.h/2&&Math.abs(x-b.x)<b.w/2+.36&&Math.abs(z-b.z)<b.d/2+.36);const x=blocked(p.x+dx,p.z)?p.x:p.x+dx;return {...p,x,z:blocked(x,p.z+dz)?p.z:p.z+dz};}
export const blankDevice=():WaterDevice=>({carrier:null,dropped:null,site:null,point:null,expires:0,progress:0,actor:null,action:null});
