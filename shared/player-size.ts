import {COMBAT} from './config';
import type {Player} from './types';

// Derive presentation from saved records; physical reach and collision stay fair.
export function playerSize(player:Pick<Player,'kills'|'deaths'>){
 return Math.max(COMBAT.minSize,Math.min(COMBAT.maxSize,1+(player.kills-player.deaths)*COMBAT.sizeStep));
}
