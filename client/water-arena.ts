import {waterArena,type WaterMode} from '../shared/water-modes';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {academicLoop} from './academic-loop';
import {surfaceTexture} from './art';
import {WATER_BUILDINGS,WATER_BOUNDS,WATER_CAMPUS,WATER_COVER,WATER_SITES,WATER_ROADS,WATER_BANKS,WATER_BRIDGES} from '../shared/water-arena';
import type {Point} from '../shared/types';

// Render only the shared campus core; the original roaming scene is not loaded.
export function buildWaterArena(scene:T.Scene,mode:WaterMode='classic'){
 const arena=waterArena(mode),buildings=mode==='classic'?WATER_BUILDINGS:WATER_BUILDINGS.filter(b=>b.id==='E0'),covers=mode==='classic'?WATER_COVER:arena.boxes.filter(b=>b.kind!=='building');
 const b=arena.bounds,world=new T.Scene(),scale=WATER_CAMPUS.scale;
 const mats=new Map<string,T.MeshStandardMaterial>(),batches=new Map<string,T.Matrix4[]>(),dummy=new T.Object3D(),stone=surfaceTexture('stone'),grass=surfaceTexture('grass',210);
 const mat=(color:string)=>{if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:color==='#76959f'?.25:.85,metalness:color==='#76959f'?.25:0,map:color==='#76959f'?null:stone}));return mats.get(color)!;};
 function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,rotation=0){dummy.position.set(x,y,z);dummy.rotation.set(0,-rotation,0);dummy.scale.set(w,h,d);dummy.updateMatrix();if(!batches.has(color))batches.set(color,[]);batches.get(color)!.push(dummy.matrix.clone());}
 function cylinder(r1:number,r2:number,h:number,x:number,y:number,z:number,color:string,n=64){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,n),mat(color));m.position.set(x,y,z);world.add(m);}
 for(const building of buildings){
  if(building.kind==='loop'){academicLoop(world,{...building,doorAngles:[]});continue;}
  if(building.kind==='hall'){
   const r=building.radius!,x=building.x,z=building.z;
   cylinder(r,r,14,x,7,z,'#899d99');cylinder(r+3,r+3,1,x,14.5,z,'#e0dcd0');cylinder(r-1,r+2,1.4,x,15.7,z,'#dfd9c8');cylinder(r*.63,r*.65,8,x,20.3,z-5,'#e0d8c6');cylinder(r*.66,r*.66,.75,x,24.8,z-5,'#eee7d6');
   for(let i=0;i<48;i++){const a=i/48*Math.PI*2;box(2.5,13.6,3,x+Math.cos(a)*(r+.4),7,z+Math.sin(a)*(r+.4),'#ede9dc',a);}cylinder(r+8,r+8,.12,x,.01,z,'#d5d5c3');
  }else if(building.kind==='library')for(const p of building.parts!){
   box(p.w,p.h,p.d,p.x,p.h/2,p.z,'#d5d9d0');box(p.w+2,.65,p.d+2,p.x,p.h+.1,p.z,'#edece2');
   const fh=p.h/(p.floors||1);for(let floor=0;floor<(p.floors||1);floor++){const y=fh*(floor+.54),wh=fh*.58;for(const side of [-1,1]){
    box(p.w-5,wh,.2,p.x,y,p.z+side*(p.d/2+.12),'#76959f');box(.2,wh,p.d-5,p.x+side*(p.w/2+.12),y,p.z,'#76959f');
    box(p.w,.36,.45,p.x,(floor+1)*fh,p.z+side*(p.d/2+.12),'#ecebe2');
    for(let x=-p.w/2+3;x<p.w/2-2;x+=3.5)box(.16,wh,.37,p.x+x,y,p.z+side*(p.d/2+.24),'#e0e5df');
    for(let z=-p.d/2+3;z<p.d/2-2;z+=3.5)box(.37,wh,.16,p.x+side*(p.w/2+.24),y,p.z+z,'#e0e5df');
   }}
  }else{
   cylinder(.3,building.radius!,building.h,building.x,building.h/2,building.z,'#c4c4b2',48);
   for(let i=0;i<32;i++){const a=i/32*Math.PI*2,r=building.radius!;const shape=new T.Shape();shape.moveTo(r*.97,0);shape.lineTo(.3,building.h);shape.lineTo(.55,building.h);shape.lineTo(r+.5,0);const fin=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false}),mat('#deddd0'));fin.rotation.y=a;fin.position.set(building.x,0,building.z);world.add(fin);}
  }
 }
 for(const [color,matrices]of batches){const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat(color),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));world.add(mesh);}
 const core=new T.Group();for(const child of [...world.children])core.add(child);core.scale.setScalar(scale);core.position.set(-WATER_CAMPUS.origin.x*scale,0,-WATER_CAMPUS.origin.z*scale);scene.add(core);
 const ground=new T.Mesh(new T.PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ),new T.MeshStandardMaterial({map:grass,color:'#a2b88d',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set((b.minX+b.maxX)/2,-.12,(b.minZ+b.maxZ)/2);scene.add(ground);
 function clip(poly:Point[]){let out=poly;for(const [axis,limit,greater] of [['x',b.minX,true],['x',b.maxX,false],['z',b.minZ,true],['z',b.maxZ,false]] as const){const input=out;out=[];for(let i=0;i<input.length;i++){const a=input[i],c=input[(i+1)%input.length],ai=greater?a[axis]>=limit:a[axis]<=limit,ci=greater?c[axis]>=limit:c[axis]<=limit;if(ai)out.push(a);if(ai!==ci){const t=(limit-a[axis])/(c[axis]-a[axis]);out.push({x:a.x+(c.x-a.x)*t,z:a.z+(c.z-a.z)*t});}}}return out;}
 const pavingBatches=new Map<string,T.BufferGeometry[]>();
 function shape(poly:Point[],color:string,y:number,holes:Point[][]=[]){const points=clip(poly);if(points.length<3)return;const s=new T.Shape(points.map(p=>new T.Vector2(p.x,-p.z)));for(const hole of holes){const h=clip(hole);if(h.length>=3)s.holes.push(new T.Path(h.map(p=>new T.Vector2(p.x,-p.z))));}const geometry=new T.ShapeGeometry(s);geometry.rotateX(-Math.PI/2);geometry.translate(0,y,0);if(!pavingBatches.has(color))pavingBatches.set(color,[]);pavingBatches.get(color)!.push(geometry);}
 function strip(points:Point[],width:number,color:string,y:number){for(let i=1;i<points.length;i++){const a=points[i-1],c=points[i],dx=c.x-a.x,dz=c.z-a.z,n=Math.hypot(dx,dz);if(!n)continue;const x=dz/n*width/2,z=-dx/n*width/2;shape([{x:a.x+x,z:a.z+z},{x:c.x+x,z:c.z+z},{x:c.x-x,z:c.z-z},{x:a.x-x,z:a.z-z}],color,y);}}
 for(const road of WATER_ROADS)strip(road.points,road.width,road.style==='street'?'#a4aba1':'#d9dbcf',-.025);
 for(const water of WATER_BANKS)shape(water.outer,'#6aa9b0',-.015,[water.inner,...water.holes||[]]);
 for(const bridge of WATER_BRIDGES)strip(bridge.points,bridge.w,'#dce0d2',.015);
 for(const [color,geometries]of pavingBatches){const mesh=new T.Mesh(mergeGeometries(geometries)!,mat(color));scene.add(mesh);for(const g of geometries)g.dispose();}
 const annulus=new T.Mesh(new T.RingGeometry(69,77,96),new T.MeshStandardMaterial({color:'#d6d7c8',roughness:1,side:T.DoubleSide}));annulus.rotation.x=-Math.PI/2;annulus.position.set(0,-.012,37.5);if(mode==='classic')scene.add(annulus);else{annulus.geometry.dispose();(annulus.material as T.Material).dispose();}
 function localBox(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent:T.Object3D=scene,rotation=0){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.rotation.y=-rotation;parent.add(m);return m;}
 for(const cover of covers){const g=new T.Group();g.position.set(cover.x,0,cover.z);g.rotation.y=-cover.rotation;scene.add(g);localBox(cover.w,cover.h,cover.d,0,cover.h/2,0,cover.color,g);if(cover.kind==='screen'){
  for(const x of [-cover.w/2+.12,cover.w/2-.12]){localBox(.2,cover.h+.15,.2,x,cover.h/2,0,'#dce6df',g);localBox(.7,.14,1.4,x,.07,0,'#7b8985',g);}for(let y=.4;y<cover.h;y+=.55)localBox(cover.w-.3,.055,cover.d+.035,0,y,0,'#b9d4cb',g);
 }else if(cover.kind==='crate'){for(const y of [.2,cover.h-.2])localBox(cover.w+.06,.13,cover.d+.06,0,y,0,'#917859',g);}
 else{localBox(cover.w+.15,.18,cover.d+.15,0,cover.h,0,'#ddded0',g);localBox(cover.w-.4,.45,cover.d-.4,0,cover.h+.1,0,'#6d987a',g);}}
 function label(text:string,x:number,y:number,z:number,width:number){const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#315b5a';ctx.fillRect(0,0,768,128);ctx.fillStyle='#eff4e8';ctx.font='bold 58px sans-serif';ctx.textAlign='center';ctx.fillText(text,384,84);const m=new T.Mesh(new T.PlaneGeometry(width,width/6),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),side:T.DoubleSide}));m.position.set(x,y,z);scene.add(m);}
 if(mode==='classic')label('图书中心 · E12',-58,3,-103,11);label('学术会堂 · E0',40,3,-9,10);if(mode==='classic')label('学术环 · E10',-72,3,2,10);
 for(const site of arena.sites){const ring=new T.Mesh(new T.RingGeometry(4.2,4.5,48),new T.MeshBasicMaterial({color:'#eca958',side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.035,site.z);scene.add(ring);label(site.id+' · '+site.name,site.x,3,site.z-6,10);}
 // Temporary perimeter panels mark the cropped play area without extra campus geometry.
 for(const x of [b.minX-.4,b.maxX+.4])localBox(.8,3,b.maxZ-b.minZ+.8,x,1.5,(b.minZ+b.maxZ)/2,'#8faaa0');
 for(const z of [b.minZ-.4,b.maxZ+.4])localBox(b.maxX-b.minX+.8,3,.8,(b.minX+b.maxX)/2,1.5,z,'#8faaa0');
 // Small decorative trees are outside routes; trunks intentionally have no collision.
 for(const p of [{x:-38,z:-36},{x:-38,z:43},{x:-22,z:23},{x:5,z:70},{x:65,z:57},{x:-73,z:-83}]){if(p.x<b.minX||p.x>b.maxX||p.z<b.minZ||p.z>b.maxZ)continue;localBox(.35,3,.35,p.x,1.5,p.z,'#8f775a');const m=new T.Mesh(new T.IcosahedronGeometry(2.5,1),mat('#7f9f73'));m.position.set(p.x,4,p.z);scene.add(m);}
 return {buildingIds:buildings.map(b=>b.id),coverCount:covers.length};
}
