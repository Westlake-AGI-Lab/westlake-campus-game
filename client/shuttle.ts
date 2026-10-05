import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {SHUTTLE,SHUTTLE_STOPS,type Shuttle} from '../shared/shuttle';
import {heightAt} from '../shared/world';
import {APPEARANCE_OPTIONS,defaultAppearance} from '../shared/appearance';
import {COLORS} from '../shared/config';
import type {Player,Point} from '../shared/types';
export function shuttleScene(scene:T.Scene){
 const models=new Map<string,{root:T.Group;wheels:T.Group[];seats:{root:T.Group;head:T.MeshStandardMaterial;coat:T.MeshStandardMaterial;hair:T.MeshStandardMaterial}[];target:Shuttle;label:HTMLElement}>();
 const mat=(color:string,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 function textTexture(text:string,sub:string){const c=document.createElement('canvas');c.width=512;c.height=160;const ctx=c.getContext('2d')!;ctx.fillStyle='#214f45';ctx.fillRect(0,0,512,160);ctx.fillStyle='#ffecba';ctx.textAlign='center';ctx.font='bold 42px sans-serif';ctx.fillText(text,256,67,490);ctx.font='24px sans-serif';ctx.fillText(sub,256,122,490);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
 function create(v:Shuttle){
  const root=new T.Group();root.name=v.id;const paint=mat(v.id==='shuttle-1'?'#e6c474':'#c5d4ad',.35,.25),green=mat('#2e6255',.4,.15),glass=new T.MeshStandardMaterial({color:'#759f9c',transparent:true,opacity:.38,roughness:.13,metalness:.1,depthWrite:false}),trim=mat('#d8e1d7',.3,.3),rubber=mat('#293331',.95),seat=mat('#426c60');
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent=root){const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.07),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  box(2.45,1.0,7.65,0,1.0,0,paint);box(2.5,.23,7.8,0,2.97,0,paint);box(2.44,.13,7.67,0,.47,0,green);
  for(const x of[-1.23,1.23]){box(.065,.17,7.4,x,1.57,0,green);box(.06,.95,7.1,x,2.16,0,glass);for(let z=-3.5;z<3.6;z+=1.17)box(.09,1.13,.10,x,2.2,z,paint);box(.16,.25,.45,x*1.12,2.05,3.23,green);}
  box(2.25,1.1,.06,0,2.12,3.84,glass);box(2.25,1.05,.06,0,2.12,-3.84,glass);box(2.46,.16,.13,0,.63,3.88,trim);box(2.46,.16,.13,0,.63,-3.88,trim);
  box(.1,1.6,.08,0,1.74,3.87,paint);const light=new T.MeshStandardMaterial({color:'#fff0bd',emissive:'#eec477',emissiveIntensity:.55});for(const x of[-.88,.88]){box(.4,.22,.05,x,.97,3.89,light);box(.26,.23,.05,x,.97,-3.89,mat('#be6650'));}
  const signMaterial=new T.MeshBasicMaterial({map:textTexture('校园环线 '+v.id.slice(-1),'WESTLAKE AGI LAB'),side:T.DoubleSide});
  const frontSign=new T.Mesh(new T.PlaneGeometry(1.75,.55),signMaterial);frontSign.position.set(0,2.73,3.88);root.add(frontSign);
  for(const side of[-1,1]){const sign=new T.Mesh(new T.PlaneGeometry(3.9,.63),signMaterial);sign.position.set(side*1.27,1.05,0);sign.rotation.y=side*Math.PI/2;root.add(sign);}
  const seats=[];for(let i=0;i<SHUTTLE.capacity;i++){const x=i%2?-.57:.57,z=2.5-Math.floor(i/2)*.95;box(.53,.13,.53,x,.83,z,seat);box(.54,.48,.12,x,1.12,z-.24,seat);
   const passenger=new T.Group(),head=mat('#e8c8a5'),coat=mat('#477e8f'),hair=mat('#3d3730');passenger.position.set(x,0,z);box(.34,.47,.26,0,1.23,0,coat,passenger);
   const face=new T.Mesh(new T.SphereGeometry(.18,10,8),head);face.position.set(0,1.64,0);passenger.add(face);const cap=new T.Mesh(new T.SphereGeometry(.185,10,8,0,Math.PI*2,0,Math.PI*.5),hair);cap.position.set(0,1.68,0);passenger.add(cap);passenger.visible=false;root.add(passenger);seats.push({root:passenger,head,coat,hair});}
  const wheels:T.Group[]=[];for(const x of[-1.22,1.22])for(const z of[-2.55,2.55]){const wheel=new T.Group();wheel.position.set(x,.55,z);const tire=new T.Mesh(new T.CylinderGeometry(.50,.5,.23,18),rubber);tire.rotation.z=Math.PI/2;tire.castShadow=true;wheel.add(tire);const hub=new T.Mesh(new T.CylinderGeometry(.29,.29,.25,12),trim);hub.rotation.z=Math.PI/2;wheel.add(hub);root.add(wheel);wheels.push(wheel);}
  const label=document.createElement('div');label.className='shuttle-label';label.hidden=true;document.getElementById('labels')!.append(label);root.position.set(v.x,heightAt(v),v.z);root.rotation.y=v.yaw;scene.add(root);return {root,wheels,seats,target:v,label};
 }
 for(const stop of SHUTTLE_STOPS){const texture=textTexture(stop.name,'校园环线 · B 上车 / 下车'),sign=new T.Mesh(new T.PlaneGeometry(3.4,1.06),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));sign.position.set(stop.point.x,2.8,stop.point.z);sign.rotation.y=stop.pose.yaw+Math.PI/2;scene.add(sign);
  const pole=new T.Mesh(new T.CylinderGeometry(.07,.07,2.7,8),mat('#48675c',.5));pole.position.set(stop.point.x,1.35,stop.point.z);scene.add(pole);
  const pad=new T.Mesh(new T.BoxGeometry(3,.08,3),mat('#c9ceba'));pad.position.set(stop.point.x,.015,stop.point.z);pad.receiveShadow=true;scene.add(pad);
 }
 return {update(buses:Shuttle[],players:Player[]){for(const v of buses){let e=models.get(v.id);if(!e){e=create(v);models.set(v.id,e);}e.target=v;e.label.textContent=`环线校车 ${v.id.slice(-1)} · ${v.passengerIds.length}/${SHUTTLE.capacity} 人`;
   e.seats.forEach((seat,i)=>{const p=players.find(p=>p.id===v.passengerIds[i]);seat.root.visible=!!p;if(p){const a=p.appearance||defaultAppearance(p.color);seat.head.color.set(APPEARANCE_OPTIONS.skin[a.skin].color);seat.coat.color.set(COLORS[a.coat]);seat.hair.color.set(APPEARANCE_OPTIONS.hairColor[a.hairColor].color);}});
  }},animate(dt:number){for(const e of models.values()){e.root.position.lerp(new T.Vector3(e.target.x,heightAt(e.target),e.target.z),1-Math.exp(-dt*16));const d=Math.atan2(Math.sin(e.target.yaw-e.root.rotation.y),Math.cos(e.target.yaw-e.root.rotation.y));e.root.rotation.y+=d*Math.min(1,dt*16);for(const wheel of e.wheels)wheel.rotation.x+=e.target.speed*dt/.5;}},project(camera:T.Camera){for(const e of models.values()){const p=e.root.position.clone().add(new T.Vector3(0,3.9,0)),distance=camera.position.distanceTo(p);p.project(camera);e.label.hidden=p.z>1||p.z<-1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1||distance>180;e.label.style.left=`${(p.x*.5+.5)*innerWidth}px`;e.label.style.top=`${(-p.y*.5+.5)*innerHeight}px`;}},position:(id:string)=>models.get(id)?.root.position,nearest:(p:Point,buses:Shuttle[])=>buses.filter(b=>b.passengerIds.length<SHUTTLE.capacity&&Math.hypot(b.x-p.x,b.z-p.z)<=SHUTTLE.enterRange).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0],debug:()=>[...models.values()].map(e=>({id:e.target.id,position:e.root.position.toArray(),passengers:e.target.passengerIds.length,visibleSeats:e.seats.filter(s=>s.root.visible).length,rendered:!!e.root.parent}))};
}
