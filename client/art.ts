import * as T from 'three';

// Small deterministic, project-owned surfaces; no downloaded images or fonts.
export function surfaceTexture(kind:'stone'|'grass'|'fabric'|'water',scale=1){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d')!;let seed=731;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 ctx.fillStyle=kind==='grass'?'#c1cbb3':kind==='water'?'#899da5':'#ddddda';ctx.fillRect(0,0,128,128);
 for(let i=0;i<2400;i++){const v=Math.floor(150+random()*90);ctx.fillStyle=`rgba(${v},${v},${v},${kind==='grass'?.22:.12})`;const x=random()*128,y=random()*128;ctx.fillRect(x,y,kind==='fabric'?1:2,kind==='grass'?4:1);}
 if(kind==='stone'){ctx.strokeStyle='rgba(110,110,100,.12)';ctx.lineWidth=.6;for(let y=0;y<128;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}}
 if(kind==='water'){for(let i=0;i<28;i++){ctx.strokeStyle=`rgba(230,245,250,${.12+random()*.22})`;ctx.beginPath();const y=random()*128;for(let x=0;x<=128;x+=4){const z=y+Math.sin(x*.12+i)*2;x?ctx.lineTo(x,z):ctx.moveTo(x,z);}ctx.stroke();}}
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(scale,scale);texture.anisotropy=4;texture.colorSpace=T.SRGBColorSpace;return texture;
}
export function studioEnvironment(renderer:T.WebGLRenderer,scene:T.Scene){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d')!;
 const sky=ctx.createLinearGradient(0,0,0,256);sky.addColorStop(0,'#6f9dbf');sky.addColorStop(.45,'#cbdfe7');sky.addColorStop(.52,'#f1dfbb');sky.addColorStop(1,'#73846c');ctx.fillStyle=sky;ctx.fillRect(0,0,512,256);
 const glow=ctx.createRadialGradient(150,92,1,150,92,80);glow.addColorStop(0,'rgba(255,246,214,1)');glow.addColorStop(.15,'rgba(255,241,206,.8)');glow.addColorStop(1,'rgba(255,241,206,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,512,256);
 const texture=new T.CanvasTexture(canvas);texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.SRGBColorSpace;
 const pmrem=new T.PMREMGenerator(renderer);const environment=pmrem.fromEquirectangular(texture);scene.environment=environment.texture;scene.environmentIntensity=.4;texture.dispose();pmrem.dispose();
 // Visible sky shares the same palette; cheap shader avoids full-screen post processing.
 const dome=new T.Mesh(new T.SphereGeometry(6000,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,toneMapped:false,uniforms:{top:{value:new T.Color('#5287b4')},horizon:{value:new T.Color('#bed8e6')}},vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 direction;uniform vec3 top;uniform vec3 horizon;void main(){float h=clamp(normalize(direction).y,0.0,1.0);gl_FragColor=vec4(mix(horizon,top,pow(h,.65)),1.0);\n#include <colorspace_fragment>\n}'}));dome.frustumCulled=false;scene.add(dome);
 return {environment,sky:dome.material};
}
