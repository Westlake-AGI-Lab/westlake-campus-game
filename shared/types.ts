import type {Appearance} from './appearance';
export type Point = {x:number;z:number};
export type Confidence = {layout:'observed'|'estimated'|'unknown';dimensions:'observed'|'estimated'|'unknown';appearance:'observed'|'estimated'|'unknown'};
export type Building = {id:string;name:string;codes?:string[];nameAliases?:string[];x:number;z:number;w:number;d:number;h:number;rotation:number;kind:string;color:string;floors:number;sourceIds:string[];confidence:Confidence;radius?:number;innerRadius?:number;outerRadius?:number;arc?:number[];levels?:number[];facadeSlope?:number;columnStep?:number;doorAngles?:number[];doorHalfAngle?:number;parts?:{x:number;z:number;w:number;d:number;h:number;floors?:number;rotation?:number}[];passages?:{x:number;z:number;w:number;d:number}[]};
export type Box = {x:number;z:number;w:number;d:number;rotation:number};
export type Campus = {meta:{name:string;units:string;north:string;scaleStatus:string;bounds:{minX:number;maxX:number;minZ:number;maxZ:number};referenceIds:string[];origin:string};buildings:Building[];roads:{id:string;points:Point[];width:number;style?:string;smooth?:boolean}[];plazas:{id:string;x:number;z:number;w:number;d:number;radius?:number}[];waterBodies:{id:string;outer:Point[];inner:Point[];holes?:Point[][]}[];bridges:(Box&{id:string;points:Point[];rise:number})[];stairs?:(Box&{id:string;rise:number;steps:number;landingD:number})[];waterWalkways?:(Box&{id:string;points:Point[];rise:number})[];vegetationZones:{x:number;z:number;w:number;d:number;count:number}[];walkableSurfaces:{id:string;description:string}[];colliders:Box[];spawnPoints:Point[];validationViews:{id:string;title:string;position:number[];target:number[];fov:number;sourceIds:string[]}[]};
export type Input = {seq:number;x:number;z:number;run:boolean};
export type Fighter={energy:number;guardUntil:number;guardAt:number;dodgeUntil:number;dodgeAt:number;dodgeX:number;dodgeZ:number;heavyUntil:number;stunnedUntil:number;nextAttackAt:number};
export type Player = Point & Fighter & {npc?:boolean;npcRespawnAt?:number;npcWins?:number;npcFalls?:number;shuttleId?:string|null;vehicleId?:string|null;id:string;name:string;color:number;appearance?:Appearance;yaw:number;moving:boolean;ack:number;hp:number;kills:number;deaths:number;life:number;relocation:number;punchAt:number;hitAt:number;protectedUntil:number};
export type Attack = {seq:number;yaw:number;kind?:'light'|'heavy'};
export type CombatAction={seq:number;kind:'guard';active:boolean;yaw:number}|{seq:number;kind:'dodge';x:number;z:number};
export type Punch = {attackerId:string;targetId:string|null;at:number;damage:number;knockout:boolean;kind?:'light'|'heavy';defense?:'block'|'parry'|'break'};
export type AttackReply = {ok:boolean;reason?:'invalid'|'cooldown'|'notJoined'|'stamina'|'busy';charging?:boolean;punch?:Punch};
export type Snapshot = {npcCount?:number;orchard?:import('./fruit').FruitTreeState[];fishing?:import('./fishing').FishingView[];pets?:import('./pets').Pet[];time:number;players:Player[];count:number;vehicles?:import('./vehicles').Vehicle[];shuttles?:import('./shuttle').Shuttle[]};
// username and token are sent only in the joining socket's private acknowledgement.
export type Welcome = {playerId:string;username:string;token:string;snapshot:Snapshot;resumed:boolean};
export type JoinRequest = {mode:'register';username:string;displayName:string;password:string;color:number;appearance?:Appearance}|{mode:'login';username:string;password:string;color:number}|{mode:'resume';token:string;color:number};
export type JoinReply = Welcome|{error:string;code:string};
export type Bubble = {playerId:string;id:string;expiresAt:number};

export type AirdropReply={ok:true;point:Point;adjusted:boolean}|{ok:false;error:string};
export type RouteReply={ok:true;path:Point[];target:Point;distance:number;adjusted:boolean}|{ok:false;error:string};
