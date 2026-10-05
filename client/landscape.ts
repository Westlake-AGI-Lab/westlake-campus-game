import * as T from 'three';
import {campus} from '../shared/world';
import type {Point} from '../shared/types';
type Draw={box:(w:number,h:number,d:number,x:number,y:number,z:number,color:string,rotation?:number)=>void;mat:(color:string)=>T.MeshStandardMaterial};
export function landscape(scene:T.Scene,{box,mat}:Draw){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#d8d9d3';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#b8bdb6';ctx.lineWidth=1.6;for(let y=0;y<=256;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=(y/64%2)*64;x<=256;x+=128){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+64);ctx.stroke();}}
 const texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;const paving=new T.MeshStandardMaterial({map:texture,roughness:.92,color:'#ecece5'});
 function strip(points:Point[],width:number,y:(t:number)=>number,material:T.Material){const vertices:number[]=[],uv:number[]=[],indices:number[]=[],lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));const total=lengths.at(-1)!;
  for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;for(const s of[-1,1]){const x=points[i].x+s*dz/l*width/2,z=points[i].z-s*dx/l*width/2;vertices.push(x,y(lengths[i]/total),z);uv.push(x/2,z/2);}if(i<points.length-1){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;scene.add(mesh);return{lengths,total};
 }
 function smooth(points:Point[]){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p.x,0,p.z)),false,'centripetal');return curve.getPoints(Math.max(12,points.length*8)).map(v=>({x:v.x,z:v.z}));}
 for(const r of campus.roads){const pts=r.smooth?smooth(r.points):r.points;strip(pts,r.width,()=>-.01,r.style==='street'?mat('#919c96'):r.style==='running'?mat('#65736a'):paving);if(r.style==='street'){
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),rotation=-Math.atan2(dx,dz);for(const sign of[-1,1])box(.24,.12,len,(a.x+b.x)/2+sign*dz/len*r.width/2,.03,(a.z+b.z)/2-sign*dx/len*r.width/2,'#dbdfd6',rotation);}
 }}
 for(const b of [...campus.bridges,...(campus.waterWalkways||[])]){const pts=b.points,y=(t:number)=>.08+b.rise*Math.sin(Math.PI*t)**2;const {lengths,total}=strip(pts,b.w,y,paving);strip(pts,b.w, t=>y(t)-.65,mat('#b8c1bb'));
  for(const sign of[-1,1]){const rail:T.Vector3[]=[];for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],c=pts[Math.min(pts.length-1,i+1)],dx=c.x-a.x,dz=c.z-a.z,len=Math.hypot(dx,dz),x=pts[i].x+sign*dz/len*(b.w/2-.12),z=pts[i].z-sign*dx/len*(b.w/2-.12),h=y(lengths[i]/total);rail.push(new T.Vector3(x,h+1.2,z));if(i)for(let f=.1;f<lengths[i]-lengths[i-1];f+=.85){const t=f/(lengths[i]-lengths[i-1]),xx=T.MathUtils.lerp(rail[i-1].x,x,t),zz=T.MathUtils.lerp(rail[i-1].z,z,t),hh=y((lengths[i-1]+f)/total);box(.06,1.1,.06,xx,hh+.55,zz,'#aebdb4');}}
   scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rail),Math.max(24,rail.length*2),.07,5,false),mat('#a5b6ad')));
  }
  // Broad concrete arch beams reveal the bridge structure above the channel.
  for(const sign of[-1,1])for(let i=1;i<pts.length;i++){const a=pts[i-1],c=pts[i],dx=c.x-a.x,dz=c.z-a.z,l=Math.hypot(dx,dz),t=(lengths[i]+lengths[i-1])/2/total;box(.65,.8,l+.08,(a.x+c.x)/2+sign*dz/l*b.w*.42,y(t)-.35,(a.z+c.z)/2-sign*dx/l*b.w*.42,'#c5cec6',-Math.atan2(dx,dz));}
 }
 // Stone coping follows the actual banks, instead of floating disconnected curbs.
 for(const water of campus.waterBodies.filter(w=>!w.id.includes('-under-')))for(const edge of[water.outer,water.inner]){if(!edge.length)continue;strip([...edge,edge[0]],.7,()=>.02,mat('#babdaf'));}
 return {paving};
}
