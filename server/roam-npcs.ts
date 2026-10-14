import {blocked,move} from '../shared/world';import {fighterState} from '../shared/fighter';import {defaultAppearance} from '../shared/appearance';import {APPROVED_NAMES} from '../shared/names';import {punchLineClear} from './combat';import type {Player,Point} from '../shared/types';
export const ROAM_NPC={max:4,damageScale:.24,cooldownMs:1400,respawnMs:3000,thinkMs:200,aggroMs:12000,speed:2.2};
type Brain={player:Player;anchor:Point;goal:Point;enemy:string;aggroUntil:number;thinkAt:number;rehomeAt:number;respawnAt:number};
export class RoamNpcs{
 private brains:Brain[]=[];
 constructor(private safe:(p:Point)=>boolean){ }
 players(){return this.brains.map(b=>b.player);}
 private nearby(owner:Point,index:number){for(const r of[6,10,16,24])for(let n=0;n<16;n++){const a=(index*4+n)*Math.PI/8,p={x:owner.x+Math.sin(a)*r,z:owner.z+Math.cos(a)*r};if(!blocked(p)&&this.safe(p)&&this.brains.every(b=>Math.hypot(b.player.x-p.x,b.player.z-p.z)>2))return p;}}
 sync(humans:Player[],now:number){const desired=Math.min(ROAM_NPC.max,humans.length*2);this.brains.length=Math.min(desired,this.brains.length);while(this.brains.length<desired){const i=this.brains.length,owner=humans[Math.floor(i/2)%humans.length],p=this.nearby(owner,i);if(!p)break;const appearance={...defaultAppearance(i),outfit:i%4,accessory:(i+1)%5};this.brains.push({player:{...fighterState(),...p,id:'npc:campus:'+i,name:APPROVED_NAMES[100+i*137],npc:true,color:i,appearance,yaw:0,moving:false,ack:0,hp:100,kills:0,deaths:0,life:0,relocation:0,punchAt:0,hitAt:0,protectedUntil:0},anchor:p,goal:p,enemy:'',aggroUntil:0,thinkAt:0,rehomeAt:now+5000,respawnAt:0});}}
 provoke(id:string,attacker:Player,now:number){const b=this.brains.find(b=>b.player.id===id);if(b&&!attacker.npc){b.enemy=attacker.id;b.aggroUntil=now+ROAM_NPC.aggroMs;b.player.nextAttackAt=Math.max(b.player.nextAttackAt,now+700);}}
 knockedOut(id:string,now:number){const b=this.brains.find(b=>b.player.id===id);if(b){b.respawnAt=now+ROAM_NPC.respawnMs;b.player.npcRespawnAt=b.respawnAt;b.player.moving=false;b.enemy='';}}
 step(humans:Player[],now:number,attack:(p:Player)=>void){
  this.sync(humans,now);for(const [i,b]of this.brains.entries()){const p=b.player;if(p.hp<=0){if(now<b.respawnAt)continue;const point=this.nearby(humans[Math.floor(i/2)%humans.length],i);if(!point)continue;Object.assign(p,point,fighterState(),{hp:100,life:p.life+1,hitAt:0,punchAt:0,protectedUntil:now+2000,npcRespawnAt:0});b.anchor={...point};b.goal={...point};b.rehomeAt=now+5000;}
   let target=b.aggroUntil>now?humans.find(h=>h.id===b.enemy&&!h.vehicleId&&!h.shuttleId&&Math.hypot(h.x-p.x,h.z-p.z)<24):undefined;
   if(!target)b.enemy='';if(!target&&now>=b.rehomeAt){b.rehomeAt=now+5000;if(humans.every(h=>Math.hypot(h.x-p.x,h.z-p.z)>70)){const point=this.nearby(humans[Math.floor(i/2)%humans.length],i);if(point){Object.assign(p,point,{relocation:p.relocation+1});b.anchor=point;b.goal=point;}}}
   if(now<b.thinkAt)continue;const dt=ROAM_NPC.thinkMs/1000;b.thinkAt=now+ROAM_NPC.thinkMs;if(p.stunnedUntil>now){p.moving=false;continue;}
   const distance=target?Math.hypot(target.x-p.x,target.z-p.z):Infinity;
   if(target&&distance<=2.3&&punchLineClear(p,target)){p.yaw=Math.atan2(target.x-p.x,target.z-p.z);p.moving=false;if(target.protectedUntil<=now&&target.dodgeUntil<=now&&p.nextAttackAt<=now){p.nextAttackAt=now+ROAM_NPC.cooldownMs;p.punchAt=now;attack(p);}continue;}
   if(!target&&Math.hypot(p.x-b.goal.x,p.z-b.goal.z)<.5){const a=(i*2+Math.floor(now/4000))*1.7;b.goal={x:b.anchor.x+Math.sin(a)*4,z:b.anchor.z+Math.cos(a)*4};}
   const goal=target||b.goal,a=Math.atan2(goal.x-p.x,goal.z-p.z);let moved=false;for(const offset of[0,.6,-.6,1.2,-1.2]){const angle=a+offset,next=move(p,{x:Math.sin(angle)*ROAM_NPC.speed/4.6,z:Math.cos(angle)*ROAM_NPC.speed/4.6,run:false},dt);if(Math.hypot(next.x-p.x,next.z-p.z)>.01&&this.safe(next)){Object.assign(p,next,{yaw:angle});moved=true;break;}}p.moving=moved;
  }
 }
}
