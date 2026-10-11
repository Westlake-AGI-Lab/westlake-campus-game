import * as T from 'three';

/** Fixed GPU allocation: drops, short jets and rings are recycled, even under sustained fire. */
export function waterEffects(scene:T.Scene,capacity=256){
 const positions=new Float32Array(capacity*3),velocities=new Float32Array(capacity*3),birth=new Float64Array(capacity),life=new Float32Array(capacity),origin=new Float32Array(capacity*3);
 positions.fill(1e6);birth.fill(-1e6);let cursor=0,emitted=0;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(16,16,1,16,16,15);gradient.addColorStop(0,'rgba(240,255,255,1)');gradient.addColorStop(.35,'rgba(126,237,255,.9)');gradient.addColorStop(1,'rgba(126,237,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);
 const texture=new T.CanvasTexture(canvas),material=new T.PointsMaterial({color:'#b7faff',map:texture,size:.095,transparent:true,opacity:.9,depthWrite:false});
 const drops=new T.Points(geometry,material);drops.frustumCulled=false;scene.add(drops);
 const jetGeometry=new T.CylinderGeometry(.011,.024,1,6),ringGeometry=new T.RingGeometry(.7,.8,28);
 const jets=Array.from({length:16},()=>{const mesh=new T.Mesh(jetGeometry,new T.MeshBasicMaterial({color:'#85e9f4',transparent:true,opacity:.66,depthWrite:false}));mesh.visible=false;scene.add(mesh);return{mesh,until:0};});let jetCursor=0;
 const rings=Array.from({length:8},()=>{const mesh=new T.Mesh(ringGeometry,new T.MeshBasicMaterial({color:'#91e5e9',transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);return{mesh,at:0,until:0};});let ringCursor=0;
 function drop(at:T.Vector3,velocity:T.Vector3,now:number,duration:number){const n=cursor++%capacity,k=n*3;origin.set(at.toArray(),k);velocities.set(velocity.toArray(),k);birth[n]=now;life[n]=duration;emitted++;}
 const direction=new T.Vector3(),mid=new T.Vector3(),up=new T.Vector3(0,1,0);
 function splash(at:T.Vector3,now:number,count=12,power=1){for(let n=0;n<count;n++){const angle=Math.random()*Math.PI*2;drop(at,new T.Vector3(Math.cos(angle)*(1+Math.random()*2)*power,(1+Math.random()*2)*power,Math.sin(angle)*(1+Math.random()*2)*power),now,350+Math.random()*260);}}
 return{
  shot:(from:T.Vector3,to:T.Vector3,now:number,hit:boolean)=>{
   direction.subVectors(to,from);const distance=direction.length();if(distance<.01)return;direction.normalize();
   const jet=jets[jetCursor++%jets.length],length=Math.min(distance,14);mid.copy(from).addScaledVector(direction,length/2);jet.mesh.position.copy(mid);jet.mesh.quaternion.setFromUnitVectors(up,direction);jet.mesh.scale.y=length;jet.until=now+95;jet.mesh.visible=true;
   for(let n=0;n<7;n++)drop(from.clone().addScaledVector(direction,.06+n*.045),direction.clone().multiplyScalar(8+Math.random()*4).add(new T.Vector3((Math.random()-.5)*.4,(Math.random()-.5)*.4,(Math.random()-.5)*.4)),now,120+Math.random()*100);
   splash(to,now,hit?18:10,hit?1.2:.7);
  },
  burst:(at:T.Vector3,now:number)=>{splash(at,now,48,2);const ring=rings[ringCursor++%rings.length];ring.mesh.position.set(at.x,.035+Math.max(0,at.y-.6),at.z);ring.at=now;ring.until=now+600;ring.mesh.visible=true;},
  update:(now:number)=>{
   let active=0;for(let n=0;n<capacity;n++){const k=n*3,age=now-birth[n];if(age>=0&&age<life[n]){const s=age/1000;positions[k]=origin[k]+velocities[k]*s;positions[k+1]=origin[k+1]+velocities[k+1]*s-3*s*s;positions[k+2]=origin[k+2]+velocities[k+2]*s;active++;}else positions[k]=positions[k+1]=positions[k+2]=1e6;}
   drops.visible=active>0;(geometry.attributes.position as T.BufferAttribute).needsUpdate=true;
   for(const j of jets){j.mesh.visible=now<j.until;(j.mesh.material as T.MeshBasicMaterial).opacity=.66*Math.max(0,(j.until-now)/95);}
   for(const r of rings){r.mesh.visible=now<r.until;const a=T.MathUtils.clamp((now-r.at)/600,0,1);r.mesh.scale.setScalar(.3+a*3);(r.mesh.material as T.MeshBasicMaterial).opacity=(1-a)*.45;}
  },
  diagnostic:()=>({capacity,active:Array.from(birth).filter((b,n)=>performance.now()-b<life[n]).length,jets:jets.filter(j=>j.mesh.visible).length,rings:rings.filter(r=>r.mesh.visible).length,emitted}),
  dispose:()=>{scene.remove(drops);geometry.dispose();material.dispose();texture.dispose();for(const p of [...jets,...rings]){scene.remove(p.mesh);(p.mesh.material as T.Material).dispose();}jetGeometry.dispose();ringGeometry.dispose();},
 };
}
