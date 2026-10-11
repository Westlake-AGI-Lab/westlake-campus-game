import {CLASSIC_ARENA,type WaterArena,type WaterMode} from './water-modes';
import {waterBoxContains,waterInChannel,type ArenaBox} from './water-arena';
export {type ArenaBox} from './water-arena';
import type {Appearance} from './appearance';
export type Team='blue'|'orange';export type Weapon='sprayer'|'stream'|'precision';export type Vec={x:number;y:number;z:number};
export const WATER={tickMs:50,snapshotMs:100,capacity:20,teamSize:5,buyMs:15000,roundMs:100000,deviceMs:35000,resultsMs:6500,matchMs:16000,winningScore:7,plantMs:3000,defuseMs:10000,kitDefuseMs:5000,speed:5.4,walkSpeed:3.1,crouchSpeed:2.5,gravity:18,jumpSpeed:6.2,maxRewindMs:200} as const;
export const GEAR={
 sprayer:{name:'泡泡水枪',cost:0,damage:26,interval:260,mag:12,reserve:60,spread:.004,reloadMs:1000,range:24,optimal:12,moveSpread:.012,bloom:.003,recoveryMs:140,recoil:.010},
 stream:{name:'连发水枪',cost:1200,damage:18,interval:135,mag:24,reserve:96,spread:.006,reloadMs:1900,range:85,optimal:35,moveSpread:.030,bloom:.005,recoveryMs:260,recoil:.009},
 precision:{name:'精确水枪',cost:1800,damage:60,interval:1050,mag:6,reserve:24,spread:.001,reloadMs:2300,range:180,optimal:90,moveSpread:.075,bloom:.002,recoveryMs:500,recoil:.026},
} as const;
export function shotSpread(weapon:Weapon,moving:boolean,airborne:boolean,crouch:boolean,burst:number,settling:boolean){const g=GEAR[weapon];return Math.max(.0005,g.spread+(moving?g.moveSpread:0)+(settling&&!moving?g.moveSpread*.5:0)+(airborne?.065:0)+Math.min(6,Math.max(0,burst-1))*g.bloom-(crouch?g.spread*.4:0));}
export function waterRecoil(weapon:Weapon,burst:number){const pattern=[0,.25,-.3,.45,-.4,.6,-.65,.35];return{pitch:GEAR[weapon].recoil,yaw:pattern[(Math.max(1,burst)-1)%pattern.length]*GEAR[weapon].recoil};}
export function waterDamage(weapon:Weapon,distance:number,head:boolean){const g=GEAR[weapon],falloff=distance<=g.optimal?1:Math.max(.5,1-(distance-g.optimal)/(g.range-g.optimal)*.5);return Math.ceil(g.damage*falloff*(head?2:1));}
export const ARENA=CLASSIC_ARENA;
export type WaterInput={seq:number;forward:number;side:number;yaw:number;pitch:number;walk:boolean;crouch:boolean;jump:boolean;interact:boolean};
export type WaterPlayer=Vec&{id:string;name:string;appearance:Appearance;team:Team|null;alive:boolean;hp:number;armour:number;credits:number;weapon:Weapon;ammo:number;reserve:number;reloadUntil:number;balloons:number;smokes:number;kit:boolean;yaw:number;pitch:number;crouch:boolean;moving:boolean;ack:number;kills:number;deaths:number;shotAt:number;hitAt:number;spawn:number;respawnAt?:number;protectUntil?:number;settleUntil?:number;loadout?:Weapon;};
export type WaterDevice={carrier:string|null;dropped:Vec|null;site:string|null;point:Vec|null;expires:number;progress:number;actor:string|null;action:'plant'|'defuse'|null};
export type WaterBalloon=Vec&{id:number;owner:string;kind:'splash'|'mist';start:Vec;end:Vec;at:number;lands:number};
export type WaterSmoke=Vec&{id:number;expires:number};
export type WaterDrop=Vec&{id:number;owner:string;weapon:Weapon;ammo:number;reserve:number;at:number;expires:number};
export type WaterSound=Vec&{kind:'step'|'land'|'reload'|'shot'|'device'|'pickup';owner:string;at:number;walk?:boolean;weapon?:Weapon};
export type WaterState={mode:WaterMode;drops:WaterDrop[];time:number;phase:'waiting'|'buy'|'live'|'results'|'match';round:number;ends:number;attackTeam:Team;scores:Record<Team,number>;winner:Team|null;reason:string;players:WaterPlayer[];device:WaterDevice;balloons:WaterBalloon[];smokes:WaterSmoke[];match:number};
export type WaterWelcome={playerId:string;username:string;token:string;state:WaterState};
export type WaterReply={ok:boolean;error?:string;hit?:boolean;head?:boolean;knockout?:boolean};
export const otherTeam=(t:Team):Team=>t==='blue'?'orange':'blue';
export const eye=(p:Pick<WaterPlayer,'x'|'y'|'z'|'crouch'>):Vec=>({x:p.x,y:p.y+(p.crouch?1.05:1.65),z:p.z});
export function validWaterInput(v:unknown):v is WaterInput{if(!v||typeof v!=='object')return false;const q=v as WaterInput;return Object.keys(q).every(k=>['seq','forward','side','yaw','pitch','walk','crouch','jump','interact'].includes(k))&&Number.isSafeInteger(q.seq)&&q.seq>=0&&[q.forward,q.side,q.yaw,q.pitch].every(Number.isFinite)&&Math.abs(q.forward)<=1&&Math.abs(q.side)<=1&&Math.abs(q.yaw)<=Math.PI&&Math.abs(q.pitch)<=1.35&&['walk','crouch','jump','interact'].every(k=>typeof (q as unknown as Record<string,unknown>)[k]==='boolean');}
export function rayBox(origin:Vec,d:Vec,min:Vec,max:Vec):number{let lo=0,hi=500;for(const a of ['x','y','z'] as const){if(Math.abs(d[a])<1e-8){if(origin[a]<min[a]||origin[a]>max[a])return Infinity;}else{const t1=(min[a]-origin[a])/d[a],t2=(max[a]-origin[a])/d[a];lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(hi<lo)return Infinity;}}return lo;}
const wallCache=new WeakMap<WaterArena,ArenaBox[]>();
function walls(arena:WaterArena){let walls=wallCache.get(arena);if(walls)return walls;const bounds=arena.bounds;walls=[...arena.boxes,
 ...[bounds.minX-.4,bounds.maxX+.4].map(x=>({x,y:1.5,z:(bounds.minZ+bounds.maxZ)/2,w:.8,h:3,d:bounds.maxZ-bounds.minZ+.8,rotation:0,color:'',kind:'screen' as const})),
 ...[bounds.minZ-.4,bounds.maxZ+.4].map(z=>({x:(bounds.minX+bounds.maxX)/2,y:1.5,z,w:bounds.maxX-bounds.minX+.8,h:3,d:.8,rotation:0,color:'',kind:'screen' as const}))];wallCache.set(arena,walls);return walls;}
