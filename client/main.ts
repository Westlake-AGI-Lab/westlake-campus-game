import {leaderboardUI} from './leaderboard';
import {fruitScene} from './fruit';
import {fishingScene} from './fishing';
import {petUI} from './pets';
import {fighterMovement,fighterStatus} from '../shared/fighter';
import {APP_VERSION} from '../shared/version';
import {navigationUI} from './navigation';
import {buildingName} from '../shared/buildings';
import type {Destination} from '../shared/destinations';
import './style.css';
import * as T from 'three';
import {io} from 'socket.io-client';
import {CONFIG,COMBAT,COLORS,MESSAGES} from '../shared/config';
import {campus,heightAt} from '../shared/world';
import type {Player,Snapshot,Welcome,Bubble,Input,Punch,AttackReply,JoinRequest,JoinReply} from '../shared/types';
import {buildCampus} from './scene';
import {vehicleScene} from './vehicles';
import {shuttleScene} from './shuttle';
import {SHUTTLE_ROUTE,SHUTTLE_STOPS,SHUTTLE,shuttleContains,type ShuttleReply} from '../shared/shuttle';
import {vehicleContains,type VehicleReply} from '../shared/vehicles';
import {studioEnvironment} from './art';
import {ambience} from './ambience';
import {avatar} from './avatars';
import {playerSize} from '../shared/player-size';
import {accountEntry} from './accounts';
import {campusCenter,campusDistance,overviewLabels} from './overview';
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const rail=$('left-rail'),hudToggle=$('hud-toggle');
hudToggle.addEventListener('click',()=>{const expanded=hudToggle.getAttribute('aria-expanded')!=='true';hudToggle.setAttribute('aria-expanded',String(expanded));rail.classList.toggle('expanded',expanded);hudToggle.querySelector('.hud-chevron')!.textContent=expanded?'−':'＋';clearInput();});
const canvas=$<HTMLCanvasElement>('world');
let renderer:T.WebGLRenderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch{$('entry-error').textContent='无法启用 WebGL。请使用支持硬件加速的 Chrome / Edge 浏览器。';throw Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.background=new T.Color('#dbe9e8');scene.fog=new T.Fog('#dbe9e8',950,2200);
const {sky}=studioEnvironment(renderer,scene);
const hemi=new T.HemisphereLight('#d5e7f5','#77846a',1.05);scene.add(hemi);const sun=new T.DirectionalLight('#fff0d4',2.7);sun.position.set(-180,300,180);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-110;sun.shadow.camera.right=110;sun.shadow.camera.top=110;sun.shadow.camera.bottom=-110;sun.shadow.camera.far=650;sun.shadow.normalBias=.3;scene.add(sun,sun.target);
const {cameraBlockers,animateWater}=buildCampus(scene),cars=vehicleScene(scene),buses=shuttleScene(scene),camera=new T.PerspectiveCamera(52,innerWidth/innerHeight,.15,12000),ray=new T.Raycaster();
const ambient=ambience(scene,renderer,sun,hemi,sky);
let selectedColor=0,started=false,connected=false,playerId='',token='',seq=0,world:Snapshot={time:0,players:[],count:0},local:Player|undefined,azimuth=0,pitch=.29,distance=10,photoView='';
let zoomDistance=10,lastOverviewButtonState=false;let nearView={distance:10,azimuth:0,pitch:.29};const overview=overviewLabels();let focusedBuilding:Destination|undefined,focusView:{position:T.Vector3;target:T.Vector3}|undefined,savedFocusCamera:typeof nearView|undefined;const cameraTarget=new T.Vector3();const groundFog=new T.Fog('#dbe9e8',950,2200);
const keys=new Set<string>(),entities=new Map<string,ReturnType<typeof avatar>&{label:HTMLElement;name:HTMLElement;bubble:HTMLElement;health:HTMLElement;healthFill:HTMLElement;healthNumber:HTMLElement;stats:HTMLElement;target:Player}>(),bubbles=new Map<string,Bubble>();
let driveSeq=0,vehicleSeq=0,vehiclePending=false,shuttleSeq=0,shuttlePending=false;let attackSeq=0,attackNextAt=0,combatSeq=0,guardLatch=false,guardSent=false;const account=accountEntry();let pendingAuth:JoinRequest|undefined;
if(account.previous){token=account.previous.token;selectedColor=account.previous.color;}
let navigation:ReturnType<typeof navigationUI>|undefined;
const errors:string[]=[];window.addEventListener('error',e=>errors.push(e.message));
const frames:number[]=[];let loadingStarted=performance.now(),readyMs=0,snapshotAt=0;
const colors=$('colors');COLORS.forEach((color,i)=>{const b=document.createElement('button');b.type='button';b.className='color-choice'+(i===selectedColor?' selected':'');b.style.background=color;b.ariaLabel=['松绿','暖橙','雾蓝','莓紫','岩灰','麦黄'][i];b.setAttribute('aria-pressed',String(i===selectedColor));b.onclick=()=>{selectedColor=i;for(const[c,j]of Array.from(colors.children).map((c,j)=>[c,j] as const)){c.classList.toggle('selected',j===i);c.setAttribute('aria-pressed',String(j===i));}account.setCoat(i);};colors.append(b);});
account.setCoat(selectedColor);
document.getElementById('app-version')!.textContent=`v${APP_VERSION}`;
function status(text:string){$('status').textContent=text;$('status-dot').classList.toggle('connected',connected);$('online').textContent=connected?`${world.count} / ${CONFIG.maxPlayers} 人在线${world.npcCount?` · ${world.npcCount} NPC`:""}`:'— 人在线';}
let toastTimer:number;function toast(text:string){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').classList.remove('visible'),3000);}
function removeEntity(id:string){const e=entities.get(id);if(!e)return;scene.remove(e.group);e.label.remove();e.dispose();entities.delete(id);bubbles.delete(id);}
function paintHealth(track:HTMLElement,fill:HTMLElement,hp:number){track.setAttribute('aria-valuenow',String(hp));fill.style.width=`${hp/COMBAT.maxHealth*100}%`;fill.style.background=hp>50?'#3c8b73':hp>25?'#c98a43':'#c35f50';}
function updateWorld(snapshot:Snapshot){
 world=snapshot;cars.update(snapshot.vehicles||[]);buses.update(snapshot.shuttles||[],snapshot.players);snapshotAt=performance.now();
 const ids=new Set(world.players.map(p=>p.id));for(const id of entities.keys())if(!ids.has(id))removeEntity(id);
 for(const p of world.players){
  let e=entities.get(p.id);const respawned=!!e&&e.target.life!==p.life;const relocated=!!e&&e.target.relocation!==p.relocation;
  if(!e){
   const a=avatar(p.color,p.appearance),label=document.createElement('div');label.className='player-label';label.dataset.playerId=p.id;label.dataset.npc=String(!!p.npc);
   const name=document.createElement('div');name.className='nickname';name.textContent=p.name+(p.npc?' · NPC':p.id===playerId?' · 你':'');
   const bubble=document.createElement('div');bubble.className='bubble';bubble.hidden=true;
   const health=document.createElement('div');health.className='player-health';health.setAttribute('role','progressbar');health.setAttribute('aria-label',p.name+'生命值');health.setAttribute('aria-valuemin','0');health.setAttribute('aria-valuemax',String(COMBAT.maxHealth));
   const track=document.createElement('div');track.className='health-track';const healthFill=document.createElement('i');track.append(healthFill);
   const healthNumber=document.createElement('span');healthNumber.className='player-hp';health.append(track,healthNumber);
   const stats=document.createElement('div');stats.className='combat-stats';label.append(bubble,name,health,stats);$('labels').append(label);
   e={...a,label,name,bubble,health,healthFill,healthNumber,stats,target:p};e.group.position.set(p.x,heightAt(p),p.z);scene.add(e.group);entities.set(p.id,e);
  }
  if(respawned||relocated){e.group.position.set(p.x,heightAt(p),p.z);bubbles.delete(p.id);}
  e.target=p;paintHealth(e.health,e.healthFill,p.hp);e.healthNumber.textContent=String(p.hp);e.stats.textContent=p.npc?"陪练角色":`击倒 ${p.kills} · 倒地 ${p.deaths}`;e.stats.dataset.kills=String(p.kills);e.stats.dataset.deaths=String(p.deaths);
  if(p.id===playerId){
   const remaining=p.nextAttackAt-snapshot.time;
   if(remaining>0)attackNextAt=Math.max(attackNextAt,snapshotAt+remaining+50);
   if(p.vehicleId||p.shuttleId||!local||respawned||relocated||Math.hypot(p.x-local.x,p.z-local.z)>2)local={...p};
   else local={...p,x:T.MathUtils.lerp(local.x,p.x,.4),z:T.MathUtils.lerp(local.z,p.z,.4),yaw:local.moving?local.yaw:p.yaw};
   if(relocated){clearInput();navigation?.displaced();}
   if(respawned){navigation?.displaced();clearInput();toast('已随机满血复活 · 2 秒保护，主动出拳结束保护');}
   paintHealth($('my-health'),$('my-health').querySelector('i')!,p.hp);$('my-hp').textContent=`${p.hp} / ${COMBAT.maxHealth}`;$('my-kills').textContent=String(p.kills);$('my-deaths').textContent=String(p.deaths);$('npc-practice').textContent=world.npcCount?`陪练击倒 ${p.npcWins||0} · 陪练倒地 ${p.npcFalls||0}`:'';
  }
 }
 status('已连接');
}
const socket=io({autoConnect:false,transports:['websocket'],reconnectionDelay:500,reconnectionDelayMax:2000});
const leaderboard=leaderboardUI(socket,clearInput);
socket.on('fishing-notice',(message:string)=>toast(message));
socket.on('connect',()=>{
 if(!started)return;keys.clear();seq=0;driveSeq=vehicleSeq=0;vehiclePending=false;shuttleSeq=0;shuttlePending=false;attackSeq=0;combatSeq=0;attackNextAt=0;guardLatch=guardSent=false;
 const request=pendingAuth||(token?{mode:'resume' as const,token,color:selectedColor}:undefined);if(!request)return;
 socket.emit('join',request,(reply:JoinReply)=>{
  if('error' in reply){connected=false;started=false;pendingAuth=undefined;token='';account.clear();$('entry-error').textContent=reply.error;status(reply.error);socket.disconnect();$('join').querySelector('button[type=submit]')!.removeAttribute('disabled');$('entry').hidden=false;$('hud').hidden=true;return;}
  const old=playerId;playerId=reply.playerId;token=reply.token;pendingAuth=undefined;connected=true;local=undefined;bubbles.clear();for(const id of entities.keys())removeEntity(id);updateWorld(reply.snapshot);
  account.accepted(token,reply.username,local!.name,local!.color);$('entry-error').textContent='';$('entry').hidden=true;$('hud').hidden=false;$('my-name').textContent=local!.name;$('coat-dot').style.background=COLORS[local!.color];readyMs=performance.now()-loadingStarted;
  if(old)toast('已恢复账号、位置与战绩');
 });
});
socket.on('world',(snapshot:Snapshot)=>{if(connected)updateWorld(snapshot);});
socket.on('disconnect',()=>{connected=false;clearInput();for(const id of entities.keys())if(id!==playerId)removeEntity(id);bubbles.clear();status('已断线 · 等待恢复');});
socket.on('connect_error',()=>{connected=false;status('连接失败 · 重试中');$('entry-error').textContent='服务器暂未连接，正在重试。请确认服务已启动。';});
socket.on('bubble',(b:Bubble)=>{if(Object.hasOwn(MESSAGES,b.id))bubbles.set(b.playerId,b);});
socket.on('punch',(p:Punch)=>{if(p.targetId===playerId&&p.defense)toast(p.defense==='parry'?'精准招架 · 对方短暂硬直':p.defense==='break'?'被重拳破防 · 暂时无法行动':'正面格挡 · 减少伤害');if(p.attackerId===playerId){const target=world.players.find(v=>v.id===p.targetId);toast(p.defense==='parry'?'被精准招架 · 短暂硬直':p.defense==='block'?'对方格挡 · 试试重拳破防':p.defense==='break'?'重拳破防 · −'+p.damage+' 生命':p.knockout?`击倒 ${target?.name||'玩家'} · 击倒 +1`:p.targetId?`命中 ${target?.name||'玩家'} · −${p.damage} 生命`:'挥拳落空 · 面向近处玩家再出拳');}});
$('join').addEventListener('submit',e=>{e.preventDefault();pendingAuth=account.request(selectedColor);token='';started=true;loadingStarted=performance.now();$('entry-error').textContent='正在登录校园…';($('join').querySelector('button[type=submit]') as HTMLButtonElement).disabled=true;socket.connect();});
function blockedInput(){return !connected||!!photoView||!!focusedBuilding||!!document.activeElement?.matches('input,textarea,select')||!$('leaderboard-modal').hidden||!$('about-modal').hidden||!$('chat-panel').hidden||!$('views-panel').hidden||document.hidden;}
function intent():Input{if(blockedInput())return{seq,x:0,z:0,run:false};let dx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),dz=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);const len=Math.hypot(dx,dz);if(len>1){dx/=len;dz/=len;}return{seq,x:Math.cos(azimuth)*dx+Math.sin(azimuth)*dz,z:-Math.sin(azimuth)*dx+Math.cos(azimuth)*dz,run:keys.has('ShiftLeft')||keys.has('ShiftRight')};}
function clearInput(){keys.clear();if(connected&&local?.vehicleId)socket.emit('drive',{seq:++driveSeq,throttle:0,steer:0,brake:true});guardLatch=false;if(connected&&guardSent)sendGuard(false);guardSent=false;if(connected)socket.emit('input',{seq:++seq,x:0,z:0,run:false});}
function combatError(reason:AttackReply['reason']){toast(reason==='stamina'?'体力不足 · 稍候恢复':reason==='busy'?'当前动作未结束 · 暂时无法操作':reason==='cooldown'?'动作冷却中 · 稍候再试':'动作未被接受');}
function attack(kind:'light'|'heavy'='light'){
 if(blockedInput()||!local||performance.now()<attackNextAt)return;
 attackNextAt=performance.now()+(kind==='heavy'?COMBAT.heavyCooldownMs:COMBAT.punchCooldownMs)+50;
 $<HTMLButtonElement>('attack-toggle').disabled=true;
 socket.emit('attack',{seq:++attackSeq,yaw:Math.atan2(Math.sin(local.yaw),Math.cos(local.yaw)),kind},(reply:AttackReply)=>{
  if(!reply.ok){attackNextAt=performance.now()+150;combatError(reply.reason);}else if(reply.charging)toast('重拳蓄力 · 对手可以闪避，面向目标再出拳');
 });
}
function sendGuard(active:boolean,feedback=false){
 if(!connected||!local||local.vehicleId)return;
 guardSent=active;
 socket.emit('combat',{seq:++combatSeq,kind:'guard',active,yaw:Math.atan2(Math.sin(local.yaw),Math.cos(local.yaw))},(reply:AttackReply)=>{if(feedback&&!reply.ok)combatError(reply.reason);});
}
function dodge(){
 if(blockedInput()||!local||local.vehicleId)return;const i=intent(),len=Math.hypot(i.x,i.z);
 socket.emit('combat',{seq:++combatSeq,kind:'dodge',x:len>.01?i.x:Math.sin(local.yaw),z:len>.01?i.z:Math.cos(local.yaw)},(reply:AttackReply)=>{if(!reply.ok)combatError(reply.reason);});
}
$('attack-toggle').onclick=()=>attack();$('heavy-toggle').onclick=()=>attack('heavy');$('dodge-toggle').onclick=dodge;
$('guard-toggle').onclick=()=>{if(blockedInput())return;guardLatch=!guardLatch;sendGuard(guardLatch,true);};
function vehicleAction(){
 if(!connected||!local||vehiclePending)return;if(local.shuttleId){toast('请先下校车，再驾驶汽车');return;}const nearest=cars.nearest(local,world.vehicles||[]);if(!local.vehicleId&&!nearest){toast('请靠近一辆空车，或搜索“停车区”');return;}
 vehiclePending=true;clearInput();socket.emit('vehicle',local.vehicleId?{seq:++vehicleSeq,kind:'exit'}:{seq:++vehicleSeq,kind:'enter',vehicleId:nearest!.id},(reply:VehicleReply)=>{vehiclePending=false;if(!reply.ok){toast(reply.error);return;}photoView='';returnBuildingCamera();navigation?.displaced();zoomDistance=Math.max(zoomDistance>300?10:zoomDistance,9);toast(local?.vehicleId?'已上车 · W/S 前进倒车 · A/D 转向 · 空格刹车 · R 下车':'已下车，汽车留在原地供其他玩家使用');});
}
$('vehicle-toggle').onclick=vehicleAction;
function shuttleAction(){
 if(!connected||!local||shuttlePending)return;if(local.vehicleId){toast('请先下汽车，再乘校车');return;}
 const near=buses.nearest(local,world.shuttles||[]);if(!local.shuttleId&&!near){toast('靠近校车按 B，或搜索“校车站”');return;}
 shuttlePending=true;const exiting=!!local.shuttleId;clearInput();socket.emit('shuttle',exiting?{seq:++shuttleSeq,kind:'exit'}:{seq:++shuttleSeq,kind:'enter',shuttleId:near!.id},(reply:ShuttleReply)=>{shuttlePending=false;if(!reply.ok){toast(reply.error);return;}photoView='';returnBuildingCamera();navigation?.displaced();zoomDistance=Math.max(zoomDistance>300?14:zoomDistance,14);toast(exiting?'已在附近安全位置下车':'已乘坐环线校车 · B 随时下车');});
}
$('shuttle-toggle').onclick=shuttleAction;
$('shuttle-locate').onclick=()=>{const bus=[...world.shuttles||[]].sort((a,b)=>Math.hypot(a.x-(local?.x||0),a.z-(local?.z||0))-Math.hypot(b.x-(local?.x||0),b.z-(local?.z||0)))[0];if(bus)locateBuilding({id:bus.id,name:'环线校车 '+bus.id.slice(-1),point:{x:bus.x,z:bus.z},group:'校车',building:false,aliases:''});};

