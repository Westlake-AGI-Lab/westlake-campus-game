import {COMBAT} from '../shared/config';
import {blocked,campus,heightAt} from '../shared/world';
import type {Attack,Player,Point,CombatAction} from '../shared/types';

export function validateAttack(value:unknown):value is Attack {
 if(!value||typeof value!=='object')return false;
 const v=value as Record<string,unknown>;
 return (Object.keys(v).length===2||Object.keys(v).length===3)&&Object.keys(v).every(k=>['seq','yaw','kind'].includes(k))&&(v.kind===undefined||v.kind==='light'||v.kind==='heavy')&&Number.isSafeInteger(v.seq)&&Number(v.seq)>=0&&Number(v.seq)<1e12&&typeof v.yaw==='number'&&Number.isFinite(v.yaw)&&Math.abs(v.yaw)<=Math.PI;
}

export function punchLineClear(a:Point,b:Point){
 const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.18));
 for(let n=0;n<=steps;n++)if(blocked({x:a.x+(b.x-a.x)*n/steps,z:a.z+(b.z-a.z)*n/steps}))return false;
 return true;
}

export function punchTarget(attacker:Player,players:Iterable<Player>,now:number):Player|undefined {
 const candidates=[...players].filter(p=>{
  if((p.vehicleId||p.shuttleId)||(attacker.vehicleId||attacker.shuttleId)||p.id===attacker.id||p.hp<=0||p.protectedUntil>now||p.dodgeUntil>now)return false;
  const dx=p.x-attacker.x,dz=p.z-attacker.z,d=Math.hypot(dx,dz);
  return d<=COMBAT.punchRange&&(d<.01||(dx*Math.sin(attacker.yaw)+dz*Math.cos(attacker.yaw))/d>=Math.cos(COMBAT.punchHalfAngle))&&Math.abs(heightAt(attacker)-heightAt(p))<1.5;
 }).sort((a,b)=>Math.hypot(a.x-attacker.x,a.z-attacker.z)-Math.hypot(b.x-attacker.x,b.z-attacker.z));
 return candidates.find(p=>punchLineClear(attacker,p));
}

export function respawnPoints():Point[]{
 const points:Point[]=campus.spawnPoints.map(p=>({...p})),seen=new Set<string>();
 for(const road of campus.roads){
  if(road.id.startsWith('waterside-'))continue;
  for(let n=1;n<road.points.length;n++){
   const a=road.points[n-1],b=road.points[n],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/12));
   for(let i=0;i<=steps;i++){
    const p={x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps},key=Math.round(p.x/3)+':'+Math.round(p.z/3);
    if(!seen.has(key)&&heightAt(p)<.05&&!blocked(p)){seen.add(key);points.push(p);}
   }
  }
 }
 return points;
}

export function chooseRespawn(current:Point,others:Iterable<Point>,points:Point[],random=Math.random):Point {
 const occupants=[...others],clear=points.filter(p=>occupants.every(o=>Math.hypot(o.x-p.x,o.z-p.z)>3));
 const distant=clear.filter(p=>Math.hypot(p.x-current.x,p.z-current.z)>=COMBAT.respawnMinDistance);
 const pool=distant.length?distant:clear.length?clear:points;
 if(!pool.length)throw Error('No safe respawn positions');
 return {...pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]};
}

// Only online simulation calls this. Integer healing has no client authority.
export function regenerateHealth(player:Player,now:number,previous:number){
 const start=Math.max(previous,Math.max(player.hitAt,player.punchAt)+COMBAT.regenDelayMs);
 if(now<start)return start;
 const intervals=Math.floor((now-start)/COMBAT.regenIntervalMs);
 if(intervals>0&&player.hp>0)player.hp=Math.min(COMBAT.maxHealth,player.hp+intervals*COMBAT.regenHealth);
 return start+intervals*COMBAT.regenIntervalMs;
}


export function validateCombatAction(value:unknown):value is CombatAction{
 if(!value||typeof value!=='object')return false;
 const v=value as Record<string,unknown>;
 if(!Number.isSafeInteger(v.seq)||Number(v.seq)<0||Number(v.seq)>=1e12)return false;
 if(v.kind==='guard')return Object.keys(v).length===4&&Object.keys(v).every(k=>['seq','kind','active','yaw'].includes(k))&&typeof v.active==='boolean'&&typeof v.yaw==='number'&&Number.isFinite(v.yaw)&&Math.abs(v.yaw)<=Math.PI;
 return v.kind==='dodge'&&Object.keys(v).length===4&&Object.keys(v).every(k=>['seq','kind','x','z'].includes(k))&&typeof v.x==='number'&&Number.isFinite(v.x)&&typeof v.z==='number'&&Number.isFinite(v.z)&&Math.hypot(v.x,v.z)>.01&&Math.hypot(v.x,v.z)<=1.001;
}
export function resolveDefense(attacker:Player,target:Player,kind:'light'|'heavy',now:number){
 const dx=attacker.x-target.x,dz=attacker.z-target.z,d=Math.hypot(dx,dz);
 const guarding=target.guardUntil>now&&target.energy>0&&(d<.01||(dx*Math.sin(target.yaw)+dz*Math.cos(target.yaw))/d>=Math.cos(Math.PI/3));
 if(!guarding)return {damage:kind==='heavy'?COMBAT.heavyDamage:COMBAT.punchDamage};
 if(kind==='heavy'){target.guardUntil=0;target.stunnedUntil=now+COMBAT.guardBreakMs;target.energy=Math.max(0,target.energy-20);return {damage:COMBAT.heavyGuardDamage,defense:'break' as const};}
 if(now-target.guardAt<=COMBAT.parryWindowMs){attacker.stunnedUntil=now+COMBAT.parryStunMs;attacker.guardUntil=0;return {damage:0,defense:'parry' as const};}
 target.energy=Math.max(0,target.energy-10);if(target.energy===0)target.guardUntil=0;
 return {damage:COMBAT.guardDamage,defense:'block' as const};
}
