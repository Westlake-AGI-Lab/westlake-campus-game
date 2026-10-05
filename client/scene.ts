import {FRUIT_TREES} from '../shared/fruit';
import {buildingName} from '../shared/buildings';
import * as T from 'three';
import {campus,blocked,insidePolygon,insideBox} from '../shared/world';
import type {Building,Point} from '../shared/types';
import {academicLoop} from './academic-loop';
import {landmark} from './landmarks';
import {landscape} from './landscape';
import {surfaceTexture} from './art';
import {PARKING} from '../shared/vehicles';
export function buildCampus(scene:T.Scene){
 const cameraBlockers:T.Object3D[]=[];
 const palette:Record<string,T.MeshStandardMaterial>={};const batches=new Map<string,T.Matrix4[]>();
 const stone=surfaceTexture('stone'),grass=surfaceTexture('grass',210),waterTexture=surfaceTexture('water',.06);
 const glassColors=new Set(['#7c999e','#829d9d','#526b72','#85a0a3','#899d99','#718b91']);
 const mat=(color:string,rough=.83)=>palette[color]||(palette[color]=new T.MeshStandardMaterial({color,roughness:glassColors.has(color)?.22:rough,metalness:glassColors.has(color)?.35:0,map:glassColors.has(color)?null:stone,envMapIntensity:glassColors.has(color)?1.25:.45}));
 const water=new T.MeshStandardMaterial({color:'#4f9697',map:waterTexture,bumpMap:waterTexture,bumpScale:.15,roughness:.24,metalness:.3,envMapIntensity:1.5});
 const dummy=new T.Object3D();
 function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,rotation=0){dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,-rotation,0);dummy.updateMatrix();if(!batches.has(color))batches.set(color,[]);batches.get(color)!.push(dummy.matrix.clone());}
 function camBox(w:number,h:number,d:number,x:number,y:number,z:number,rotation=0){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat('#ffffff'));mesh.position.set(x,y,z);mesh.rotation.y=-rotation;mesh.updateMatrixWorld();cameraBlockers.push(mesh);}
 const ground=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.MeshStandardMaterial({color:'#91a971',map:grass,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.18;ground.receiveShadow=true;scene.add(ground);
 function shapeMesh(points:Point[],color:string,y:number,holes:Point[][]=[]){const shape=new T.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath();for(const poly of holes){if(!poly.length)continue;const path=new T.Path();poly.forEach((p,i)=>i?path.lineTo(p.x,-p.z):path.moveTo(p.x,-p.z));path.closePath();shape.holes.push(path);}const mesh=new T.Mesh(new T.ShapeGeometry(shape),mat(color));mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
 for(const w of campus.waterBodies){const surface=shapeMesh(w.outer,'#81b5af',-.065,[w.inner,...(w.holes||[])]);surface.material=water;}
 landscape(scene,{box,mat});
 for(const p of campus.plazas)box(p.w,.10,p.d,p.x,0,p.z,'#d5d4c4');
 // Repeated facade parts are instanced globally. Positions come from the shared plan.
 function block(b:Building,x:number,z:number,w:number,d:number,h:number,rotation=0){
 const c=Math.cos(rotation),s=Math.sin(rotation);function partBox(w:number,h:number,d:number,px:number,y:number,pz:number,color:string){box(w,h,d,x+c*(px-x)-s*(pz-z),y,z+s*(px-x)+c*(pz-z),color,rotation);}
 partBox(w,h,d,x,h/2,z,b.kind==='lab'?'#718b91':'#cfd2c9');camBox(w,h,d,x,h/2,z,rotation);
 partBox(Math.min(7,w*.38),2.6,.24,x,1.3,z+d/2+.2,'#526b72');
 partBox(Math.min(8,w*.42),.22,2.2,x,2.85,z+d/2+.9,'#e8e7e1');
 partBox(.08,2.6,.32,x,1.3,z+d/2+.24,'#d9ded6');
 const fh=h/b.floors;
 for(let floor=0;floor<b.floors;floor++){const y=floor*fh+fh*.54,wh=fh*.58;
  for(const sign of[-1,1]){partBox(Math.max(2,w-5),wh,.22,x,y,z+sign*(d/2+.12),'#7c999e');partBox(Math.max(2,w-5),.20,.28,x,y-wh/2,z+sign*(d/2+.2),b.color);partBox(w,.36,.45,x,(floor+1)*fh,z+sign*(d/2+.12),'#e4e4d8');
   for(let wx=-w/2+3;wx<w/2-2;wx+=3.5)partBox(.16,wh,.37,x+wx,y,z+sign*(d/2+.24),'#d9ded6');
   if(b.kind==='residence')for(let wx=-w/2+4;wx<w/2-2;wx+=7){partBox(3,.12,1.4,x+wx,y-wh/2,z+sign*(d/2+.7),'#d4d6ce');partBox(3,.7,.15,x+wx,y-wh/2+.35,z+sign*(d/2+1.3),'#a3b4b0');}
   partBox(.22,wh,Math.max(2,d-5),x+sign*(w/2+.12),y,z,'#829d9d');for(let wz=-d/2+3;wz<d/2-2;wz+=3.5)partBox(.32,wh,.14,x+sign*(w/2+.23),y,z+wz,'#d9ded6');
  }
 }
 // Tall end piers and a shallow roof frame preserve the characteristic HENN bar silhouette.
 for(const sign of[-1,1]){if(b.kind!=='lab'||w>d)partBox(2.0,h+1,d+1.2,x+sign*(w/2-.8),(h+1)/2,z,'#e8e7e1');if(b.kind!=='lab'||d>=w)partBox(w+1.5,h+1,2.0,x,(h+1)/2,z+sign*(d/2-.8),'#e8e7e1');}
 partBox(w+2,.65,d+2,x,h+.1,z,'#e9e8dd');partBox(w-5,.3,d-5,x,h+.58,z,'#a5aea6');
 if(h>15&&b.kind!=='library'){for(let wx=-w/2+6;wx<w/2-4;wx+=11){partBox(5,1.2,3,x+wx,h+1.2,z,'#929d93');partBox(.22,1.6,d-5,x+wx,h+1.25,z,'#d8ddd4');}for(const sign of[-1,1])partBox(w-3,1.5,.2,x,h+1.3,z+sign*(d/2-2),'#dae0d7');}
 }
 function ringBand(cx:number,cz:number,r:number,width:number,y0:number,y1:number,start:number,end:number,color:string){const vertices:number[]=[],idx:number[]=[];const segments=Math.ceil((end-start)*24);for(let i=0;i<=segments;i++){const a=start+(end-start)*i/segments;for(const yy of[y0,y1])for(const rr of[r-width/2,r+width/2])vertices.push(cx+Math.cos(a)*rr,yy,cz+Math.sin(a)*rr);if(i<segments){const v=i*4;idx.push(v,v+4,v+1,v+1,v+4,v+5,v+2,v+3,v+6,v+3,v+7,v+6,v+1,v+5,v+3,v+3,v+5,v+7,v,v+2,v+4,v+2,v+6,v+4);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(idx);g.computeVertexNormals();const m=mat(color);m.side=T.DoubleSide;const mesh=new T.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
 function cylinder(r1:number,r2:number,h:number,x:number,y:number,z:number,color:string,segments=64){const mesh=new T.Mesh(new T.CylinderGeometry(r1,r2,h,segments),mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
 for(const b of campus.buildings){
  if(landmark(scene,b,{box,mat,camBox,cylinder}))continue;
  if(b.kind==='loop'){
   academicLoop(scene,b);
   for(const c of campus.colliders as (typeof campus.colliders[number]&{objectId?:string})[])if(c.objectId===b.id)camBox(c.w,c.w>2?3.2:23.2,c.d,c.x,c.w>2?1.6:11.6,c.z,c.rotation);
  }else if(b.kind==='hall'){
   const r=b.radius!;cylinder(r,r,14,b.x,7,b.z,'#899d99');cylinder(r+3,r+3,1,b.x,14.5,b.z,'#e0dcd0');cylinder(r-1,r+2,1.4,b.x,15.7,b.z,'#dfd9c8');cylinder(r*.63,r*.65,8,b.x,20.3,b.z-5,'#e0d8c6');cylinder(r*.66,r*.66,.75,b.x,24.8,b.z-5,'#eee7d6');
   for(let i=0;i<48;i++){const a=i/48*Math.PI*2,x=b.x+Math.cos(a)*(r+.4),z=b.z+Math.sin(a)*(r+.4);box(2.5,13.6,3.0,x,7,z,'#ede9dc',a);}camBox(r*1.75,23,r*1.75,b.x,11,b.z);
   cylinder(r+8,r+8,.12,b.x,.01,b.z,'#d5d5c3');
  }else if(b.kind==='beacon'){
   cylinder(.3,b.radius!,b.h,b.x,b.h/2,b.z,'#c4c4b2',48);cylinder(b.radius!+.6,b.radius!+.6,.65,b.x,9,b.z,'#babdaf');
   for(let i=0;i<44;i++){const a=i/44*Math.PI*2;const shape=new T.Shape();shape.moveTo(b.radius!*.97,0);shape.lineTo(.3,b.h);shape.lineTo(.55,b.h);shape.lineTo(b.radius!+0.5,0);const geo=new T.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});const fin=new T.Mesh(geo,mat('#d8d8c8'));fin.rotation.y=a;fin.position.set(b.x,0,b.z);scene.add(fin);}
   camBox(18,b.h,18,b.x,b.h/2,b.z);
  }else if(b.kind==='library'){
   for(const part of b.parts!){block({...b,floors:part.floors||1},part.x,part.z,part.w,part.d,part.h,part.rotation||0);}

  }else if(b.kind==='gate'){
   if(b.id==='northgate'){for(const a of b.parts!)box(a.w,a.h,a.d,a.x,a.h/2,a.z,'#e0dfd4',.25);continue;}
   for(const sign of[-1,1])box(4,b.h,b.d,b.x+sign*(b.w/2-2),b.h/2,b.z,'#e9e9df');box(b.w,.7,b.d+1,b.x,b.h+.2,b.z,'#e6e7de');box(b.w,.25,b.d+5,b.x,b.h+.7,b.z,'#d5d9d1');for(let x=-b.w/2+1;x<b.w/2;x+=1.2)box(.10,.12,b.d+3,b.x+x,b.h+.9,b.z,'#edefe4');
  }else if(b.kind==='admin'){
   block({...b,floors:3},b.x,b.z,b.w,b.d,b.h);cylinder(b.w*.20,b.w*.22,3,b.x,b.h+1.8,b.z,'#d9d8c6');cylinder(2,b.w*.2,3,b.x,b.h+4.8,b.z,'#dedbc8');
   for(let i=0;i<25;i++){const a=Math.PI*(i/24);const x=b.x+Math.cos(a)*b.w*.5,z=b.z+Math.sin(a)*b.d*.42;box(.6,9,.6,x,4.5,z,'#b89461');}
  }else if(b.kind==='exchange'){
   if(b.radius){const r=b.radius;const body=cylinder(r,r,b.h,b.x,b.h/2,b.z,'#85a0a3');body.scale.z=.77;for(let i=0;i<36;i++){const a=i/36*Math.PI*2;box(.35,b.h,.35,b.x+Math.cos(a)*(r+.2),b.h/2,b.z+Math.sin(a)*(r+.2)*.77,'#d4ddd3');}for(let y=5;y<b.h;y+=5)ringBand(b.x,b.z,r,1,y,y+.3,0,Math.PI*2,'#c6d6d0');camBox(r*1.8,b.h,r*1.4,b.x,b.h/2,b.z);}else block(b,b.x,b.z,b.w,b.d,b.h);
  }else if(b.kind==='sports'){
   block(b,b.x,b.z,b.w,b.d,b.h);box(b.w+7,1.1,b.d+7,b.x,b.h+1.2,b.z,'#e0e3d9');box(b.w*.6,.1,b.d*.5,b.x,b.h+1.8,b.z,'#afc0b9');
  }else if(b.kind==='college'){
   for(const part of b.parts!)block({...b,floors:part.floors||b.floors},part.x,part.z,part.w,part.d,part.h,part.rotation||0);
  }else for(const part of b.parts||[b])block({...b,floors:part.floors||b.floors},part.x,part.z,part.w,part.d,part.h,part.rotation||0);
 }
 for(const b of campus.buildings){
  if(b.kind==='student'){const a=b.parts![0];for(const sign of[-1,1]){for(let x=-a.w/2+1;x<a.w/2;x+=1.1)box(.18,15,.5,a.x+x,11,a.z+sign*(a.d/2+.4),'#d2d9cf');for(let z=-a.d/2+1;z<a.d/2;z+=1.1)box(.5,15,.18,a.x+sign*(a.w/2+.4),11,a.z+z,'#d2d9cf');}}
  if(b.id==='C16'){box(b.w*.78,6,b.d*.75,b.x,b.h+3,b.z,'#bbc7bf');for(let k=-b.w/2;k<b.w/2;k+=4)box(.35,8,.4,b.x+k,b.h-4,b.z+b.d/2+.2,'#e4e5dc');}
 }
 // Public lawns and sports fields are geometry, without aerial image textures.
 const extra=campus as typeof campus&{sportsFields:{x:number;z:number;w:number;d:number}[];courts:{x:number;z:number;w:number;d:number;kind?:string}[]};
 for(const f of extra.sportsFields||[]){const radius=f.w/2,straight=f.d/2-radius;function capsule(r:number){const pts:Point[]=[];for(let i=0;i<=32;i++){const a=Math.PI*i/32;pts.push({x:f.x+Math.cos(a)*r,z:f.z+straight+Math.sin(a)*r});}for(let i=0;i<=32;i++){const a=Math.PI+Math.PI*i/32;pts.push({x:f.x+Math.cos(a)*r,z:f.z-straight+Math.sin(a)*r});}return pts;}shapeMesh(capsule(radius),'#bb8367',.02);shapeMesh(capsule(radius-9),'#7d9a65',.04);for(let i=1;i<=8;i++){const pts=capsule(radius-i*1.15).map(p=>new T.Vector3(p.x,.09,p.z));pts.push(pts[0]);const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#e5dbc6'}));scene.add(line);}box(f.w-20,.08,.35,f.x,.10,f.z,'#e3e4cd');for(const sign of[-1,1]){const z=f.z+sign*(f.d/2-24);for(const x of[-4,4])box(.2,2.5,.2,f.x+x,1.25,z,'#e6e6d7');box(8,.2,.2,f.x,2.5,z,'#e6e6d7');}}
 for(const f of extra.courts||[]){
  box(f.w,.1,f.d,f.x,0,f.z,f.kind==='tennis'?'#72948a':f.kind==='volleyball'?'#b89c74':'#ac8267');
  const lines:T.Vector3[][]=[];const line=(pts:number[][])=>lines.push(pts.map(([x,z])=>new T.Vector3(f.x+x,.12,f.z+z)));
  line([[-f.w/2+1,-f.d/2+1],[f.w/2-1,-f.d/2+1],[f.w/2-1,f.d/2-1],[-f.w/2+1,f.d/2-1],[-f.w/2+1,-f.d/2+1]]);line([[-f.w/2+1,0],[f.w/2-1,0]]);
  if(f.kind==='basketball'){line(Array.from({length:41},(_,i)=>[1.9*Math.cos(i/40*Math.PI*2),1.9*Math.sin(i/40*Math.PI*2)]));for(const sign of[-1,1]){const end=sign*(f.d/2-2);line([[-2.5,end],[2.5,end],[2.5,end-sign*5.8],[-2.5,end-sign*5.8],[-2.5,end]]);line(Array.from({length:33},(_,i)=>[6.75*Math.cos(i/32*Math.PI),end-sign*6.75*Math.sin(i/32*Math.PI)]));box(.16,3.4,.16,f.x,1.7,f.z+end+sign,'#b1bdb5');box(1.8,1,.13,f.x,3.15,f.z+end,'#e4e7dd');}
  }else{for(const sign of[-1,1])line([[-f.w/2+2,sign*f.d*.27],[f.w/2-2,sign*f.d*.27]]);for(const sign of[-1,1])box(.10,f.kind==='tennis'?1.1:2.4,.10,f.x+sign*(f.w/2-1),f.kind==='tennis'?.55:1.2,f.z,'#c9d3c8');for(let y=.2;y<=(f.kind==='tennis'?1:2.3);y+=.18)box(f.w-2,.025,.025,f.x,y,f.z,'#d9e0d5');}
  for(const points of lines)scene.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#eee8d8'})));
 }
 // Seeded planting is limited to documented landscape zones and avoids structures, water and paved paths.
 let seed=1187;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const trees:{x:number;z:number;h:number;c:number}[]=[];
 function onRoad(p:Point){return campus.roads.some(r=>{for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz),0,1);if(Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<r.width/2+2)return true;}return false;});}
 const playingAreas=[...(extra.courts||[]),...(extra.sportsFields||[])];
 for(const zone of campus.vegetationZones){for(let i=0,attempt=0;i<zone.count&&attempt<zone.count*10;attempt++){const x=zone.x+(rand()-.5)*zone.w,z=zone.z+(rand()-.5)*zone.d,p={x,z};if(insideBox(p,{...PARKING,rotation:0},3)||blocked(p)||onRoad(p)||playingAreas.some(a=>Math.abs(x-a.x)<a.w/2+4&&Math.abs(z-a.z)<a.d/2+4)||campus.buildings.some(b=>b.kind==='hall'&&Math.hypot(x-b.x,z-b.z)<b.radius!+8)||campus.plazas.some(b=>insideBox(p,{...b,rotation:0})))continue;trees.push({x,z,h:5+rand()*5,c:Math.floor(rand()*3)});i++;}}
 // Keep small clearings around the interactive trees so orbit cameras stay outside large canopies.
 for(let i=trees.length-1;i>=0;i--)if(FRUIT_TREES.some(t=>Math.hypot(t.point.x-trees[i].x,t.point.z-trees[i].z)<14))trees.splice(i,1);
 const trunk=new T.InstancedMesh(new T.CylinderGeometry(.22,.36,1,9),mat('#827357'),trees.length);trees.forEach((p,i)=>{dummy.position.set(p.x,p.h*.25,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,p.h*.5,1);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);});trunk.castShadow=true;scene.add(trunk);
 for(let c=0;c<3;c++){const group=trees.filter(p=>p.c===c),mesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),mat(['#789658','#8fa666','#68946a'][c]),group.length*4);group.forEach((p,i)=>{for(let k=0;k<4;k++){const angle=k*Math.PI*.5+i*.37;dummy.position.set(p.x+Math.cos(angle)*p.h*.13,p.h*(k===3?.80:.64),p.z+Math.sin(angle)*p.h*.13);dummy.scale.set(p.h*.22,p.h*(k===3?.27:.24),p.h*.23);dummy.rotation.set(0,i,0);dummy.updateMatrix();mesh.setMatrixAt(i*4+k,dummy.matrix);mesh.setColorAt(i*4+k,new T.Color().setHSL(.23+rand()*.06,.25+rand()*.12,.78+rand()*.12));}});mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
 // Instanced soft contact shading anchors trees even outside the near-camera shadow map.
 const shadeCanvas=document.createElement('canvas');shadeCanvas.width=shadeCanvas.height=64;const shadeContext=shadeCanvas.getContext('2d')!;
 const shadeGradient=shadeContext.createRadialGradient(32,32,2,32,32,32);shadeGradient.addColorStop(0,'rgba(25,45,29,.27)');shadeGradient.addColorStop(1,'rgba(25,45,29,0)');shadeContext.fillStyle=shadeGradient;shadeContext.fillRect(0,0,64,64);
 const shade=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadeCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),trees.length);
 trees.forEach((p,i)=>{dummy.position.set(p.x,-.165,p.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(p.h*.9,p.h*.9,1);dummy.updateMatrix();shade.setMatrixAt(i,dummy.matrix);});shade.computeBoundingSphere();scene.add(shade);
 // Low garden planting is placed in already documented lawn patches, never on paths.
 const flowers:{x:number;z:number;c:number}[]=[];
 for(const p of trees.slice(0,160))for(let n=0;n<5;n++){const a=rand()*Math.PI*2,r=1+rand()*1.4,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!blocked({x,z})&&!onRoad({x,z}))flowers.push({x,z,c:Math.floor(rand()*3)});}
 const blossoms=new T.InstancedMesh(new T.IcosahedronGeometry(.11,0),new T.MeshStandardMaterial({roughness:.8}),flowers.length);
 flowers.forEach((p,i)=>{box(.025,.26,.025,p.x,.10,p.z,'#68946a');dummy.position.set(p.x,.15,p.z);dummy.rotation.set(rand(),rand(),0);dummy.scale.set(1.4,.65,1.4);dummy.updateMatrix();blossoms.setMatrixAt(i,dummy.matrix);blossoms.setColorAt(i,new T.Color(['#e8c97a','#d5a7b8','#eee9d3'][p.c]));});blossoms.computeBoundingSphere();scene.add(blossoms);
 for(const x of[-40,40])for(const z of[490,560]){box(28,.3,18,x,.17,z,'#899f71');for(const sign of[-1,1])box(28,.45,.35,x,.23,z+sign*9,'#d8ded0');}
 for(const stair of campus.stairs||[]){for(let n=0;n<stair.steps;n++){const d=stair.d-n*stair.d/stair.steps,h=(n+1)*stair.rise/stair.steps;box(stair.w,h,d,stair.x,h/2,stair.z-stair.d/2+d/2,'#dedfd4');}box(stair.w,stair.rise,stair.landingD,stair.x,stair.rise/2,stair.z-stair.d/2-stair.landingD/2,'#dedfd4');for(const sign of[-1,1])for(let d=-stair.d/2;d<=stair.d/2;d+=2){const y=stair.rise*(stair.d/2-d)/stair.d;box(.12,1.1,.12,stair.x+sign*(stair.w/2+.15),y+.55,stair.z+d,'#a7b9ad');}}
 ringBand(0,505,22,.6,.06,.12,0,Math.PI*2,'#abaea3');
 // Outdoor furniture and repeated lighting are simple self-made geometry.
 for(const r of campus.roads.filter(r=>r.width>=12)){for(let n=1;n<r.points.length;n++){const a=r.points[n-1],b=r.points[n],len=Math.hypot(b.x-a.x,b.z-a.z);for(let f=15;f<len;f+=35){const t=f/len,x=T.MathUtils.lerp(a.x,b.x,t)+r.width*.65,z=T.MathUtils.lerp(a.z,b.z,t);if(blocked({x,z}))continue;box(.15,5,.15,x,2.5,z,'#a1afa0');box(1.1,.16,.65,x,5.1,z,'#e6e4c8');}}}
 for(const[x,z]of[[0,80],[-110,35],[20,-60],[120,65],[-240,200],[250,210]]){box(2.6,.14,.7,x,.65,z,'#ab8c66');for(const d of[-.8,.8])box(.2,.6,.5,x+d,.3,z,'#7d8e80');box(2.6,.55,.15,x,.94,z-.35,'#ab8c66');}
 const b=campus.meta.bounds;for(const x of[b.minX,b.maxX]){box(.25,1.5,b.maxZ-b.minZ,x,.75,(b.minZ+b.maxZ)/2,'#a8b9a2');}for(const z of[b.minZ,b.maxZ]){box(b.maxX-b.minX,1.5,.25,(b.minX+b.maxX)/2,.75,z,'#a8b9a2');}
 // Wayfinding boards use generated canvas text; no external font or reference photograph is embedded.
 for(const b of campus.buildings.filter(b=>['E0','library','A1','A2','southgate','E1-E3','E4-E5','E6-E7','E8-E9'].includes(b.id))){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#355c50';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f4f2dc';ctx.textAlign='center';ctx.font='36px "PingFang SC", sans-serif';ctx.fillText(buildingName(b),256,60,480);ctx.font='14px sans-serif';ctx.fillText('WESTLAKE UNIVERSITY · YUNGU',256,100);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(4,1),new T.MeshBasicMaterial({map:texture}));sign.position.set(b.x,1.35,b.z+b.d/2+6);scene.add(sign);box(.14,1.8,.14,sign.position.x-1.5,.9,sign.position.z,'#7a8b78');box(.14,1.8,.14,sign.position.x+1.5,.9,sign.position.z,'#7a8b78');}
 const cube=new T.BoxGeometry(1,1,1);for(const[color,matrices]of batches){const cells=new Map<string,T.Matrix4[]>();for(const m of matrices){const k=Math.floor(m.elements[12]/180)+','+Math.floor(m.elements[14]/180);if(!cells.has(k))cells.set(k,[]);cells.get(k)!.push(m);}for(const cell of cells.values()){const mesh=new T.InstancedMesh(cube,mat(color),cell.length);cell.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=['#cfd2c9','#e4e5db','#c9c3ae','#718b91','#e8e7e1','#edece6','#526b72'].includes(color);mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);}}
 return {cameraBlockers,animateWater:(time:number)=>{waterTexture.offset.set(time*.003,time*.0015);}};
}
