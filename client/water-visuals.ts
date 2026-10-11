import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {avatar} from './avatars';
import {APPEARANCE_OPTIONS} from '../shared/appearance';
import {COLORS} from '../shared/config';
import {GEAR,type Weapon,type WaterPlayer} from '../shared/water';

const up=new T.Vector3(0,1,0);
function dispose(root:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
 root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
// Local +Z is the nozzle direction. These sockets are used by both views.
export function waterGun(kind:Weapon){
 const group=new T.Group(),cap=new T.Group(),pump=new T.Group();group.add(cap,pump);
 const shell=new T.MeshStandardMaterial({color:kind==='precision'?'#eff4e8':kind==='stream'?'#54bcc7':'#68cce3',roughness:.32,metalness:.08});
 const trim=new T.MeshStandardMaterial({color:'#ffd06e',roughness:.4}),dark=new T.MeshStandardMaterial({color:'#294d60',roughness:.55});
 const water=new T.MeshStandardMaterial({color:'#67e8e9',roughness:.15,metalness:.15}),glass=new T.MeshStandardMaterial({color:'#d4ffff',transparent:true,opacity:.34,roughness:.12,depthWrite:false});
 const parts=new Map<T.Group,Map<T.Material,T.BufferGeometry[]>>();
 function part(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,rx=0,ry=0,rz=0,parent:T.Group=group){
  const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1));g.applyMatrix4(matrix);if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
  if(!parts.has(parent))parts.set(parent,new Map());const batch=parts.get(parent)!;if(!batch.has(m))batch.set(m,[]);batch.get(m)!.push(g);
 }
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent=group,rz=0)=>part(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.19),m,x,y,z,0,0,rz,parent);
 const tube=(r:number,h:number,x:number,y:number,z:number,m:T.Material,parent=group)=>part(new T.CylinderGeometry(r,r,h,16),m,x,y,z,Math.PI/2,0,0,parent);
 const length=kind==='precision'?.83:kind==='stream'?.65:.52,nozzleZ=length-.08;
 box(.24,.19,.43,0,0,.02,shell);box(.18,.09,.34,0,-.08,.09,dark);
 box(.11,.24,.13,.065,-.18,-.13,dark,group,-.16);box(.12,.07,.15,.06,-.3,-.11,trim);
 // Rounded trigger guard, textured grip and bright toy nozzle make its purpose legible.
 part(new T.TorusGeometry(.072,.013,6,16),trim,.07,-.14,.015,0,Math.PI/2);
 box(.012,.065,.025,.07,-.13,-.015,trim,group,-.25);
 for(let i=0;i<4;i++)box(.015,.013,.10,.122,-.12-i*.035,-.13,shell);
 tube(.062,length-.23,0,.012,(length+.15)/2,dark);tube(.082,.10,0,.012,nozzleZ,trim);
 tube(.047,.013,0,.012,nozzleZ+.057,dark);tube(.018,.017,0,.012,nozzleZ+.068,water);
 box(.23,.07,.16,0,-.105,.26,shell,pump);for(const x of[-.116,.116])for(let i=0;i<3;i++)box(.009,.045,.018,x,-.105,.215+i*.035,dark,pump);
 box(.075,.025,.075,0,.11,-.13,trim);box(.018,.055,.025,0,.055,nozzleZ-.08,trim);
 for(const x of[-.125,.125]){box(.008,.045,.19,x,.02,.03,trim);box(.009,.025,.08,x,-.04,-.06,dark);}
 const tankLength=kind==='stream'?.36:.26,tankZ=kind==='precision'?-.15:-.05;
 part(new T.CapsuleGeometry(.115,tankLength,4,16),glass,0,.185,tankZ,Math.PI/2);
 part(new T.CapsuleGeometry(.094,tankLength-.04,4,16),water,0,.174,tankZ,Math.PI/2);
 for(const z of[tankZ-tankLength/2,tankZ+tankLength/2])tube(.119,.03,0,.185,z,trim);
 cap.position.set(0,.31,tankZ);part(new T.CylinderGeometry(.065,.065,.045,16),trim,0,0,0,0,0,0,cap);
 for(const x of[-.066,.066])box(.012,.03,.035,x,0,0,dark,cap);
 if(kind==='precision'){box(.07,.09,.27,0,.11,.20,dark);tube(.052,.065,0,.135,.35,trim);tube(.036,.008,0,.135,.386,water);}
 if(kind==='stream'){box(.06,.035,.30,0,.123,.25,trim);for(const x of[-.14,.14])box(.035,.12,.16,x,.015,-.12,shell);}
 for(const [parent,batch]of parts)for(const [m,list]of batch){const merged=mergeGeometries(list);if(!merged)throw new Error('Water gun geometry could not be merged');parent.add(new T.Mesh(merged,m));list.forEach(g=>g.dispose());}
 const rightGrip=new T.Vector3(.07,-.18,-.13),leftGrip=new T.Vector3(-.065,-.12,.26),refill=new T.Vector3(-.07,.32,tankZ),muzzle=new T.Vector3(0,.012,nozzleZ+.08);
 return{group,kind,rightGrip,leftGrip,refill,muzzle,cap,pump,dispose:()=>dispose(group)};
}
function handGeometry(side:number){
 const palm=new RoundedBoxGeometry(.12,.11,.13,2,.025),parts:T.BufferGeometry[]=[palm];
 for(let n=0;n<3;n++){const finger=new RoundedBoxGeometry(.10,.026,.035,2,.009);finger.translate(0,-.04+n*.033,.071);parts.push(finger);}
 const thumb=new RoundedBoxGeometry(.045,.055,.09,2,.016);thumb.rotateZ(side*.4);thumb.translate(side*.066,.035,.03);parts.push(thumb);
 const merged=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return merged;
}
function arms(parent:T.Group,skin:T.Material,sleeve:T.Material){
 const items=[-1,1].map(side=>{
  const upper=new T.Mesh(new RoundedBoxGeometry(.17,1,.18,2,.03),sleeve),lower=new T.Mesh(new RoundedBoxGeometry(.14,1,.15,2,.028),sleeve),hand=new T.Mesh(handGeometry(side),skin);
  const joint=new T.Mesh(new T.SphereGeometry(.083,10,8),sleeve);parent.add(upper,lower,hand,joint);
  return{side,upper,lower,hand,joint};
 });
 const direction=new T.Vector3();
 function segment(mesh:T.Mesh,a:T.Vector3,b:T.Vector3){direction.subVectors(b,a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=direction.length();mesh.quaternion.setFromUnitVectors(up,direction.normalize());}
 return{items,pose:(shoulders:T.Vector3[],elbows:T.Vector3[],hands:T.Vector3[],weapon:T.Quaternion)=>items.forEach((a,i)=>{
  segment(a.upper,shoulders[i],elbows[i]);segment(a.lower,elbows[i],hands[i]);a.joint.position.copy(elbows[i]);a.hand.position.copy(hands[i]);a.hand.quaternion.copy(weapon);
 })};
}
export function reloadProgress(player:Pick<WaterPlayer,'weapon'|'reloadUntil'>,now:number){return player.reloadUntil>now?T.MathUtils.clamp(1-(player.reloadUntil-now)/GEAR[player.weapon].reloadMs,0,1):-1;}
function refillMotion(g:ReturnType<typeof waterGun>,progress:number){
 const open=progress<0?0:Math.sin(Math.PI*progress);g.cap.position.y=.31+open*.09;g.cap.rotation.y=open*Math.PI;g.pump.position.z=progress<0?0:-Math.sin(progress*Math.PI*4)*.025;
}
export function waterAvatar(player:WaterPlayer){
 const a=avatar(player.team==='blue'?2:1,{...player.appearance,coat:player.team==='blue'?2:1},'#8be7ed');a.arms.forEach(arm=>arm.visible=false);
 const pivot=new T.Group();a.group.add(pivot);let weapon=waterGun(player.weapon);pivot.add(weapon.group);
 const rig=arms(a.group,a.skin,a.sleeves),shoulders=[new T.Vector3(-.34,1.46,0),new T.Vector3(.34,1.46,0)],elbows=[new T.Vector3(),new T.Vector3()],hands=[new T.Vector3(),new T.Vector3()];
 let progress=-1,kick=0;
 return{group:a.group,muzzleWorld:()=>{a.group.updateWorldMatrix(true,true);return weapon.group.localToWorld(weapon.muzzle.clone());},
  animate:(p:WaterPlayer,now:number)=>{
   if(weapon.kind!==p.weapon){pivot.remove(weapon.group);weapon.dispose();weapon=waterGun(p.weapon);pivot.add(weapon.group);}
   progress=reloadProgress(p,now);kick=Math.exp(-Math.max(0,now-p.shotAt)/85)*(p.shotAt>0?1:0);
   const open=progress<0?0:Math.sin(progress*Math.PI),bob=p.moving?Math.sin(now*.012)*.012:Math.sin(now*.002)*.003;
   a.animate(now/1000,p.moving,0,(now-p.hitAt)/220,(p.protectUntil||0)>now);a.head.rotation.x=-p.pitch*.3;
   pivot.position.set(.10,1.31+bob-open*.12,.44-kick*.035);pivot.rotation.set(-p.pitch+open*.30-kick*.045,open*-.15,open*-.18);
   refillMotion(weapon,progress);pivot.updateMatrix();
   hands[0].copy(weapon.leftGrip).lerp(weapon.refill,open).applyMatrix4(pivot.matrix);hands[1].copy(weapon.rightGrip).applyMatrix4(pivot.matrix);
   elbows[0].set(-.43,1.13+open*.13,.22);elbows[1].set(.46,1.16,.16);
   rig.pose(shoulders,elbows,hands,pivot.quaternion);
  },
  diagnostic:()=>({weapon:weapon.kind,reload:progress,recoil:kick,muzzle:weapon.muzzle.toArray(),hands:hands.map(h=>h.toArray()),gripError:hands[1].distanceTo(weapon.rightGrip.clone().applyMatrix4(pivot.matrix)),drawMeshes:(()=>{let n=0;a.group.traverse(o=>{if(o instanceof T.Mesh&&o.visible)n++;});return n;})()}),
  dispose:()=>{a.dispose();},
 };
}
export function firstPersonWaterRig(camera:T.Camera){
 const group=new T.Group(),pivot=new T.Group();group.add(pivot);camera.add(group);
 const skin=new T.MeshStandardMaterial({color:'#f1c396',roughness:.65}),sleeve=new T.MeshStandardMaterial({color:'#507fa0',roughness:.7});
 const rig=arms(group,skin,sleeve),shoulders=[new T.Vector3(-.48,-.64,.07),new T.Vector3(.50,-.65,.12)],elbows=[new T.Vector3(-.33,-.48,-.25),new T.Vector3(.46,-.48,-.23)],hands=[new T.Vector3(),new T.Vector3()];
 let weapon=waterGun('sprayer');pivot.add(weapon.group);pivot.scale.setScalar(.78);
 return{group,muzzleWorld:()=>{group.updateWorldMatrix(true,true);return weapon.group.localToWorld(weapon.muzzle.clone());},
  animate:(p:WaterPlayer,now:number,aim:boolean,localShotAt=0)=>{
   skin.color.set(APPEARANCE_OPTIONS.skin[p.appearance.skin].color);sleeve.color.set(p.appearance.outfit===2?'#ece4cf':COLORS[p.team==='orange'?1:2]);
   if(weapon.kind!==p.weapon){pivot.remove(weapon.group);weapon.dispose();weapon=waterGun(p.weapon);pivot.add(weapon.group);}
   const reload=reloadProgress(p,now),open=reload<0?0:Math.sin(reload*Math.PI),kick=Math.exp(-Math.max(0,now-Math.max(p.shotAt,localShotAt))/75)*(Math.max(p.shotAt,localShotAt)>0?1:0);
   const sway=p.moving?Math.sin(now*.011)*.009:Math.sin(now*.002)*.003,compact=camera instanceof T.PerspectiveCamera&&camera.aspect<.8;
   pivot.scale.setScalar(compact?.64:.78);pivot.position.set((aim?0:compact?.11:.26)+sway,(compact?-.36:-.33)-open*.13+Math.abs(sway)*.4,-.79+kick*.055);
   pivot.rotation.set(open*-.32+kick*.05,Math.PI+open*.25,open*.17);refillMotion(weapon,reload);pivot.updateMatrix();
   hands[0].copy(weapon.leftGrip).lerp(weapon.refill,open).applyMatrix4(pivot.matrix);hands[1].copy(weapon.rightGrip).applyMatrix4(pivot.matrix);rig.pose(shoulders,elbows,hands,pivot.quaternion);
  },diagnostic:()=>({weapon:weapon.kind,skin:skin.color.getHexString(),sleeve:sleeve.color.getHexString(),hands:hands.map(h=>h.toArray())}),dispose:()=>dispose(group)};
}
