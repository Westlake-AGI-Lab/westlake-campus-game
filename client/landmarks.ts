import * as T from 'three';
import type {Building} from '../shared/types';
type Draw={box:(w:number,h:number,d:number,x:number,y:number,z:number,color:string,rotation?:number)=>void;mat:(color:string)=>T.Material;camBox:(w:number,h:number,d:number,x:number,y:number,z:number,rotation?:number)=>void;cylinder:(r1:number,r2:number,h:number,x:number,y:number,z:number,color:string,segments?:number)=>T.Mesh};
export function landmark(scene:T.Scene,b:Building,draw:Draw):boolean{
 const {box,mat,camBox,cylinder}=draw;
 function surface(vertices:number[],indices:number[],color:string){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,mat(color));mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
 function facadeRibbon(horizontal:boolean,sign:number,curve:(t:number)=>number,thickness:number){const length=horizontal?b.w:b.d,vertices:number[]=[],indices:number[]=[];for(let i=0;i<=80;i++){const t=i/80*2-1,v=t*length/2,h=curve(t);for(const y of[h-thickness/2,h+thickness/2])vertices.push(horizontal?b.x+v:b.x+sign*(b.w/2+.6),y,horizontal?b.z+sign*(b.d/2+.6):b.z+v);if(i<80){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}const m=surface(vertices,indices,'#edece6');m.material.side=T.DoubleSide;}
 if(b.kind==='admin'){
  box(b.w,b.h,b.d,b.x,b.h/2,b.z,'#526b72');camBox(b.w,b.h,b.d,b.x,b.h/2,b.z);
  for(const horizontal of[true,false])for(const sign of[-1,1]){
   const length=horizontal?b.w:b.d;const curve=(t:number)=>3.3+(b.h-3.3)*t*t;facadeRibbon(horizontal,sign,curve,1.3);
   for(let v=-length/2+2;v<length/2;v+=3.4){const h=curve(v/(length/2));box(horizontal?1.35:.7,h,horizontal?.7:1.35,horizontal?b.x+v:b.x+sign*(b.w/2+.45),h/2,horizontal?b.z+sign*(b.d/2+.45):b.z+v,'#edece6');box(horizontal?.20:.25,b.h,horizontal?.25:.20,horizontal?b.x+v:b.x+sign*(b.w/2+.14),b.h/2,horizontal?b.z+sign*(b.d/2+.14):b.z+v,'#bd6c43');}
   for(let y=6;y<b.h;y+=5.7)box(horizontal?length:.35,.4,horizontal?.35:length,horizontal?b.x:b.x+sign*(b.w/2+.2),y,horizontal?b.z+sign*(b.d/2+.2):b.z,'#b97c50');
  }
  box(b.w+2,.8,b.d+2,b.x,b.h+.2,b.z,'#eceadf');box(b.w-7,.2,b.d-7,b.x,b.h+.72,b.z,'#88a16f');
  for(let i=0;i<9;i++){const r=b.w*.32*(1-i*.085);cylinder(r*.96,r,1.3,b.x,b.h+1.5+i*1.25,b.z,'#909d9d');cylinder(r+.6,r+.6,.22,b.x,b.h+2.17+i*1.25,b.z,'#e3e1d5');}
  cylinder(b.w*.07,b.w*.07,.45,b.x,b.h+12.55,b.z,'#dddccc');return true;
 }
 if(b.kind==='college'){
  for(const part of b.parts||[b]){
   const frameColor=['H1','H2'].includes(b.id)?'#e9e6da':b.color;const {x,z,w,d,h}=part,floors=part.floors||b.floors,fh=h/floors;box(w,h,d,x,h/2,z,['H1','H2'].includes(b.id)?b.color:'#ecebe3');camBox(w,h,d,x,h/2,z);
   for(const horizontal of[true,false])for(const sign of[-1,1]){
    const length=horizontal?w:d;for(let f=0;f<floors;f++)for(let v=-length/2+2.9,k=0;v<length/2-1.5;v+=4.2,k++){
     const px=horizontal?x+v:x+sign*(w/2+.12),pz=horizontal?z+sign*(d/2+.12):z+v,y=f*fh+fh*.52;
     box(horizontal?1.8:.25,2.2,horizontal?.25:1.8,px,y,pz,'#586a70');
     if(['H1','H2'].includes(b.id)||(f+k+(b.id.charCodeAt(1)||0))%4===0){box(horizontal?2.9:.65,.28,horizontal?.65:2.9,px,y+1.25,pz,frameColor);box(horizontal?2.9:.65,.28,horizontal?.65:2.9,px,y-1.25,pz,frameColor);for(const s of[-1,1])box(horizontal?.28:.65,2.5,horizontal?.65:.28,px+(horizontal?s*1.32:0),y,pz+(horizontal?0:s*1.32),frameColor);}
    }
   }
   box(w+1,.6,d+1,x,h+.15,z,'#e2e2d8');box(w-3,.16,d-3,x,h+.56,z,'#94ad83');for(const s of[-1,1]){box(w,1,.2,x,h+1,z+s*d/2,'#dde1d5');box(.2,1,d,x+s*w/2,h+1,z,'#dde1d5');}
  }
  const a=b.parts![0];box(10,4,.35,a.x,2,a.z+a.d/2+.2,b.color);box(12,.45,4,a.x,4.4,a.z+a.d/2+1.5,'#f0ede3');for(const s of[-1,1])box(.35,4.5,.35,a.x+s*5.5,2.25,a.z+a.d/2+3,'#efede5');return true;
 }
 if(b.kind==='exchange'&&b.radius){
  const r=b.radius,rz=r*.72,n=80,vertices:number[]=[],indices:number[]=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;vertices.push(b.x+r*Math.cos(a),0,b.z+rz*Math.sin(a),b.x+r*Math.cos(a),b.h+8*Math.cos(a),b.z+rz*Math.sin(a));if(i<n){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}const x=b.x+Math.cos(a)*(r+.18),z=b.z+Math.sin(a)*(rz+.18),h=b.h+8*Math.cos(a);if(i<n)box(.23,h,.23,x,h/2,z,'#cfdbd6');}
  surface(vertices,indices,'#668a95');const roof=[b.x,b.h,b.z],roofIndices:number[]=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;roof.push(b.x+r*Math.cos(a),b.h+8*Math.cos(a),b.z+rz*Math.sin(a));if(i<n)roofIndices.push(0,i+2,i+1);}surface(roof,roofIndices,'#c1c8c1');
  for(let y=4.5;y<b.h-8;y+=4.5){const pts=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;pts.push(new T.Vector3(b.x+(r+.15)*Math.cos(a),y,b.z+(rz+.15)*Math.sin(a)));}scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#adc5c5'})));}
  box(b.w,12,b.d,b.x-18,6,b.z,'#8caaad');box(b.w+3,.8,b.d+3,b.x-18,12.4,b.z,'#e4e2d5');for(let x=-b.w/2+3;x<b.w/2;x+=4)box(.25,10,.3,b.x-18+x,5.5,b.z+b.d/2+.15,'#d4dfd7');camBox(r*1.9,b.h+8,rz*1.9,b.x,b.h/2,b.z);return true;
 }
 if(b.kind==='sports'){
  box(b.w,b.h,b.d,b.x,b.h/2,b.z,'#647e88');camBox(b.w,b.h,b.d,b.x,b.h/2,b.z);
  for(const sign of[-1,1]){for(let x=-b.w/2+2;x<=b.w/2;x+=4)box(.3,b.h,.45,b.x+x,b.h/2,b.z+sign*(b.d/2+.3),'#d5ded8');for(let y=4;y<b.h;y+=4.3)box(b.w,.45,.55,b.x,y,b.z+sign*(b.d/2+.4),'#d6dfd8');box(3,b.h,b.d,b.x+sign*(b.w/2-1.5),b.h/2,b.z,'#dedfd7');}
  const roofVertices:number[]=[],roofIndices:number[]=[],curve=(t:number)=>b.h+1+3*t*t;
  for(let i=0;i<=40;i++){const t=i/40*2-1,x=b.x+t*(b.w+5)/2;roofVertices.push(x,curve(t),b.z-(b.d+5)/2,x,curve(t),b.z+(b.d+5)/2);if(i<40){const j=i*2;roofIndices.push(j,j+1,j+2,j+1,j+3,j+2);}}
  surface(roofVertices,roofIndices,'#c6cecb');for(const sign of[-1,1]){const vertices:number[]=[],indices:number[]=[];for(let i=0;i<=40;i++){const t=i/40*2-1;vertices.push(b.x+t*b.w/2,b.h,b.z+sign*(b.d/2+.15),b.x+t*b.w/2,curve(t),b.z+sign*(b.d/2+.15));if(i<40){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}const m=surface(vertices,indices,'#78909a');m.material.side=T.DoubleSide;}
  for(let x=-b.w/2;x<=b.w/2;x+=8)box(.4,.4,b.d+5,b.x+x,curve(x/(b.w/2))+.2,b.z,'#e3e8de');box(b.w*.34,2.5,7,b.x,1.25,b.z+b.d/2+3,'#65828a');return true;
 }
 return false;
}
