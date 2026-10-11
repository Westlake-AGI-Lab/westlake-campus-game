import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {waterAvatar,waterGun,reloadProgress,firstPersonWaterRig} from '../client/water-visuals';
import {APPEARANCE_OPTIONS,defaultAppearance} from '../shared/appearance';
import {GEAR,type WaterPlayer,type Weapon} from '../shared/water';
const player=(extra:Partial<WaterPlayer>={}):WaterPlayer=>({id:'visual-test',name:'云谷风',appearance:defaultAppearance(1),team:'orange',alive:true,hp:100,armour:0,credits:2400,weapon:'sprayer',ammo:10,reserve:60,reloadUntil:0,balloons:0,smokes:0,kit:false,x:0,y:0,z:0,yaw:0,pitch:0,crouch:false,moving:false,ack:0,kills:0,deaths:0,shotAt:0,hitAt:0,spawn:1,...extra});
test('toy silhouettes, socket bounds and merged model resource release',()=>{
 const lengths:number[]=[];for(const kind of ['sprayer','stream','precision'] as Weapon[]){const gun=waterGun(kind),bounds=new T.Box3().setFromObject(gun.group);lengths.push(gun.muzzle.z);assert.ok(bounds.containsPoint(gun.rightGrip));assert.ok(bounds.containsPoint(gun.leftGrip));assert.ok(bounds.min.y<-.25&&bounds.max.y>.25,'Visible grip and reservoir');let meshes=0;const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();gun.group.traverse(o=>{if(o instanceof T.Mesh){meshes++;geometry.add(o.geometry);materials.add(o.material as T.Material);}});assert.ok(meshes<=14,'Static parts must stay merged');let releasedG=0,releasedM=0;geometry.forEach(g=>g.addEventListener('dispose',()=>releasedG++));materials.forEach(m=>m.addEventListener('dispose',()=>releasedM++));gun.dispose();assert.equal(releasedG,geometry.size);assert.equal(releasedM,materials.size);}
 assert.ok(lengths[0]<lengths[1]&&lengths[1]<lengths[2],'All three weapons have different silhouettes');
});
test('support hand refills while grip stays attached through pitch, recoil and equipment changes',()=>{
 const a=waterAvatar(player()),now=10000;try{a.animate(player(),now);const idle=a.diagnostic(),idleMuzzle=a.muzzleWorld();a.animate(player({pitch:.8,shotAt:now}),now+20);const raised=a.muzzleWorld();assert.ok(raised.y>idleMuzzle.y+.2);assert.ok(a.diagnostic().recoil>.5);
 const refill=player({reloadUntil:now+GEAR.sprayer.reloadMs/2});assert.equal(reloadProgress(refill,now),.5);a.animate(refill,now);assert.ok(a.diagnostic().hands[0][1]>idle.hands[0][1]+.1);assert.ok(a.diagnostic().gripError<1e-6);
 for(const weapon of ['precision','stream','sprayer'] as Weapon[])for(const pitch of [-1.35,0,1.35]){a.animate(player({weapon,pitch}),now);assert.equal(a.diagnostic().weapon,weapon);assert.ok(a.diagnostic().gripError<1e-6);assert.ok(a.muzzleWorld().toArray().every(Number.isFinite));}
 }finally{a.dispose();}
 const fp=firstPersonWaterRig(new T.PerspectiveCamera());try{const p=player({appearance:{...defaultAppearance(1),skin:4}});fp.animate(p,now,false);assert.equal(fp.diagnostic().skin,APPEARANCE_OPTIONS.skin[4].color.slice(1));}finally{fp.dispose();}
});