let guardTick=0;setInterval(()=>{if(connected){if(local?.vehicleId){const active=!blockedInput();socket.emit('drive',{seq:++driveSeq,throttle:active?(Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))):0,steer:active?(Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight'))):0,brake:!active||keys.has('Space')});return;}seq++;socket.emit('input',{...intent(),seq});const guarding=!blockedInput()&&(guardLatch||keys.has('KeyK'));if(guarding&&++guardTick%2===0)sendGuard(true);else if(!guarding&&guardSent)sendGuard(false);}},50);
window.addEventListener('keydown',e=>{if(!$('leaderboard-modal').hidden){if(e.code==='Escape'){e.preventDefault();leaderboard.close();clearInput();}return;}if(e.code==='Escape'&&!$('about-modal').hidden){e.preventDefault();$('about-modal').hidden=true;clearInput();return;}if(e.defaultPrevented||(e.target as HTMLElement).matches('input,textarea,select')||((e.target as HTMLElement).closest('.map-tools')&&['Space','Enter','ArrowUp','ArrowDown'].includes(e.code)))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='KeyB'){e.preventDefault();if(!e.repeat&&started)shuttleAction();}if(e.code==='KeyR'){e.preventDefault();if(!e.repeat&&started)vehicleAction();}if(e.code==='Space'&&local?.vehicleId){e.preventDefault();keys.add(e.code);return;}if(e.code==='KeyK'){e.preventDefault();keys.add(e.code);if(!e.repeat&&!blockedInput())sendGuard(true,true);}if(e.code==='KeyQ'){e.preventDefault();if(!e.repeat&&started)dodge();}if(e.code==='KeyL'){e.preventDefault();if(!e.repeat&&started)attack('heavy');}if(e.code==='KeyJ'||e.code==='Space'){e.preventDefault();if(!e.repeat&&started)attack();}if(!e.repeat&&started){if(e.code==='KeyE')$('chat-toggle').click();if(e.code==='KeyM')$('map-toggle').click();if(e.code==='KeyF')$('overview-toggle').click();if(e.code==='Escape'){for(const id of ['chat-panel','views-panel','about-modal'])$(id).hidden=true;photoView='';returnBuildingCamera();clearInput();}}});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyK'&&!guardLatch)sendGuard(false);});window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);window.addEventListener('pagehide',()=>{if(socket.connected)socket.emit('leave');});
function toggle(id:string){$(id).hidden=!$(id).hidden;clearInput();}
$('map-toggle').onclick=()=>{const panel=$('map-panel');panel.hidden=!panel.hidden;clearInput();};$('chat-toggle').onclick=()=>{toggle('chat-panel');$('views-panel').hidden=true;};$('views-toggle').onclick=()=>{toggle('views-panel');$('chat-panel').hidden=true;};$('home').onclick=()=>{clearInput();returnBuildingCamera();photoView='';zoomDistance=10;socket.emit('home');toast('已回到校园起点');};
for(const id of ['about','entry-about'])$(id).onclick=()=>{$('about-modal').hidden=false;clearInput();};$('close-about').onclick=()=>$('about-modal').hidden=true;
$('logout').onclick=()=>{leaderboard.close();clearInput();socket.emit('leave');socket.disconnect();account.clear();account.loggedOut();navigation?.reset();started=connected=false;playerId=token='';pendingAuth=undefined;local=undefined;world={time:0,players:[],count:0};for(const id of entities.keys())removeEntity(id);bubbles.clear();returnBuildingCamera();photoView='';$('hud').hidden=true;$('entry').hidden=false;$('entry-error').textContent='已保存位置与战绩，退出登录。';};
for(const[id,text]of Object.entries(MESSAGES)){const b=document.createElement('button');b.textContent=text;b.dataset.messageId=id;b.onclick=()=>{socket.emit('say',id);$('chat-panel').hidden=true;};$('messages').append(b);}
for(const view of campus.validationViews){const b=document.createElement('button');b.textContent=view.title;b.dataset.viewId=view.id;b.onclick=()=>{returnBuildingCamera();photoView=view.id;$('views-panel').hidden=true;clearInput();toast('校园视角 · 按 Esc 返回行走');};$('view-list').append(b);}
function toggleOverview(){
 if(focusedBuilding){returnBuildingCamera();return;}
 clearInput();photoView='';$('views-panel').hidden=true;$('chat-panel').hidden=true;
 if(zoomDistance>300){zoomDistance=nearView.distance;azimuth=nearView.azimuth;pitch=nearView.pitch;}
 else{nearView={distance:zoomDistance,azimuth,pitch};azimuth=0;zoomDistance=campusDistance(camera.aspect);toast('全校总览 · 橙色标记是你的位置 · 滚轮拉近或按 F 返回');}
}
$('overview-toggle').onclick=toggleOverview;
$('return-camera').onclick=()=>{returnBuildingCamera();photoView='';zoomDistance=nearView.distance;azimuth=nearView.azimuth;pitch=nearView.pitch;$('views-panel').hidden=true;};
let drag=false,lastX=0,lastY=0;canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;returnBuildingCamera();azimuth-=(e.clientX-lastX)*.006;pitch=T.MathUtils.clamp(pitch+(e.clientY-lastY)*.004,.12,1.08);lastX=e.clientX;lastY=e.clientY;photoView='';});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();returnBuildingCamera();if(zoomDistance<100&&!photoView)nearView={distance:zoomDistance,azimuth,pitch};photoView='';const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);zoomDistance=T.MathUtils.clamp(zoomDistance*Math.exp(T.MathUtils.clamp(delta,-240,240)*.005),4,campusDistance(camera.aspect,azimuth));},{passive:false});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;if(zoomDistance>300)zoomDistance=campusDistance(camera.aspect,azimuth);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const map=$<HTMLCanvasElement>('map'),ctx=map.getContext('2d')!;
function mapPoint(x:number,z:number){const b=campus.meta.bounds;return[(x-b.minX)/(b.maxX-b.minX)*(map.width-40)+20,(z-b.minZ)/(b.maxZ-b.minZ)*(map.height-40)+20];}
function drawMap(){ctx.clearRect(0,0,map.width,map.height);ctx.fillStyle='#e7ecdf';ctx.fillRect(16,16,map.width-32,map.height-32);const poly=(points:{x:number;z:number}[])=>{ctx.beginPath();points.forEach((p,i)=>{const[x,y]=mapPoint(p.x,p.z);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();};for(const w of campus.waterBodies){poly(w.outer);ctx.fillStyle='#b2d6d0';ctx.fill();for(const h of[w.inner,...(w.holes||[])]){poly(h);ctx.fillStyle='#e7ecdf';ctx.fill();}}ctx.strokeStyle='#fafaf3';for(const r of campus.roads){ctx.beginPath();r.points.forEach((p,i)=>{const[x,y]=mapPoint(p.x,p.z);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.lineWidth=Math.max(2,r.width*(map.width-40)/(campus.meta.bounds.maxX-campus.meta.bounds.minX));ctx.stroke();}ctx.strokeStyle='#f5efdf';for(const bridge of [...campus.bridges,...(campus.waterWalkways||[])]){ctx.beginPath();bridge.points.forEach((p,i)=>{const[x,y]=mapPoint(p.x,p.z);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.lineWidth=Math.max(3,bridge.w*(map.width-40)/(campus.meta.bounds.maxX-campus.meta.bounds.minX));ctx.stroke();}const sx=(map.width-40)/(campus.meta.bounds.maxX-campus.meta.bounds.minX),sz=(map.height-40)/(campus.meta.bounds.maxZ-campus.meta.bounds.minZ);for(const b of campus.buildings){const[x,y]=mapPoint(b.x,b.z);ctx.fillStyle=b.kind==='hall'?'#bb9976':'#adb8a3';if(b.kind==='loop'){ctx.strokeStyle='#adb8a3';ctx.lineWidth=(b.outerRadius!-b.innerRadius!)*(sx+sz)/2;ctx.beginPath();ctx.ellipse(x,y,b.radius!*sx,b.radius!*sz,0,0,b.arc![1]*Math.PI/180);ctx.stroke();}else if(b.radius){ctx.beginPath();ctx.ellipse(x,y,b.radius*sx,b.radius*sz,0,0,Math.PI*2);ctx.fill();}else for(const a of b.parts||[b]){const[px,py]=mapPoint(a.x,a.z);ctx.save();ctx.translate(px,py);ctx.rotate(a.rotation||0);ctx.fillRect(-a.w*sx/2,-a.d*sz/2,a.w*sx,a.d*sz);ctx.restore();}}ctx.save();ctx.font='bold 10px -apple-system, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#fff9e9';ctx.fillStyle='#294b43';
 for(const b of campus.buildings){if(!b.codes?.length)continue;const[x,y]=mapPoint(b.x,b.z);const text=b.codes.join('/');ctx.strokeText(text,x,y);ctx.fillText(text,x,y);}ctx.restore();
 for(const car of world.vehicles||[]){const[x,y]=mapPoint(car.x,car.z);ctx.fillStyle=car.driverId?'#cc8750':'#466a7c';ctx.fillRect(x-3,y-2,6,4);}
 ctx.save();ctx.strokeStyle='#c88b38';ctx.setLineDash([6,4]);ctx.lineWidth=2;ctx.beginPath();SHUTTLE_ROUTE.forEach((p,i)=>{const[x,y]=mapPoint(p.x,p.z);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();ctx.setLineDash([]);for(const s of SHUTTLE_STOPS){const[x,y]=mapPoint(s.point.x,s.point.z);ctx.fillStyle='#315c50';ctx.fillRect(x-3,y-3,6,6);}for(const b of world.shuttles||[]){const[x,y]=mapPoint(b.x,b.z);ctx.fillStyle='#c58b3a';ctx.strokeStyle='#fff8df';ctx.lineWidth=1;ctx.fillRect(x-5,y-3,10,6);ctx.strokeRect(x-5,y-3,10,6);ctx.fillStyle='#553b16';ctx.font='bold 9px sans-serif';ctx.fillText('B'+b.id.slice(-1),x+7,y+3);}ctx.restore();
 navigation?.draw(ctx);if(local){const[x,y]=mapPoint(local.x,local.z);ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle='#cf9357';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}for(const p of world.players)if(p.id!==playerId){const[x,y]=mapPoint(p.x,p.z);ctx.fillStyle=COLORS[p.color];ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}}
function returnBuildingCamera(){
 focusedBuilding=undefined;focusView=undefined;navigation?.clearFocus();if(savedFocusCamera){({distance:zoomDistance,azimuth,pitch}=savedFocusCamera);savedFocusCamera=undefined;}
}
function locateBuilding(d:Destination){
 if(!focusedBuilding)savedFocusCamera={distance:zoomDistance,azimuth,pitch};focusedBuilding=d;photoView='';clearInput();$('views-panel').hidden=true;$('chat-panel').hidden=true;
 const b=campus.buildings.find(b=>b.id===d.id),parts=b?.parts||[b],cx=b?.x??d.point.x,cz=b?.z??d.point.z;
 let extent=50;for(const a of parts)if(a)extent=Math.max(extent,Math.abs(a.x-cx)+Math.abs(a.z-cz)+Math.hypot(a.w,a.d)/2);if(b?.radius)extent=Math.max(extent,b.radius);
 const range=Math.max(160,extent*3.1/Math.min(1,camera.aspect)),target=new T.Vector3(cx,(b?.h||0)*.38,cz);
 focusView={target,position:target.clone().add(new T.Vector3(range*.18,range*.83,range*.57))};toast('已定位 '+d.name+' · F / Esc 返回漫游');
}
navigation=navigationUI({scene,socket,player:()=>connected?local:undefined,stop:()=>{clearInput();photoView='';},locate:locateBuilding,returnCamera:returnBuildingCamera,toast,map,mapPoint});
$('find-dog').onclick=()=>{locateBuilding({id:'campus-dog',name:'校园狗 · 小径',point:ambient.dogPoint(),group:'校园空间',building:false,aliases:''} as Destination);};
$('find-cat').onclick=()=>{locateBuilding({id:'campus-cat',name:'校园猫 · 小径',point:ambient.catPoint(),group:'校园空间',building:false,aliases:''} as Destination);};
$('find-lab').onclick=()=>{locateBuilding({id:'night-lab',name:'深夜实验室亮窗',point:ambient.labPoint,group:'校园空间',building:false,aliases:''});const p=ambient.labPoint;focusView={target:new T.Vector3(p.x,5,p.z+6),position:new T.Vector3(p.x+12,11,p.z-18)};};
setInterval(drawMap,200);drawMap();
const orchard=fruitScene(scene,(value,reply)=>socket.emit('fruit-pick',value,reply),clearInput,toast);
const fishing=fishingScene(scene,(action,reply)=>socket.emit('fishing',action,(result:import('../shared/fishing').FishingReply)=>{if(result.ok&&action.kind==='cast'){photoView='';returnBuildingCamera();azimuth=Math.PI+.45;pitch=.38;zoomDistance=16;}reply(result);}),clearInput,toast);
let lastTime=performance.now();const petsUI=petUI((action,reply)=>{socket.emit('pet',action,reply);},toast,clearInput);
function frame(now:number){const elapsed=now-lastTime,dt=Math.min(elapsed/1000,.05);lastTime=now;if(connected&&document.visibilityState==='visible'){frames.push(elapsed);if(frames.length>3000)frames.shift();}const serverNow=world.time+now-snapshotAt;if(local&&connected&&!local.vehicleId&&!local.shuttleId){const i=intent(),moved=fighterMovement(local,i,dt,serverNow),p=((world.vehicles||[]).some(v=>vehicleContains(v,moved))||(world.shuttles||[]).some(b=>shuttleContains(b,moved)))?{x:local.x,z:local.z}:moved;local.moving=Math.hypot(p.x-local.x,p.z-local.z)>.0001;local.x=p.x;local.z=p.z;if(local.moving&&local.heavyUntil<=serverNow&&local.dodgeUntil<=serverNow&&local.stunnedUntil<=serverNow)local.yaw=Math.atan2(i.x,i.z);}

cars.animate(dt);buses.animate(dt);for(const[id,e]of entities){const p=id===playerId&&local?local:e.target;e.group.visible=!p.vehicleId&&!p.shuttleId&&(!p.npc||p.hp>0);if(id===playerId)e.group.position.set(p.x,heightAt(p),p.z);else{const alpha=1-Math.exp(-dt*13);e.group.position.x=T.MathUtils.lerp(e.group.position.x,p.x,alpha);e.group.position.z=T.MathUtils.lerp(e.group.position.z,p.z,alpha);}e.group.position.y=heightAt({x:e.group.position.x,z:e.group.position.z});let delta=p.yaw-e.group.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));e.group.rotation.y+=delta*Math.min(1,dt*15);const size=T.MathUtils.lerp(e.group.scale.x,playerSize(p),1-Math.exp(-dt*8));e.group.scale.setScalar(size);e.animate(now/1000,p.moving,(serverNow-p.punchAt)/COMBAT.punchAnimationMs,(serverNow-p.hitAt)/COMBAT.hitAnimationMs,p.protectedUntil>serverNow,fighterStatus(p,serverNow));e.label.dataset.state=fighterStatus(p,serverNow);e.label.classList.toggle('protected',p.protectedUntil>serverNow);const bubble=bubbles.get(id);e.bubble.hidden=!bubble||bubble.expiresAt<Date.now();if(bubble&&!e.bubble.hidden)e.bubble.textContent=MESSAGES[bubble.id as keyof typeof MESSAGES];}
const attackButton=$<HTMLButtonElement>('attack-toggle');const busy=!!local&&(!!local.vehicleId||!!local.shuttleId||local.stunnedUntil>serverNow||local.dodgeUntil>serverNow||local.guardUntil>serverNow||local.heavyUntil>serverNow);attackButton.disabled=blockedInput()||busy||now<attackNextAt||!!local&&local.energy<COMBAT.lightEnergy;attackButton.setAttribute('aria-label',now<attackNextAt?'拳击冷却中':'拳击 · J 或空格');$('combat-protection').hidden=!local||local.protectedUntil<=serverNow;if(local&&local.protectedUntil>serverNow)$('combat-protection').textContent=`保护 ${Math.ceil((local.protectedUntil-serverNow)/1000)}s`;
if(local){
 const energy=Math.round(local.energy);$('my-energy').textContent=`${energy} / ${COMBAT.maxEnergy}`;$('energy-track').setAttribute('aria-valuenow',String(energy));$('energy-track').querySelector<HTMLElement>('i')!.style.width=`${energy}%`;
 const state=fighterStatus(local,serverNow);$<HTMLButtonElement>('home').disabled=!!local.vehicleId||!!local.shuttleId||Math.max(local.heavyUntil,local.dodgeUntil,local.stunnedUntil)>serverNow;$('combat-state').textContent=state||'J / 空格轻拳 · Q 闪避 · 按住 K 格挡 · L 重拳';
 const dodgeButton=$<HTMLButtonElement>('dodge-toggle'),heavyButton=$<HTMLButtonElement>('heavy-toggle'),guardButton=$<HTMLButtonElement>('guard-toggle');
 dodgeButton.disabled=!!local.vehicleId||!!local.shuttleId||blockedInput()||local.stunnedUntil>serverNow||local.heavyUntil>serverNow||local.dodgeUntil>serverNow||serverNow-local.dodgeAt<COMBAT.dodgeCooldownMs||local.energy<COMBAT.dodgeEnergy;
 heavyButton.disabled=attackButton.disabled||local.energy<COMBAT.heavyEnergy;guardButton.setAttribute('aria-pressed',String(local.guardUntil>serverNow));guardButton.disabled=!!local.vehicleId||!!local.shuttleId||blockedInput()||local.stunnedUntil>serverNow||local.heavyUntil>serverNow||local.dodgeUntil>serverNow;
 dodgeButton.textContent=serverNow-local.dodgeAt<COMBAT.dodgeCooldownMs?`闪避 ${((COMBAT.dodgeCooldownMs-serverNow+local.dodgeAt)/1000).toFixed(1)}s`:'闪避 Q';heavyButton.textContent=local.heavyUntil>serverNow?'蓄力中…':now<attackNextAt?'重拳冷却中':'重拳 L';
}
distance=T.MathUtils.lerp(distance,zoomDistance,1-Math.exp(-dt*10));
const view=campus.validationViews.find(v=>v.id===photoView)||(!started?campus.validationViews.find(v=>v.id==='aerial'):undefined);
const overviewActive=started&&!focusedBuilding&&(!view?distance>300:photoView==='overview');
scene.fog=overviewActive||focusedBuilding||photoView.startsWith('region-')?null:groundFog;document.body.classList.toggle('campus-overview',overviewActive);
const overviewButton=$('overview-toggle');if(lastOverviewButtonState!==(zoomDistance>300)){lastOverviewButtonState=zoomDistance>300;overviewButton.innerHTML=lastOverviewButtonState?'↘ 返回漫游 <kbd>F</kbd>':'⌖ 全校总览 <kbd>F</kbd>';}overviewButton.setAttribute('aria-pressed',String(overviewActive));
if(focusedBuilding?.id.startsWith('shuttle-')){const bus=(world.shuttles||[]).find(b=>b.id===focusedBuilding!.id);if(bus&&focusView){focusView.target.set(bus.x,2,bus.z);focusView.position.set(bus.x+30,20,bus.z+30);}}
if(focusView){camera.position.copy(focusView.position);cameraTarget.copy(focusView.target);camera.lookAt(cameraTarget);camera.fov=52;camera.near=.5;camera.updateProjectionMatrix();}
else if(view){camera.position.fromArray(view.position);cameraTarget.fromArray(view.target);camera.lookAt(cameraTarget);camera.fov=view.fov;camera.near=Math.max(.15,view.position[1]*.005);camera.updateProjectionMatrix();}
else{
 const base=(local?.shuttleId?buses.position(local.shuttleId):undefined)||(local?.vehicleId?cars.position(local.vehicleId):undefined)||local||campus.spawnPoints[0],blend=T.MathUtils.smoothstep(distance,90,600),heightPitch=T.MathUtils.lerp(pitch,1.47,T.MathUtils.smoothstep(distance,45,1000));
 const target=new T.Vector3(base.x,1.45+heightAt(base),base.z).lerp(campusCenter,blend);cameraTarget.copy(target);
 const offset=new T.Vector3(Math.sin(azimuth)*Math.cos(heightPitch)*distance,Math.sin(heightPitch)*distance,Math.cos(azimuth)*Math.cos(heightPitch)*distance);
 if(distance<65){ray.set(target,offset.clone().normalize());ray.far=offset.length();const hit=ray.intersectObjects(cameraBlockers,false)[0];if(hit)offset.setLength(Math.max(.75,hit.distance-.5));}
 camera.position.copy(target).add(offset);camera.position.y=Math.max(camera.position.y,1);camera.lookAt(target);camera.fov=52;camera.near=Math.max(.15,distance*.005);camera.updateProjectionMatrix();sun.position.set(base.x-180,300,base.z+180);sun.target.position.set(base.x,0,base.z);sun.target.updateMatrixWorld();
}

camera.updateMatrixWorld();for(const[id,e]of entities){const p=e.group.position.clone().add(new T.Vector3(0,2.3*e.group.scale.y,0));const projected=p.project(camera),dist=camera.position.distanceTo(e.group.position);e.label.hidden=!!e.target.shuttleId||!!e.target.npc&&e.target.hp<=0||projected.z>1||projected.z<-1||Math.abs(projected.x)>1.2||Math.abs(projected.y)>1.2||dist>80;e.label.style.left=`${(projected.x*.5+.5)*innerWidth}px`;e.label.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;}
overview.update(camera,overviewActive,local);navigation?.project(camera);buses.project(camera);
const currentBus=(world.shuttles||[]).find(b=>b.id===local?.shuttleId),nearBus=local?buses.nearest(local,world.shuttles||[]):undefined;const currentCar=(world.vehicles||[]).find(v=>v.id===local?.vehicleId),nearby=local?cars.nearest(local,world.vehicles||[]):undefined;
 rail.classList.toggle('transport-context',!!(currentBus||currentCar||nearby||nearBus));
 $('vehicle-status').textContent=currentBus?`环线校车 ${currentBus.id.slice(-1)} · ${currentBus.passengerIds.length}/${SHUTTLE.capacity} 人`:currentCar?`${currentCar.id.replace('car-','共享车 ')} · ${Math.round(Math.abs(currentCar.speed)*3.6)} km/h`:nearby?'空车就在附近':'西南角有 4 辆共享汽车';
 $('vehicle-help').textContent=currentBus?`${currentBus.blocked?'前方有人或车辆，正在让行':currentBus.dwellUntil>serverNow?'停靠中':'行驶中'} · 下一站：${SHUTTLE_STOPS[currentBus.nextStop].name}`:nearBus?'校车就在附近 · B 上车，乘车后 B 随时下车':currentCar?'W/S 前进倒车 · A/D 转向 · 空格刹车 · R 下车':'汽车 R · 校车 B · 搜索“停车区”或“校车站”';
 const vehicleButton=$<HTMLButtonElement>('vehicle-toggle');vehicleButton.textContent=currentCar?'下汽车 R':'汽车 R';vehicleButton.disabled=!connected||vehiclePending||!!currentBus||!currentCar&&!nearby;const shuttleButton=$<HTMLButtonElement>('shuttle-toggle');shuttleButton.textContent=currentBus?'下校车 B':'校车 B';shuttleButton.disabled=!connected||shuttlePending||!!currentCar||!currentBus&&!nearBus;
 if(local){const nearest=campus.buildings.filter(b=>b.kind!=='loop').sort((a,b)=>Math.hypot(a.x-local!.x,a.z-local!.z)-Math.hypot(b.x-local!.x,b.z-local!.z))[0];$('location').textContent=Math.hypot(local.x,local.z)<160?'中央庭园':nearest&&Math.hypot(nearest.x-local.x,nearest.z-local.z)<100?buildingName(nearest):'云谷校园';}orchard.update(world.orchard||[],local,world.players,serverNow);fishing.update(world.fishing||[],local,world.players,serverNow);petsUI.update(world.pets||[],local,world.players,serverNow);animateWater(performance.now()/1000);ambient.update(connected?serverNow:Date.now(),now,camera,local&&!local.vehicleId&&!local.shuttleId?local:undefined,world.pets||[],world.players);renderer.render(scene,camera);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
Object.defineProperty(window,'__campusDebug',{get:()=>JSON.parse(JSON.stringify({playerId,connected,world,local,navigation:navigation?.debug(),vehicles:cars.debug(),shuttles:buses.debug(),ambience:ambient.debug(),bubbles:[...bubbles.values()].filter(b=>b.expiresAt>Date.now()),entities:[...entities].map(([id,e])=>({id,rendered:!!e.group.parent,labelHidden:e.label.hidden,color:e.target.color,appearance:e.group.userData.appearance,scale:e.group.scale.x})),render:renderer.info.render,frames,readyMs,snapshotAgeMs:performance.now()-snapshotAt,errors,camera:{position:camera.position.toArray(),target:focusedBuilding?'building:'+focusedBuilding.id:photoView,lookAt:cameraTarget.toArray(),distance,zoomDistance,overview:document.body.classList.contains('campus-overview'),campusCorners:[[campus.meta.bounds.minX,campus.meta.bounds.minZ],[campus.meta.bounds.maxX,campus.meta.bounds.minZ],[campus.meta.bounds.minX,campus.meta.bounds.maxZ],[campus.meta.bounds.maxX,campus.meta.bounds.maxZ]].map(([x,z])=>new T.Vector3(x,0,z).project(camera).toArray())},dataObjects:campus.buildings.length}))});
const requested=new URLSearchParams(location.search).get('view');if(requested&&campus.validationViews.some(v=>v.id===requested))photoView=requested;

if(account.previous){started=true;loadingStarted=performance.now();$('enter-campus').setAttribute('disabled','');$('entry-error').textContent='正在恢复账号…';socket.connect();}