export function arenaRayBox(o:Vec,d:Vec,b:ArenaBox){const c=Math.cos(b.rotation),s=Math.sin(b.rotation),dx=o.x-b.x,dz=o.z-b.z;return rayBox({x:c*dx+s*dz,y:o.y-b.y,z:-s*dx+c*dz},{x:c*d.x+s*d.z,y:d.y,z:-s*d.x+c*d.z},{x:-b.w/2,y:-b.h/2,z:-b.d/2},{x:b.w/2,y:b.h/2,z:b.d/2});}
export function wallDistance(o:Vec,d:Vec,arena:WaterArena=ARENA){let distance=d.y<-.0001?Math.min(500,-o.y/d.y):500;for(const b of walls(arena))distance=Math.min(distance,arenaRayBox(o,d,b));return distance;}
export function clearWaterLine(a:Vec,b:Vec,arena:WaterArena=ARENA){const n=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(n<.01)return true;return wallDistance(a,{x:(b.x-a.x)/n,y:(b.y-a.y)/n,z:(b.z-a.z)/n},arena)>=n-.1;}
export function waterBlocked(p:Vec,arena:WaterArena=ARENA){const b=arena.bounds;return p.x<b.minX+.5||p.x>b.maxX-.5||p.z<b.minZ+.5||p.z>b.maxZ-.5||waterInChannel(p)||arena.boxes.some(b=>p.y<b.y+b.h/2&&waterBoxContains(p,b,.36));}
export function waterMove(p:Vec,dx:number,dz:number,arena:WaterArena=ARENA):Vec{const x=waterBlocked({...p,x:p.x+dx},arena)?p.x:p.x+dx;return {...p,x,z:waterBlocked({...p,x,z:p.z+dz},arena)?p.z:p.z+dz};}
export const blankDevice=():WaterDevice=>({carrier:null,dropped:null,site:null,point:null,expires:0,progress:0,actor:null,action:null});
