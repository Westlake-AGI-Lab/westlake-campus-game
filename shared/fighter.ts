import {COMBAT,CONFIG} from './config';
import {move} from './world';
import type {Fighter,Player,Input} from './types';
export const fighterState=():Fighter=>({energy:COMBAT.maxEnergy,guardUntil:0,guardAt:0,dodgeUntil:0,dodgeAt:0,dodgeX:0,dodgeZ:0,heavyUntil:0,stunnedUntil:0,nextAttackAt:0});
export function fighterMovement(player:Player,input:Pick<Input,'x'|'z'|'run'>,dt:number,now:number){
 if(player.stunnedUntil>now)return {x:player.x,z:player.z};
 if(player.dodgeUntil>now)return move(player,{x:player.dodgeX,z:player.dodgeZ,run:true},dt*COMBAT.dodgeSpeed/CONFIG.runSpeed);
 const slow=player.guardUntil>now?.35:player.heavyUntil>now?.4:1;
 return move(player,{x:input.x*slow,z:input.z*slow,run:slow===1&&input.run},dt);
}
export function fighterStatus(player:Player,now:number){
 return player.stunnedUntil>now?'硬直':player.heavyUntil>now?'重拳蓄力':player.dodgeUntil>now?'闪避':player.guardUntil>now?'格挡':'';
}
