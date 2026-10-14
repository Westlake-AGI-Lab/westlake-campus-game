import {RoamNpcs,ROAM_NPC} from './roam-npcs';
import {Orchard} from '../shared/fruit';
import {FishingRoom,FISHING} from '../shared/fishing';
import {petAction,validPetAction,stepPet,PETS,type Pet} from '../shared/pets';
import {createShuttles,stepShuttleTraffic,shuttleBody,shuttleExit,shuttleContains,validShuttleAction,SHUTTLE,SHUTTLE_ROUTE,type Shuttle,type ShuttleReply} from '../shared/shuttle';
import {createVehicles,validDrive,validVehicleAction,stepVehicle,vehicleExit,vehicleContains,VEHICLE,type Vehicle,type DriveInput,type VehicleReply} from '../shared/vehicles';
import {defaultAppearance} from '../shared/appearance';
import {fighterState,fighterMovement} from '../shared/fighter';
import {landingPoint,validMapPoint} from '../shared/navigation';
import {Server, type Socket} from 'socket.io';
import type {Server as HttpServer} from 'node:http';
import {CONFIG,COMBAT,COLORS,MESSAGES} from '../shared/config';
import {campus,validateInput,blocked} from '../shared/world';
import type {Player,Input,Snapshot,Punch,AttackReply,Point} from '../shared/types';
import {validateAttack,punchTarget,respawnPoints,chooseRespawn,regenerateHealth,validateCombatAction,resolveDefense} from './combat';
import {AccountStore,AccountError} from './accounts';
type Session={lastShuttleSeq:number;lastShuttleAction:number;drive:DriveInput;lastDrive:number;lastDriveSeq:number;lastVehicleSeq:number;lastVehicleAction:number;player:Player;token:string;socketId:string;input:Input;lastInput:number;lastChat:number;budgetStart:number;inputs:number;lastSeq:number;lastAttackSeq:number;lastTeleport:number;regenAt:number;effortAt:number;lastActionSeq:number;actionWindow:number;actions:number;joined:number};
export function createGame(http:HttpServer,options:{databasePath?:string;presence?:Set<string>;npcs?:boolean;initialTraffic?:{vehicles:Vehicle[];shuttles:Shuttle[]}}={}){
 const accounts=new AccountStore(options.databasePath),pendingAuth=new Set<Promise<void>>();let closing=false;
 const io=new Server(http,{maxHttpBufferSize:4096,pingInterval:CONFIG.pingInterval,pingTimeout:CONFIG.pingTimeout,serveClient:false});
 const sessions=new Map<string,Session>(),recoveries=new Map<string,{player:Player;expires:number;lastChat:number}>();
 const fishing=new FishingRoom(),orchard=new Orchard();
 const pets=accounts.loadPets(),dogTargets=new Map<string,{targetId:string;until:number}>(),petBudgets=new Map<string,number>();
 const vehicles=options.initialTraffic?.vehicles.map(v=>({...v}))||createVehicles(),shuttles=options.initialTraffic?.shuttles.map(b=>({...b,passengerIds:[...b.passengerIds]}))||createShuttles(Date.now());const spawnPool=respawnPoints();
 const npcs=new RoamNpcs(p=>!vehicles.some(v=>vehicleContains(v,p,.8))&&!shuttles.some(b=>shuttleContains(b,p,1))&&!SHUTTLE_ROUTE.some(q=>Math.abs(q.x-p.x)<7&&Math.abs(q.z-p.z)<7));
 const safeLanding=(requested:Point,people:Point[]=[])=>{const point=landingPoint(requested,people);if(!point)return;const car=vehicles.find(v=>vehicleContains(v,point));if(car)return vehicleExit(car,vehicles,people,p=>shuttles.every(b=>!shuttleContains(b,p)));const bus=shuttles.find(b=>shuttleContains(b,point));return bus?shuttleExit(bus,vehicles,shuttles,people):point;};
 let ticks=0,rejected=0;const authBudgets=new Map<string,{since:number;count:number}>();
 const fighters=()=>[...sessions.values()].map(s=>s.player).concat(npcs.players());
 const snapshot=():Snapshot=>({npcCount:npcs.players().length,time:Date.now(),orchard:orchard.snapshot(),fishing:fishing.snapshot(),pets:pets.map(p=>({...p})),players:fighters().map(p=>({...p,appearance:p.appearance?{...p.appearance}:undefined})),count:sessions.size,vehicles:vehicles.map(v=>({...v})),shuttles:shuttles.map(b=>({...b,passengerIds:[...b.passengerIds]}))});
 const publish=()=>io.emit('world',snapshot());
 const releaseVehicle=(s:Session,force=false)=>{
  const car=vehicles.find(v=>v.id===s.player.vehicleId);if(!car){s.player.vehicleId=null;return true;}
  const people=[...sessions.values()].filter(o=>o!==s).map(o=>o.player);
  const point=vehicleExit(car,vehicles,people,p=>shuttles.every(b=>!shuttleContains(b,p)))||(force?safeLanding(car,people)||safeLanding(campus.spawnPoints[0],people):undefined);if(!point)return false;
  car.driverId=null;car.speed=0;s.player.vehicleId=null;Object.assign(s.player,point,{moving:false,relocation:s.player.relocation+1});s.input={seq:s.lastSeq,x:0,z:0,run:false};s.lastInput=0;s.drive={seq:s.lastDriveSeq,throttle:0,steer:0,brake:true};return true;
 };
 const releaseShuttle=(s:Session,force=false)=>{
  const bus=shuttles.find(b=>b.id===s.player.shuttleId);if(!bus){s.player.shuttleId=null;return true;}
  const people=[...sessions.values()].filter(o=>o!==s&&!o.player.shuttleId&&!o.player.vehicleId).map(o=>o.player);
  const point=shuttleExit(bus,vehicles,shuttles,people)||(force?safeLanding(campus.spawnPoints[0],people):undefined);if(!point)return false;
  bus.passengerIds=bus.passengerIds.filter(id=>id!==s.player.id);bus.speed=0;bus.dwellUntil=Math.max(bus.dwellUntil,Date.now()+SHUTTLE.exitPauseMs);s.player.shuttleId=null;Object.assign(s.player,point,{moving:false,relocation:s.player.relocation+1});s.input={seq:s.lastSeq,x:0,z:0,run:false};s.lastInput=0;return true;
 };
 const remove=(socket:Socket,allowResume:boolean)=>{const s=sessions.get(socket.id);if(!s)return;releaseVehicle(s,true);releaseShuttle(s,true);s.player.guardUntil=s.player.heavyUntil=s.player.dodgeUntil=0;accounts.save([s.player]);sessions.delete(socket.id);if(options.npcs)npcs.sync([...sessions.values()].map(s=>s.player),Date.now());options.presence?.delete(s.player.id);fishing.remove(s.player.id);orchard.remove(s.player.id);petBudgets.delete(socket.id);for(const p of pets.filter(p=>p.ownerId===s.player.id))dogTargets.delete(p.id);accounts.savePets(pets);if(allowResume)recoveries.set(s.token,{player:{...s.player,moving:false},expires:Date.now()+CONFIG.resumeMs,lastChat:s.lastChat});publish();};
 const strike=(s:Pick<Session,'player'>,kind:'light'|'heavy',now:number,dog?:Pet,dogTarget?:Player)=>{
  const target=dog?dogTarget:punchTarget(s.player,fighters().filter(p=>!s.player.npc||!p.npc),now);
  const result=target?resolveDefense(dog?{...s.player,...dog,yaw:Math.atan2(target.x-dog.x,target.z-dog.z)}:s.player,target,kind,now):{damage:0};
  if(s.player.npc)result.damage=Math.ceil(result.damage*ROAM_NPC.damageScale);
  if(dog)result.damage=Math.min(PETS.assistDamage,result.damage);
  else if(target)for(const pet of pets.filter(p=>p.kind==='dog'&&p.ownerId===s.player.id))dogTargets.set(pet.id,{targetId:target.id,until:now+PETS.assistWindow});
  const punch:Punch={attackerId:s.player.id,targetId:target?.id||null,at:now,damage:result.damage,knockout:false,kind,...('defense' in result?{defense:result.defense}: {})};
  if(target){
   target.hp=Math.max(0,target.hp-result.damage);target.hitAt=now;
   const victim=[...sessions.values()].find(v=>v.player.id===target.id);if(victim)victim.effortAt=now;if(target.npc)npcs.provoke(target.id,s.player,now);
   if(target.hp===0){
    punch.knockout=true;
    if(target.npc){s.player.npcWins=(s.player.npcWins||0)+1;npcs.knockedOut(target.id,now);}
    else{if(s.player.npc)target.npcFalls=(target.npcFalls||0)+1;else{s.player.kills++;target.deaths++;}target.life++;
     Object.assign(target,chooseRespawn(target,fighters().filter(p=>p.id!==target.id),spawnPool),fighterState(),{hp:COMBAT.maxHealth,moving:false,hitAt:0,protectedUntil:now+COMBAT.respawnProtectionMs});
     if(victim){victim.input={seq:victim.lastSeq,x:0,z:0,run:false};victim.lastInput=0;}
    }
    accounts.save([s.player,target].filter(p=>!p.npc));
   }
  }
  io.emit('punch',punch);publish();return punch;
 };
 io.on('connection',socket=>{
   let joining=false;
   socket.on('join',(v:unknown,ack?:Function)=>{
    const reply=(error:string,code='invalid')=>{if(typeof ack==='function')ack({error,code});};
    if(joining||sessions.has(socket.id)){reply('这个页面已经在校园中。');return;}
    if(closing||sessions.size>=CONFIG.maxPlayers){reply('房间已满，请稍后再试。','full');return;}
    if(!v||typeof v!=='object'||JSON.stringify(v).length>1500){rejected++;reply('登录信息不正确。');return;}
    const o=v as Record<string,unknown>,resume=o.mode==='resume',credentials=o.mode==='register'||o.mode==='login';
    const legacyLogin=o.mode==='login'&&o.username===undefined&&typeof o.name==='string';
    const allowed=resume?['mode','token','color']:o.mode==='register'?['mode','username','displayName','password','color','appearance']:legacyLogin?['mode','name','password','color']:['mode','username','password','color'];
    if((!resume&&!credentials)||Object.keys(o).some(k=>!allowed.includes(k))){rejected++;reply('登录用户名与显示名字已分开，请刷新页面后注册或登录。');return;}
    if(!Number.isInteger(o.color)||Number(o.color)<0||Number(o.color)>=COLORS.length){reply('请选择一件外套。');return;}
    if(credentials){const ip=socket.handshake.address,now=Date.now();let budget=authBudgets.get(ip);if(!budget||now-budget.since>60000){budget={since:now,count:0};authBudgets.set(ip,budget);}if(++budget.count>CONFIG.maxAuthPerMinute){reply('登录或注册过于频繁，请一分钟后再试。','rate');return;}}
    joining=true;
    const task=(async()=>{
     try{
      const spawn=campus.spawnPoints[sessions.size%campus.spawnPoints.length];
      const account=resume?accounts.resume(o.token):o.mode==='register'?await accounts.register(o.username,o.displayName,o.password,spawn,o.appearance===undefined?defaultAppearance(Number(o.color)):o.appearance):await accounts.login(legacyLogin?o.name:o.username,o.password);
      if(closing||!socket.connected)return;
      if(sessions.size>=CONFIG.maxPlayers){reply('房间已满，请稍后再试。','full');return;}
      if(options.presence?.has(account.id)||[...sessions.values()].some(s=>s.player.id===account.id)){reply('这个账号已在另一页面在线，请先退出后再登录。','online');return;}
      const appearance=accounts.resolveAppearance(account.id,Number(o.color));
      const now=Date.now(),previous=resume?recoveries.get(String(o.token)):undefined;
      const token=resume?String(o.token):accounts.issueToken(account.id),position=blocked(account)?spawn:(vehicles.some(v=>vehicleContains(v,account))||shuttles.some(b=>shuttleContains(b,account)))?safeLanding(account)||spawn:account;
      const player:Player=previous&&previous.expires>now?{...previous.player,x:position.x,z:position.z,vehicleId:null,shuttleId:null,name:account.displayName,color:appearance.coat,appearance,ack:-1,moving:false}:{...fighterState(),vehicleId:null,shuttleId:null,x:position.x,z:position.z,id:account.id,name:account.displayName,color:appearance.coat,appearance,yaw:Math.PI,moving:false,ack:-1,hp:COMBAT.maxHealth,kills:account.kills,deaths:account.deaths,life:0,relocation:0,punchAt:0,hitAt:0,protectedUntil:0};
      if(previous)recoveries.delete(String(o.token));
      accounts.save([player]);
      options.presence?.add(account.id);
      sessions.set(socket.id,{lastShuttleSeq:-1,lastShuttleAction:0,drive:{seq:-1,throttle:0,steer:0,brake:true},lastDrive:0,lastDriveSeq:-1,lastVehicleSeq:-1,lastVehicleAction:0,player,token,socketId:socket.id,input:{seq:-1,x:0,z:0,run:false},lastInput:0,lastChat:previous?.lastChat||0,budgetStart:now,inputs:0,lastSeq:-1,lastAttackSeq:-1,lastTeleport:0,regenAt:now,effortAt:now,lastActionSeq:-1,actionWindow:now,actions:0,joined:now});
      if(options.npcs)npcs.sync([...sessions.values()].map(s=>s.player),now);socket.join(player.id);if(typeof ack==='function')ack({playerId:player.id,username:account.username,token,snapshot:snapshot(),resumed:resume||o.mode==='login'});publish();
     }catch(error){if(error instanceof AccountError)reply(error.message,error.code);else{console.error('Account operation failed:',error instanceof Error?error.message:'unknown');reply('账号服务暂不可用，请稍后再试。','unavailable');}}
     finally{joining=false;}
    })();pendingAuth.add(task);void task.finally(()=>pendingAuth.delete(task));
   });
   socket.on('input',(v:unknown)=>{const s=sessions.get(socket.id);if(!s)return;const now=Date.now();if(now-s.budgetStart>=1000){s.budgetStart=now;s.inputs=0;}if(++s.inputs>CONFIG.maxInputsPerSecond||!validateInput(v)||v.seq<=s.lastSeq){rejected++;return;}s.input=v;s.lastSeq=v.seq;s.lastInput=now;});
   socket.on('drive',(value:unknown)=>{const s=sessions.get(socket.id);if(!s||!s.player.vehicleId)return;const now=Date.now();if(now-s.budgetStart>=1000){s.budgetStart=now;s.inputs=0;}if(++s.inputs>CONFIG.maxInputsPerSecond||!validDrive(value)||value.seq<=s.lastDriveSeq){rejected++;return;}s.drive=value;s.lastDriveSeq=value.seq;s.lastDrive=now;});
   socket.on('vehicle',(value:unknown,ack?:unknown)=>{
    const reply=(r:VehicleReply)=>{if(typeof ack==='function')ack(r);},s=sessions.get(socket.id),now=Date.now();
    if(!s){reply({ok:false,error:'请先登录校园。'});return;}
    if(!validVehicleAction(value)||value.seq<=s.lastVehicleSeq){rejected++;reply({ok:false,error:'车辆操作不正确。'});return;}s.lastVehicleSeq=value.seq;
    if(now-s.lastVehicleAction<400){reply({ok:false,error:'请稍候再操作车辆。'});return;}s.lastVehicleAction=now;
    if(value.kind==='exit'){if(!s.player.vehicleId){reply({ok:false,error:'你还没有上车。'});return;}if(!releaseVehicle(s)){reply({ok:false,error:'车旁暂时没有安全下车位置，请挪动车辆后再试。'});return;}}
    else{
     if(s.player.vehicleId||s.player.shuttleId){reply({ok:false,error:'请先下车。'});return;}
     const car=vehicles.find(v=>v.id===value.vehicleId);
     if(!car||car.driverId||Math.hypot(car.x-s.player.x,car.z-s.player.z)>VEHICLE.enterRange){reply({ok:false,error:'请靠近一辆空车后上车。'});return;}
     if(Math.max(s.player.heavyUntil,s.player.dodgeUntil,s.player.stunnedUntil,s.player.guardUntil)>now){reply({ok:false,error:'请等当前动作结束再上车。'});return;}
     car.driverId=s.player.id;car.speed=0;s.player.vehicleId=car.id;Object.assign(s.player,{x:car.x,z:car.z,yaw:car.yaw,moving:false,relocation:s.player.relocation+1});s.drive={seq:s.lastDriveSeq,throttle:0,steer:0,brake:true};s.lastDrive=0;s.input={seq:s.lastSeq,x:0,z:0,run:false};s.player.guardUntil=s.player.heavyUntil=s.player.dodgeUntil=0;
    }
    accounts.save([s.player]);publish();reply({ok:true});
   });
   socket.on('shuttle',(value:unknown,ack?:unknown)=>{
    const reply=(r:ShuttleReply)=>{if(typeof ack==='function')ack(r);},s=sessions.get(socket.id),now=Date.now();
    if(!s){reply({ok:false,error:'请先登录校园。'});return;}
    if(!validShuttleAction(value)||value.seq<=s.lastShuttleSeq){rejected++;reply({ok:false,error:'校车操作不正确。'});return;}s.lastShuttleSeq=value.seq;
    if(now-s.lastShuttleAction<400){reply({ok:false,error:'请稍候再操作校车。'});return;}s.lastShuttleAction=now;
    if(value.kind==='exit'){if(!s.player.shuttleId){reply({ok:false,error:'你还没有乘坐校车。'});return;}if(!releaseShuttle(s)){reply({ok:false,error:'车旁暂时拥挤，请稍候选择安全位置下车。'});return;}}
    else{
     if(s.player.vehicleId||s.player.shuttleId){reply({ok:false,error:'请先下车。'});return;}
     const bus=shuttles.find(b=>b.id===value.shuttleId);
     if(!bus||Math.hypot(bus.x-s.player.x,bus.z-s.player.z)>SHUTTLE.enterRange){reply({ok:false,error:'请靠近校车后上车。'});return;}
     if(bus.passengerIds.length>=SHUTTLE.capacity){reply({ok:false,error:'这辆校车已满，请乘坐另一辆。'});return;}
     if(Math.max(s.player.heavyUntil,s.player.dodgeUntil,s.player.stunnedUntil,s.player.guardUntil)>now){reply({ok:false,error:'请等当前动作结束再乘车。'});return;}
     bus.passengerIds.push(s.player.id);s.player.shuttleId=bus.id;Object.assign(s.player,{x:bus.x,z:bus.z,yaw:bus.yaw,moving:false,relocation:s.player.relocation+1});s.player.guardUntil=s.player.heavyUntil=s.player.dodgeUntil=0;s.input={seq:s.lastSeq,x:0,z:0,run:false};s.lastInput=0;
    }
    accounts.save([s.player]);publish();reply({ok:true});
   });
   socket.on('leaderboard',(value:unknown,ack?:Function)=>{
    if(typeof ack!=='function')return;const s=sessions.get(socket.id);if(!s){ack({ok:false,error:'请先登录。'});return;}
    if(!value||typeof value!=='object'){ack({ok:false,error:'榜单请求无效。'});return;}
    const v=value as {kind:unknown;page:unknown};if((v.kind!=='kills'&&v.kind!=='deaths')||!Number.isSafeInteger(v.page)||Number(v.page)<0){ack({ok:false,error:'榜单请求无效。'});return;}
    const now=Date.now();if(now-s.actionWindow>=1000){s.actionWindow=now;s.actions=0;}if(++s.actions>30){ack({ok:false,error:'请稍等再刷新。'});return;}
    ack({ok:true,board:accounts.leaderboard(v.kind,Number(v.page),s.player.id)});
   });
   socket.on('fruit-pick' ,(value:unknown,ack?:Function)=>{const s=sessions.get(socket.id);if(!s){if(typeof ack==='function')ack({ok:false,error:'请先登录。'});return;}const now=Date.now();if(now-s.actionWindow>=1000){s.actionWindow=now;s.actions=0;}if(++s.actions>30){if(typeof ack==='function')ack({ok:false,error:'请稍等。'});return;}const result=orchard.pick(s.player,value,now);if(typeof ack==='function')ack(result);if(result.ok)publish();});
   socket.on('fishing',(value:unknown,ack?:Function)=>{const s=sessions.get(socket.id);if(!s){if(typeof ack==='function')ack({ok:false,error:'请先登录。'});return;}const now=Date.now();if(now-s.actionWindow>=1000){s.actionWindow=now;s.actions=0;}if(++s.actions>30){if(typeof ack==='function')ack({ok:false,error:'操作太快，请稍等。'});return;}const result=fishing.action(s.player,value,now);if(result.ok&&value&&typeof value==='object'&&(value as {kind:string}).kind==='cast'){s.input={seq:s.lastSeq,x:0,z:0,run:false};s.lastInput=0;s.player.yaw=Math.atan2(FISHING.water.x-s.player.x,FISHING.water.z-s.player.z);}if(typeof ack==='function')ack(result);if(result.ok)publish();});
   socket.on('pet',(value:unknown,ack?:Function)=>{const s=sessions.get(socket.id),now=Date.now();const reply=(r:unknown)=>{if(typeof ack==='function')ack(r);};if(!s||!validPetAction(value)){reply({ok:false,error:'互动信息无效。'});return;}if(now-(petBudgets.get(socket.id)||0)<400){reply({ok:false,error:'请稍等再互动。'});return;}petBudgets.set(socket.id,now);const pet=pets.find(p=>p.id===value.id);if(!pet){reply({ok:false,error:'没有找到它。'});return;}const result=petAction(pet,s.player,pets,value.kind,now);if(result.ok){if(value.kind==='release')dogTargets.delete(pet.id);accounts.savePets(pets);publish();}reply(result);});
   socket.on('attack',(v:unknown,ack?:unknown)=>{
    const reply=(r:AttackReply)=>{if(typeof ack==='function')ack(r);},s=sessions.get(socket.id),now=Date.now();
    if(!s){reply({ok:false,reason:'notJoined'});return;}
    if(s.player.vehicleId||s.player.shuttleId){reply({ok:false,reason:'busy'});return;}
    if(!validateAttack(v)||v.seq<=s.lastAttackSeq){rejected++;reply({ok:false,reason:'invalid'});return;}
    s.lastAttackSeq=v.seq;
    if(s.player.nextAttackAt>now){reply({ok:false,reason:'cooldown'});return;}
    if(s.player.stunnedUntil>now||s.player.dodgeUntil>now||s.player.guardUntil>now||s.player.heavyUntil>now){reply({ok:false,reason:'busy'});return;}
    const kind=v.kind||'light',cost=kind==='heavy'?COMBAT.heavyEnergy:COMBAT.lightEnergy;
    if(s.player.energy<cost){reply({ok:false,reason:'stamina'});return;}
    s.player.energy-=cost;s.effortAt=now;s.player.yaw=v.yaw;s.player.punchAt=now;s.player.protectedUntil=0;
    s.player.nextAttackAt=now+(kind==='heavy'?COMBAT.heavyCooldownMs:COMBAT.punchCooldownMs);
    if(kind==='heavy'){s.player.heavyUntil=now+COMBAT.heavyWindupMs;publish();reply({ok:true,charging:true});}
    else reply({ok:true,punch:strike(s,kind,now)});
   });
   socket.on('combat',(value:unknown,ack?:unknown)=>{
    const reply=(r:AttackReply)=>{if(typeof ack==='function')ack(r);},s=sessions.get(socket.id),now=Date.now();
    if(!s){reply({ok:false,reason:'notJoined'});return;}
    if(now-s.actionWindow>=1000){s.actionWindow=now;s.actions=0;}
    if(++s.actions>30||!validateCombatAction(value)||value.seq<=s.lastActionSeq){rejected++;reply({ok:false,reason:'invalid'});return;}
    s.lastActionSeq=value.seq;const p=s.player;if(p.vehicleId||p.shuttleId){reply({ok:false,reason:'busy'});return;}
    if(value.kind==='guard'&&!value.active){p.guardUntil=0;reply({ok:true});return;}
    if(p.stunnedUntil>now||p.heavyUntil>now||p.dodgeUntil>now){reply({ok:false,reason:'busy'});return;}
    if(value.kind==='guard'){
     if(p.guardUntil<=now){
      if(now-p.guardAt<COMBAT.guardRepeatMs){reply({ok:false,reason:'cooldown'});return;}
      if(p.energy<COMBAT.guardStartEnergy){reply({ok:false,reason:'stamina'});return;}
      p.energy-=COMBAT.guardStartEnergy;p.guardAt=now;
     }
     if(p.energy<=0){reply({ok:false,reason:'stamina'});return;}
     p.yaw=value.yaw;p.guardUntil=now+COMBAT.guardLeaseMs;s.effortAt=now;
    }else{
     if(now-p.dodgeAt<COMBAT.dodgeCooldownMs){reply({ok:false,reason:'cooldown'});return;}
     if(p.energy<COMBAT.dodgeEnergy){reply({ok:false,reason:'stamina'});return;}
     const len=Math.hypot(value.x,value.z);p.energy-=COMBAT.dodgeEnergy;p.dodgeAt=now;p.dodgeUntil=now+COMBAT.dodgeDurationMs;p.dodgeX=value.x/len;p.dodgeZ=value.z/len;p.guardUntil=0;p.protectedUntil=0;s.effortAt=now;
    }
    reply({ok:true});
   });
   socket.on('say',(id:unknown)=>{const s=sessions.get(socket.id);if(!s)return;const now=Date.now();if(typeof id!=='string'||!Object.hasOwn(MESSAGES,id)||now-s.lastChat<CONFIG.chatCooldownMs){rejected++;return;}s.lastChat=now;const bubble={playerId:s.player.id,id,expiresAt:now+CONFIG.chatDurationMs};for(const other of sessions.values())if(Math.hypot(other.player.x-s.player.x,other.player.z-s.player.z)<=CONFIG.chatRadius)io.to(other.socketId).emit('bubble',bubble);});
   socket.on('airdrop',(value:unknown,ack?:unknown)=>{
    const reply=(v:unknown)=>{if(typeof ack==='function')ack(v);},s=sessions.get(socket.id),now=Date.now();
    if(!s){reply({ok:false,error:'请先登录校园。'});return;}
    if(s.player.vehicleId||s.player.shuttleId){reply({ok:false,error:'请先下车再空降。'});return;}
    if(s.player.heavyUntil>now||s.player.dodgeUntil>now||s.player.stunnedUntil>now){reply({ok:false,error:'请等当前战斗动作结束后再空降。'});return;}
    if(!validMapPoint(value)){rejected++;reply({ok:false,error:'请选择校园地图内的位置。'});return;}
    if(now-s.lastTeleport<1500){reply({ok:false,error:'空降正在准备，请稍候再试。'});return;}
    const point=safeLanding(value,[...sessions.values()].filter(other=>other!==s).map(other=>other.player));
    if(!point){reply({ok:false,error:'附近没有安全落点，请换一个位置。'});return;}
    s.lastTeleport=now;Object.assign(s.player,point,{moving:false,relocation:s.player.relocation+1});s.input={seq:s.lastSeq,x:0,z:0,run:false};s.lastInput=0;accounts.save([s.player]);publish();reply({ok:true,point,adjusted:Math.hypot(point.x-value.x,point.z-value.z)>.5});
   });
   socket.on('home',()=>{const s=sessions.get(socket.id);if(!s||s.player.vehicleId||s.player.shuttleId||Date.now()-s.joined<500||Math.max(s.player.heavyUntil,s.player.dodgeUntil,s.player.stunnedUntil)>Date.now())return;s.player={...s.player,...(safeLanding(campus.spawnPoints[0])||campus.spawnPoints[0]),moving:false,relocation:s.player.relocation+1};s.input={seq:s.lastSeq,x:0,z:0,run:false};s.lastInput=0;s.joined=Date.now();accounts.save([s.player]);publish();});
   socket.on('leave',()=>{remove(socket,false);socket.disconnect(true);});
   socket.on('disconnect',()=>remove(socket,true));
 });
 const tick=setInterval(()=>{const now=Date.now();const pedestrians=[...sessions.values()].filter(s=>!s.player.vehicleId&&!s.player.shuttleId).map(s=>s.player);for(const bus of shuttles)Object.assign(bus,stepShuttleTraffic(bus,CONFIG.tickMs/1000,now,vehicles,pedestrians,shuttles));for(const s of sessions.values()){if(s.player.heavyUntil>0&&s.player.heavyUntil<=now){s.player.heavyUntil=0;if(s.player.stunnedUntil<=now){s.player.punchAt=now;strike(s,'heavy',now);}}
 s.regenAt=regenerateHealth(s.player,now,s.regenAt);
 if(s.player.guardUntil>now){s.player.energy=Math.max(0,s.player.energy-COMBAT.guardDrainPerSecond*CONFIG.tickMs/1000);if(s.player.energy===0)s.player.guardUntil=0;}
 else if(now-s.effortAt>=COMBAT.energyRegenDelayMs)s.player.energy=Math.min(COMBAT.maxEnergy,s.player.energy+COMBAT.energyRegenPerSecond*CONFIG.tickMs/1000);
 s.player.energy=Math.round(s.player.energy*10)/10;const bus=shuttles.find(b=>b.id===s.player.shuttleId);if(bus){s.player.x=bus.x;s.player.z=bus.z;s.player.yaw=bus.yaw;s.player.moving=false;s.player.ack=s.input.seq;continue;}const input=now-s.lastInput>CONFIG.inputTimeoutMs?{...s.input,x:0,z:0}:s.input;const car=vehicles.find(v=>v.id===s.player.vehicleId);if(car){const control=now-s.lastDrive>VEHICLE.inputTimeout?{throttle:0,steer:0,brake:true}:s.drive;Object.assign(car,stepVehicle(car,control,CONFIG.tickMs/1000,vehicles,[...sessions.values()].filter(o=>o!==s&&!o.player.vehicleId&&!o.player.shuttleId).map(o=>o.player),shuttles.map(shuttleBody)));s.player.x=car.x;s.player.z=car.z;s.player.yaw=car.yaw;s.player.moving=false;s.player.ack=s.input.seq;continue;}
 const moved=fighterMovement(s.player,input,CONFIG.tickMs/1000,now),p=(vehicles.some(v=>vehicleContains(v,moved))||shuttles.some(b=>shuttleContains(b,moved)))?{x:s.player.x,z:s.player.z}:moved;s.player.moving=Math.hypot(p.x-s.player.x,p.z-s.player.z)>.0001;s.player.x=p.x;s.player.z=p.z;if(Math.hypot(input.x,input.z)>.01&&s.player.heavyUntil<=now&&s.player.dodgeUntil<=now&&s.player.stunnedUntil<=now)s.player.yaw=Math.atan2(input.x,input.z);s.player.ack=s.input.seq;}
 if(options.npcs)npcs.step([...sessions.values()].map(s=>s.player),now,p=>strike({player:p},'light',now));
 for(const pet of pets){const owner=[...sessions.values()].find(s=>s.player.id===pet.ownerId);stepPet(pet,owner?.player,now,CONFIG.tickMs/1000);const intent=dogTargets.get(pet.id),target=intent&&fighters().find(p=>p.id===intent.targetId);if(intent&&intent.until<now)dogTargets.delete(pet.id);if(owner&&target&&intent&&intent.until>=now&&!owner.player.vehicleId&&!owner.player.shuttleId&&!target.vehicleId&&!target.shuttleId&&target.protectedUntil<=now&&target.dodgeUntil<=now&&Math.hypot(target.x-owner.player.x,target.z-owner.player.z)<8&&Math.hypot(target.x-pet.x,target.z-pet.z)<4&&Array.from({length:20},(_,i)=>({x:pet.x+(target.x-pet.x)*i/20,z:pet.z+(target.z-pet.z)*i/20})).every(p=>!blocked(p)&&vehicles.every(v=>!vehicleContains(v,p))&&shuttles.every(b=>!shuttleContains(b,p)))&&now-pet.attackAt>=PETS.assistCooldown){pet.attackAt=now;strike(owner,'light',now,pet,target);}}
 for(const notice of fishing.tick([...sessions.values()].map(s=>s.player),now))io.to(notice.playerId).emit('fishing-notice',notice.message);
 ticks++;if(ticks%(1000/CONFIG.tickMs)===0){accounts.save([...sessions.values()].map(s=>s.player));accounts.savePets(pets);for(const[ip,b]of authBudgets)if(now-b.since>60000)authBudgets.delete(ip);}
 if(ticks%(CONFIG.snapshotMs/CONFIG.tickMs)===0)publish();for(const[token,r]of recoveries)if(r.expires<now)recoveries.delete(token);},CONFIG.tickMs);
 return {io,accountStore:accounts,snapshot,stats:()=>({online:sessions.size,recoveries:recoveries.size,rejected,ticks,listeners:io.sockets.sockets.size,memory:process.memoryUsage()}),close:async()=>{closing=true;clearInterval(tick);accounts.save([...sessions.values()].map(s=>s.player));accounts.savePets(pets);await new Promise<void>(r=>io.close(()=>r()));await Promise.allSettled([...pendingAuth]);accounts.close();}};
}
