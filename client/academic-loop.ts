import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Building} from '../shared/types';

// Adapted from the user's academic-ring reconstruction, checked against HENN's
// ground-floor plan, section and built photographs. Dimensions remain estimates.
export function academicLoop(scene:T.Scene,b:Building){
 const scale=b.outerRadius!/152,ri=b.innerRadius!,ro=b.outerRadius!,end=b.arc![1]*Math.PI/180;
 const materials={
  white:new T.MeshStandardMaterial({color:'#e9eae5',roughness:.65,side:T.DoubleSide}),
  metal:new T.MeshStandardMaterial({color:'#74868a',roughness:.35,metalness:.5,side:T.DoubleSide}),
  glass:new T.MeshStandardMaterial({color:'#9fbac1',roughness:.2,metalness:.25,transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide}),
  glazing:new T.MeshStandardMaterial({color:'#647f87',roughness:.3,metalness:.25,side:T.DoubleSide}),
  roofGlass:new T.MeshStandardMaterial({color:'#758f99',roughness:.25,metalness:.4,transparent:true,opacity:.64,depthWrite:false,side:T.DoubleSide}),
  stone:new T.MeshStandardMaterial({color:'#d0d0c9',roughness:.87,side:T.DoubleSide}),
 };
 type Material=keyof typeof materials;
 const batches=new Map<Material,T.BufferGeometry[]>(),dummy=new T.Object3D();
 function put(g:T.BufferGeometry,m:Material){if(!batches.has(m))batches.set(m,[]);const geom=g.index?g.toNonIndexed():g.clone();geom.deleteAttribute('uv');batches.get(m)!.push(geom);g.dispose();}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:Material='white',a=0){dummy.position.set(x,y,z);dummy.rotation.set(0,-a,0);dummy.scale.set(w,h,d);dummy.updateMatrix();put(new T.BoxGeometry(1,1,1).applyMatrix4(dummy.matrix),m);}
 function rod(a:T.Vector3,c:T.Vector3,r:number,m:Material){const g=new T.CylinderGeometry(r,r,a.distanceTo(c),8);const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),c.clone().sub(a).normalize());g.applyQuaternion(q);g.translate((a.x+c.x)/2,(a.y+c.y)/2,(a.z+c.z)/2);put(g,m);}
 const polar=(r:number,a:number,y=0)=>new T.Vector3(r*Math.cos(a),y,r*Math.sin(a));
 function profile(points:number[][],m:Material,a0=0,a1=end){const v:number[]=[],idx:number[]=[],n=points.length,steps=Math.max(1,Math.ceil((a1-a0)*60));for(let j=0;j<=steps;j++){const a=a0+(a1-a0)*j/steps;for(const[r,y]of points)v.push(r*Math.cos(a),y,r*Math.sin(a));if(j<steps)for(let i=0;i<n;i++){const q=j*n+i,k=j*n+(i+1)%n;idx.push(q,k,q+n,k,k+n,q+n);}}const caps=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(p[0],p[1])),[]);for(const[a,c,d]of caps)idx.push(d,c,a,steps*n+a,steps*n+c,steps*n+d);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();put(g,m);}
 const slab=(inner:number,outer:number,y:number,t:number,m:Material='white')=>profile([[inner,y-t],[outer,y-t],[outer,y],[inner,y]],m);
 const rAt=(y:number)=>ri+y*b.facadeSlope!;
 slab(ri,ro,.10,.25,'stone');
 // Gallery plates stop short of the courtyard glass, preserving the tall atrium.
 for(const y of b.levels!.slice(1,-1)){
  slab(140*scale,ro,y,.46);slab(140*scale,151.5*scale,y+.02,.05,'stone');
  profile([[139.75*scale,y],[140.02*scale,y],[140.02*scale,y+1.1],[139.75*scale,y+1.1]],'white');
  slab(140.15*scale,140.26*scale,y+1.18,.09,'metal');
 }
 // Four projecting, sloped white sunshade bands: the characteristic inner facade.
 for(const y of b.levels!.slice(1)){const r=rAt(y);profile([[r-5.3*scale,y-1],[r-4.8*scale,y-1.22],[r+.65*scale,y-.1],[r+.7*scale,y+.76],[r-1.4*scale,y+.36],[r-3.7*scale,y-.15]],'white');}
 const cuts=[0,...b.doorAngles!.flatMap(a=>[(a-b.doorHalfAngle!)*Math.PI/180,(a+b.doorHalfAngle!)*Math.PI/180]),end];
 for(let j=0;j<4;j++){
  const y0=[.12,7.4,12.4,17.4][j],y1=[6.7,11.7,16.7,22.7][j];
  const pane=(low:number,high:number,a0=0,a1=end)=>profile([[rAt(low),low],[rAt(high),high],[rAt(high)+.045,high],[rAt(low)+.045,low]],'glass',a0,a1);
  if(j===0){pane(3.2,y1);for(let k=0;k<cuts.length-1;k+=2)pane(y0,3.2,cuts[k],cuts[k+1]);}else pane(y0,y1);
 }
 const bay=3.65/137;
 for(let a=0;a<=end;a+=bay){
  const doorway=b.doorAngles!.some(d=>Math.abs(a*180/Math.PI-d)<b.doorHalfAngle!);
  rod(polar(rAt(doorway?3.2:.12),a,doorway?3.2:.12),polar(rAt(23.2),a,23.2),.13,'metal');
  if(Math.round(a/bay)%3===0)for(const rr of[140.1*scale,151*scale])rod(polar(rr,a,.12),polar(rr,a,23.2),.47*scale,'white');
 }
 for(const y of[3.5,7.2,9.6,12.2,14.6,17.2,20.3,23.2])slab(rAt(y)-.07,rAt(y)+.07,y,.10,'metal');
 // Outer research edge with clear doors matching the shared ground collision.
 const outer=151.6*scale;
 profile([[outer,3.2],[outer,22.9],[outer+.05,22.9],[outer+.05,3.2]],'glazing');
 for(let k=0;k<cuts.length-1;k+=2)profile([[outer,.12],[outer,3.2],[outer+.05,3.2],[outer+.05,.12]],'glazing',cuts[k],cuts[k+1]);
 for(let y=4.5;y<23;y+=4.5)slab(outer,ro+.2,y,.42);
 for(let a=0;a<end;a+=.045){const doorway=b.doorAngles!.some(d=>Math.abs(a*180/Math.PI-d)<b.doorHalfAngle!);const p=polar(outer,a);box(p.x,doorway?13.1:11.5,p.z,.15,doorway?19.7:23,.18,'white',a);}
 // Continuous skylight and a radial white grid, rather than an opaque ring roof.
 slab(rAt(23.2),151.8*scale,23.35,.16,'roofGlass');
 slab(149.9*scale,152.3*scale,23.55,.65);slab(rAt(23.2)-.7*scale,rAt(23.2)+.8*scale,23.55,.65);
 for(let r=134*scale;r<151*scale;r+=4.1*scale)slab(r-.10,r+.10,23.62,.22);
 for(let a=0;a<end;a+=bay){const p=polar(141*scale,a);box(p.x,23.7,p.z,22*scale,.26,.18,'white',a);}
 // Open ends reveal the stacked galleries and atrium, as in the plan.
 for(const a of[0,end]){const p=polar(141*scale,a);box(p.x,23.25,p.z,24*scale,.45,.8,'white',a);}
 for(const[m,geometries]of batches){const g=mergeGeometries(geometries,false)!;g.computeBoundingSphere();const mesh=new T.Mesh(g,materials[m]);mesh.position.set(b.x,0,b.z);mesh.name='E10 / '+m;mesh.castShadow=!['glass','roofGlass'].includes(m);mesh.receiveShadow=true;scene.add(mesh);for(const geom of geometries)geom.dispose();}
}
