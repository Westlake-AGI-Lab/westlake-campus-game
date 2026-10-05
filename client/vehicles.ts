import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {PARKING,VEHICLE,type Vehicle} from '../shared/vehicles';
import {heightAt} from '../shared/world';
const COLORS=['#477e8f','#cc9060','#6a8865','#9b738a'];
export function vehicleScene(scene:T.Scene){
 const group=new T.Group();group.name='shared-campus-vehicles';scene.add(group);
 const models=new Map<string,{group:T.Group;wheels:T.Group[];target:Vehicle}>();
 const mat=(color:string,roughness=.6,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 function model(v:Vehicle){
  const root=new T.Group();root.userData.vehicleId=v.id;const paint=mat(COLORS[v.color],.3,.35),glass=mat('#283f49',.15,.45),rubber=mat('#293134',.95),trim=mat('#d8dfdc',.28,.5),seat=mat('#535954');
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent:T.Group=root,r=.08)=>{const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*r),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  box(1.92,.62,4.25,0,.70,0,paint);box(1.76,.72,2.02,0,1.24,-.12,paint);box(1.70,.40,.045,0,1.31,.89,glass);box(1.70,.39,.045,0,1.31,-1.14,glass);
  for(const x of[-.886,.886]){box(.03,.40,1.73,x,1.32,-.13,glass);box(.035,.51,.08,x,1.29,-.1,paint);box(.035,.026,.28,x,1.0,.45,trim);box(.035,.026,.28,x,1,-.6,trim);box(.22,.12,.28,x*1.15,1.17,.6,paint);}
  box(1.88,.17,.17,0,.46,2.15,trim);box(1.88,.17,.17,0,.46,-2.15,trim);box(.6,.19,.055,0,.67,2.16,rubber);
  const headlights=new T.MeshStandardMaterial({color:'#ffefd2',emissive:'#eac782',emissiveIntensity:.45,roughness:.25});
  for(const x of[-.65,.65]){box(.38,.15,.06,x,.82,2.13,headlights);box(.36,.14,.06,x,.82,-2.13,mat('#c05743'));}
  for(const x of[-.45,.45])box(.53,.48,.51,x,.95,-.18,seat);
  const wheels:T.Group[]=[];for(const x of[-.97,.97])for(const z of[-1.35,1.35]){const wheel=new T.Group();wheel.position.set(x,.40,z);const tire=new T.Mesh(new T.CylinderGeometry(.39,.39,.22,16),rubber);tire.rotation.z=Math.PI/2;tire.castShadow=true;wheel.add(tire);const hub=new T.Mesh(new T.CylinderGeometry(.22,.22,.24,12),trim);hub.rotation.z=Math.PI/2;wheel.add(hub);root.add(wheel);wheels.push(wheel);}
  const shadow=new T.Mesh(new T.PlaneGeometry(2.2,4.5),new T.MeshBasicMaterial({color:'#243b2c',transparent:true,opacity:.14,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.035;root.add(shadow);
  root.position.set(v.x,heightAt(v),v.z);root.rotation.y=v.yaw;group.add(root);return {group:root,wheels,target:v};
 }
 const asphalt=new T.Mesh(new T.BoxGeometry(PARKING.w,.10,PARKING.d),mat('#7c8984',.95));asphalt.position.set(PARKING.x,0,PARKING.z);asphalt.receiveShadow=true;scene.add(asphalt);
 const lines=new T.Group();lines.name='parking-bay-markings';scene.add(lines);const lineMaterial=mat('#f1e6cd',.9);
 for(let i=0;i<5;i++){const line=new T.Mesh(new T.BoxGeometry(6.5,.03,.09),lineMaterial);line.position.set(PARKING.x,.075,526+i*8);lines.add(line);}
 const back=new T.Mesh(new T.BoxGeometry(.09,.03,32),lineMaterial);back.position.set(PARKING.x+3.2,.075,542);lines.add(back);
 const c=document.createElement('canvas');c.width=256;c.height=128;const context=c.getContext('2d')!;context.fillStyle='#285b4f';context.fillRect(0,0,256,128);context.fillStyle='#fff2ce';context.font='bold 66px sans-serif';context.textAlign='center';context.fillText('P',128,72);context.font='22px sans-serif';context.fillText('共享汽车 · R 上车',128,108);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
 const sign=new T.Mesh(new T.PlaneGeometry(2.8,1.4),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));sign.position.set(PARKING.x+7,2.1,PARKING.z-18);sign.rotation.y=-Math.PI/2;scene.add(sign);const pole=new T.Mesh(new T.CylinderGeometry(.08,.08,2.6,8),trimPole());pole.position.set(sign.position.x,1.3,sign.position.z);scene.add(pole);
 function trimPole(){return mat('#778a80',.7,.15);}
 return {update(cars:Vehicle[]){for(const v of cars){let e=models.get(v.id);if(!e){e=model(v);models.set(v.id,e);}e.target=v;}},animate(dt:number){for(const e of models.values()){const v=e.target;e.group.position.lerp(new T.Vector3(v.x,heightAt(v),v.z),1-Math.exp(-dt*16));const delta=Math.atan2(Math.sin(v.yaw-e.group.rotation.y),Math.cos(v.yaw-e.group.rotation.y));e.group.rotation.y+=delta*Math.min(1,dt*16);for(const wheel of e.wheels)wheel.rotation.x+=v.speed*dt/.39;}},position:(id:string)=>models.get(id)?.group.position,debug:()=>[...models.values()].map(e=>({id:e.target.id,rendered:!!e.group.parent,position:e.group.position.toArray(),driverId:e.target.driverId})),nearest:(p:{x:number;z:number},cars:Vehicle[])=>cars.filter(v=>!v.driverId&&Math.hypot(v.x-p.x,v.z-p.z)<=VEHICLE.enterRange).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]};
}
