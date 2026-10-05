import type {Point,Player} from './types';
import {CAT_PATHS,catPose} from './wildlife';
import {blocked,move} from './world';
export type Pet=Point&{id:string;kind:'cat'|'dog';name:string;ownerId:string|null;yaw:number;moving:boolean;fedAt:number;happyAt:number;attackAt:number;homeX:number;homeZ:number};
export type PetAction={id:string;kind:'adopt'|'release'|'feed'};
export type PetReply={ok:boolean;error?:string};
export const PETS={range:4,feedCooldown:3000,assistDamage:8,assistCooldown:1200,assistWindow:3000};
export function createPets():Pet[]{return [...CAT_PATHS.map((p,i)=>({kind:'cat' as const,name:['小橘','乌云','奶糖','芝麻'][i],point:p[0]})),...[[12,86],[-98,43],[131,75]].map(([x,z],i)=>({kind:'dog' as const,name:['豆豆','阿黄','小白'][i],point:{x,z}}))].map((v,i)=>{const p=blocked(v.point)?CAT_PATHS[0][0]:v.point;return {...p,id:`pet-${i+1}`,kind:v.kind,name:v.name,ownerId:null,yaw:0,moving:false,fedAt:0,happyAt:0,attackAt:0,homeX:p.x,homeZ:p.z};});}
export function validPetAction(v:unknown):v is PetAction{if(!v||typeof v!=='object')return false;const o=v as Record<string,unknown>;return Object.keys(o).length===2&&typeof o.id==='string'&&o.id.length<32&&['adopt','release','feed'].includes(String(o.kind));}
export function petAction(pet:Pet,player:Player,pets:Pet[],kind:PetAction['kind'],now:number):PetReply{
 if(player.vehicleId||player.shuttleId)return {ok:false,error:'请先下车再互动。'};
 if(kind==='release'){if(pet.ownerId!==player.id)return {ok:false,error:'只能解除自己的认领。'};pet.ownerId=null;pet.homeX=pet.x;pet.homeZ=pet.z;return {ok:true};}
 if(Math.hypot(pet.x-player.x,pet.z-player.z)>PETS.range)return {ok:false,error:'请靠近猫狗再互动。'};
 if(kind==='adopt'){if(pet.ownerId)return {ok:false,error:'它已经被认领了。'};if(pets.some(p=>p.ownerId===player.id&&p.kind===pet.kind))return {ok:false,error:'每人最多认领一只猫和一只狗。'};pet.ownerId=player.id;pet.happyAt=now;}
 else{if(now-pet.fedAt<PETS.feedCooldown)return {ok:false,error:'它还在吃，请稍等一下。'};pet.fedAt=pet.happyAt=now;}
 return {ok:true};
}
const stuckTime=new WeakMap<Pet,number>();
export function stepPet(pet:Pet,owner:Player|undefined,now:number,dt:number){
 if(now-pet.fedAt<1800){pet.moving=false;return;}
 if(pet.ownerId&&!owner){pet.moving=false;return;}
 let target:Point;
 if(owner){target={x:owner.x-Math.sin(owner.yaw)*2+(pet.kind==='cat'?1:-1)*Math.cos(owner.yaw),z:owner.z-Math.cos(owner.yaw)*2-(pet.kind==='cat'?1:-1)*Math.sin(owner.yaw)};if(owner.vehicleId||owner.shuttleId){pet.moving=false;return;}}
 else if(pet.kind==='cat'&&pet.homeX===CAT_PATHS[Number(pet.id.slice(4))-1]?.[0].x&&pet.homeZ===CAT_PATHS[Number(pet.id.slice(4))-1]?.[0].z){target=catPose(now,Number(pet.id.slice(4))-1).point;}
 else{const phase=(now/1000+Number(pet.id.slice(4))*17)*.12;target={x:pet.homeX+Math.sin(phase)*2,z:pet.homeZ+Math.cos(phase)*2};}
 const dx=target.x-pet.x,dz=target.z-pet.z,d=Math.hypot(dx,dz);pet.moving=false;if(d<.35)return;
 // Airdrop/respawn catch-up chooses a safe nearby ground point, never inside walls/water.
 if(owner&&(d>20||(stuckTime.get(pet)||0)>1.5)){for(const offset of[0,Math.PI/2,Math.PI,-Math.PI/2]){const p={x:owner.x+Math.sin(owner.yaw+offset)*3,z:owner.z+Math.cos(owner.yaw+offset)*3};if(!blocked(p)){Object.assign(pet,p);stuckTime.set(pet,0);return;}}}
 const speed=owner?12:4.6,f=Math.min(1,d/(speed*dt));const p=move(pet,{x:dx/d*f,z:dz/d*f,run:!!owner},dt);pet.moving=Math.hypot(p.x-pet.x,p.z-pet.z)>.001;stuckTime.set(pet,pet.moving?0:(stuckTime.get(pet)||0)+dt);Object.assign(pet,p);pet.yaw=Math.atan2(dx,dz);
}
