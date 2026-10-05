import {createPets,type Pet} from '../shared/pets';
import * as T from 'three';
import {atmosphereAt,DAY_MS,type Weather} from '../shared/atmosphere';
import {campus,blocked,heightAt} from '../shared/world';
import type {Point} from '../shared/types';
import {LAB_PART,LAB_POINT} from '../shared/wildlife';

export function ambience(scene:T.Scene,renderer:T.WebGLRenderer,sun:T.DirectionalLight,hemi:T.HemisphereLight,sky:T.ShaderMaterial){
 const card=document.createElement('details');card.id='ambience-panel';card.className='ambience-panel';
 card.innerHTML='<summary id="ambience-status">校园天气</summary><label>时段 <select id="ambience-time"><option value="auto">自动 · 全员同步</option><option value="8">清晨预览</option><option value="13">白昼预览</option><option value="18">黄昏预览</option><option value="23">深夜预览</option></select></label><label>天气 <select id="ambience-weather"><option value="auto">自动 · 全员同步</option><option value="clear">晴天预览</option><option value="cloudy">多云预览</option><option value="rain">雨天预览</option></select></label><small>一天 24 分钟 · 天气每 6 分钟变化<br>预览只影响你的画面</small><button id="find-cat">寻找校园猫</button><button id="find-dog">寻找校园狗</button><button id="find-lab">寻找深夜亮窗</button>';
 document.getElementById('hud')!.append(card);
 const timeSelect=card.querySelector<HTMLSelectElement>('#ambience-time')!,weatherSelect=card.querySelector<HTMLSelectElement>('#ambience-weather')!;
 const notice=document.createElement('div');notice.id='ambience-notice';notice.setAttribute('role','status');notice.hidden=true;document.getElementById('hud')!.append(notice);
 const interact=document.createElement('button');interact.id='cat-greet';interact.textContent='和校园猫打招呼 🐾';interact.hidden=true;document.getElementById('hud')!.append(interact);
 const mesh=(g:T.BufferGeometry,color:string)=>new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.85}));
 const cats=createPets().map((pet,i)=>{
  const points=[{x:pet.x,z:pet.z}],dog=pet.kind==='dog';
  const anchor=points[0],group=new T.Group(),color=['#c9915b','#4e555c','#d8ccba','#b5a291','#aa7444','#ccaa68','#e9e1ce'][i];
  const body=mesh(new T.SphereGeometry(1,12,8),color);body.scale.set(dog?.37:.28,dog?.34:.28,dog?.65:.48);body.position.y=.42;group.add(body);
  const head=mesh(new T.SphereGeometry(.25,12,8),color);head.position.set(0,.63,.36);group.add(head);
  for(const sign of[-1,1]){const ear=mesh(new T.ConeGeometry(.11,.23,4),color);ear.position.set(sign*.15,dog?.7:.87,.36);if(dog){ear.scale.set(1,.9,1.6);ear.rotation.z=sign*.65;}group.add(ear);const eye=mesh(new T.SphereGeometry(.036,8,6),'#e6cc6f');eye.position.set(sign*.10,.66,.575);group.add(eye);}
  const nose=mesh(new T.SphereGeometry(.035,8,6),'#c78586');nose.position.set(0,.58,.598);group.add(nose);
  const legs:T.Mesh[]=[];for(const x of[-.17,.17])for(const z of[-.29,.27]){const leg=mesh(new T.CapsuleGeometry(.065,.22,3,6),color);leg.position.set(x,.18,z);legs.push(leg);group.add(leg);}
  const tail=mesh(new T.TorusGeometry(.24,.045,6,12,Math.PI*1.3),color);tail.position.set(0,.58,-.48);tail.rotation.set(0,Math.PI/2,0);group.add(tail);
  if(dog){const muzzle=mesh(new T.CapsuleGeometry(.13,.18,3,8),color);muzzle.rotation.x=Math.PI/2;muzzle.position.set(0,.57,.65);group.add(muzzle);nose.position.z=.8;group.scale.setScalar(1.4);}
  group.position.set(anchor.x,heightAt(anchor),anchor.z);scene.add(group);
  const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d')!;ctx.font='40px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffbfc9';ctx.fillText('♥',64,46);const heart=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),transparent:true,depthTest:false}));heart.scale.set(1.1,.55,1);heart.position.y=1.4;heart.visible=false;group.add(heart);
  const bowl=mesh(new T.CylinderGeometry(.2,.16,.1,12),'#d58661');bowl.position.set(.6,.07,.4);bowl.visible=false;group.add(bowl);const collar=mesh(new T.TorusGeometry(.2,.035,5,12),'#6daf93');collar.position.set(0,.57,.3);collar.rotation.x=Math.PI/2;collar.visible=false;group.add(collar);
  return {bowl,collar,id:pet.id,kind:pet.kind,group,points:points.length?points:[anchor],legs,tail,heart,i};
 });
 const part=LAB_PART,labPoint=LAB_POINT;
 const wc=document.createElement('canvas');wc.width=256;wc.height=192;const wx=wc.getContext('2d')!,warm=wx.createLinearGradient(0,0,0,192);warm.addColorStop(0,'#ffdf9b');warm.addColorStop(1,'#9c7947');wx.fillStyle=warm;wx.fillRect(0,0,256,192);wx.fillStyle='#3b443c';wx.fillRect(10,151,236,9);wx.fillRect(105,95,80,51);wx.fillRect(137,146,14,7);wx.fillStyle='#86bbb0';wx.fillRect(111,101,68,38);wx.fillStyle='#d7ecb8';for(let i=0;i<4;i++)wx.fillRect(117,108+i*6,30+i*6,2);wx.fillStyle='#414c40';wx.fillRect(61,133,25,18);wx.beginPath();wx.ellipse(72,113,11,20,-.4,0,Math.PI*2);wx.fill();wx.strokeStyle='#5b6251';wx.lineWidth=8;wx.strokeRect(4,4,248,184);wx.beginPath();wx.moveTo(88,0);wx.lineTo(88,192);wx.moveTo(0,65);wx.lineTo(256,65);wx.stroke();const windowTexture=new T.CanvasTexture(wc);windowTexture.colorSpace=T.SRGBColorSpace;
 const pane=new T.Mesh(new T.PlaneGeometry(3.2,2.2),new T.MeshBasicMaterial({map:windowTexture,transparent:true,opacity:.95}));pane.position.set(part.x,Math.min(part.h-2,8),part.z-part.d/2-.48);pane.rotation.y=Math.PI;scene.add(pane);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#253936';ctx.fillRect(0,0,768,192);ctx.fillStyle='#ffe9ad';ctx.textAlign='center';ctx.font='38px sans-serif';ctx.fillText('实验还没跑完…',384,76);ctx.font='24px sans-serif';ctx.fillText('Westlake AGI Lab · 今晚也在探索',384,132);
 const boardTexture=new T.CanvasTexture(canvas);boardTexture.colorSpace=T.SRGBColorSpace;const board=new T.Mesh(new T.PlaneGeometry(5,1.25),new T.MeshBasicMaterial({map:boardTexture,side:T.DoubleSide}));board.position.set(labPoint.x,1.8,labPoint.z);scene.add(board);
 const rainCount=650,positions=new Float32Array(rainCount*6),rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(positions,3));
 const rain=new T.LineSegments(rainGeo,new T.LineBasicMaterial({color:'#b9d5ed',transparent:true,opacity:.4,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);
 const lamps=new T.InstancedMesh(new T.SphereGeometry(.3,8,6),new T.MeshBasicMaterial({color:'#ffdd99'}),120),dummy=new T.Object3D();let n=0;
 for(const r of campus.roads.filter(r=>r.width>=12))for(let k=1;k<r.points.length;k++){const a=r.points[k-1],b=r.points[k],length=Math.hypot(b.x-a.x,b.z-a.z);for(let f=15;f<length&&n<120;f+=35){const x=T.MathUtils.lerp(a.x,b.x,f/length)+r.width*.65,z=T.MathUtils.lerp(a.z,b.z,f/length);if(blocked({x,z}))continue;dummy.position.set(x,5.15,z);dummy.updateMatrix();lamps.setMatrixAt(n++,dummy.matrix);}}
 lamps.count=n;lamps.computeBoundingSphere();scene.add(lamps);
 const starsGeo=new T.BufferGeometry(),starPositions:number[]=[];for(let i=0;i<220;i++){const a=i*2.39996,y=.15+((i*.618)%1)*.8,r=Math.sqrt(1-y*y);starPositions.push(Math.cos(a)*r*4200,y*4200,Math.sin(a)*r*4200);}starsGeo.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));const stars=new T.Points(starsGeo,new T.PointsMaterial({color:'#dce6ff',size:6,sizeAttenuation:true,depthWrite:false,fog:false}));scene.add(stars);
 let state=atmosphereAt(Date.now()),nearest:typeof cats[number]|undefined,lastGreeting=-Infinity,heartUntil=0,greetedId='',lastStatus='';
 interact.onclick=()=>{if(!nearest||performance.now()-lastGreeting<2000)return;lastGreeting=performance.now();heartUntil=lastGreeting+3000;nearest.heart.visible=true;greetedId=nearest.id;};
 function update(clock:number,now:number,camera:T.Camera,player?:Point,pets:Pet[]=[],players:import('../shared/types').Player[]=[]){
  state=atmosphereAt(timeSelect.value==='auto'?clock:Number(timeSelect.value)/24*DAY_MS);
  if(weatherSelect.value!=='auto')state.weather=weatherSelect.value as Weather;
  const cloudy=state.weather==='clear'?0:state.weather==='rain'?.75:.45,light=state.daylight;
  hemi.intensity=.38+light*(.95-cloudy*.25);sun.intensity=.18+light*(2.7-cloudy*1.6);sun.color.set(state.hour>16&&state.hour<20?'#ffd0a0':light>.1?'#fff0d4':'#afc5ef');scene.environmentIntensity=.09+light*.31;
  renderer.toneMappingExposure=.95+light*.1;
  const top=new T.Color('#111b38').lerp(new T.Color('#5287b4'),light),horizon=new T.Color('#354960').lerp(new T.Color('#bed8e6'),light);top.lerp(new T.Color('#738391'),cloudy);horizon.lerp(new T.Color('#a0afb6'),cloudy);
  if(state.hour>16&&state.hour<20)horizon.lerp(new T.Color('#edb790'),.45);
  sky.uniforms.top.value.copy(top);sky.uniforms.horizon.value.copy(horizon);if(scene.fog)scene.fog.color.copy(horizon);
  pane.visible=board.visible=state.night;stars.visible=state.night&&state.weather==='clear';lamps.visible=light<.15;
  rain.visible=state.weather==='rain';if(rain.visible){for(let i=0;i<rainCount;i++){const k=i*6;positions[k]=camera.position.x+((i*17.317)%42)-21;positions[k+1]=camera.position.y+((i*.723-now*.012)%22+22)%22-9;positions[k+2]=camera.position.z+((i*9.871)%42)-21;positions[k+3]=positions[k]-.05;positions[k+4]=positions[k+1]+.65;positions[k+5]=positions[k+2];}rainGeo.attributes.position.needsUpdate=true;}
  nearest=undefined;let distance=4;
  for(const cat of cats){const pet=pets.find(p=>p.id===cat.id);if(!pet){cat.group.visible=false;continue;}cat.group.visible=!pet.ownerId||players.some(p=>p.id===pet.ownerId&&!p.vehicleId&&!p.shuttleId);const phase=clock/1000+cat.i*17,p=pet;
   cat.bowl.visible=clock-pet.fedAt<3000;cat.collar.visible=!!pet.ownerId;cat.group.position.set(p.x,heightAt(p)+(clock-pet.attackAt<300?Math.sin((clock-pet.attackAt)/300*Math.PI)*.3:0),p.z);cat.group.rotation.y=pet.yaw;cat.legs.forEach((leg,i)=>leg.rotation.x=pet.moving?Math.sin(phase*8+i*Math.PI)*.35:0);cat.tail.rotation.z=Math.sin(phase*2)*.12;
   cat.heart.visible=clock-pet.happyAt<3000||now<heartUntil&&cat.id===greetedId;if(player&&cat.group.visible&&Math.hypot(player.x-p.x,player.z-p.z)<distance){distance=Math.hypot(player.x-p.x,player.z-p.z);nearest=cat;}
  }
  interact.hidden=!nearest;interact.textContent=nearest?.kind==='dog'?'和校园狗打招呼 🐾':'和校园猫打招呼 🐾';
  const atLab=player&&Math.hypot(player.x-labPoint.x,player.z-labPoint.z)<18;notice.hidden=!(atLab&&state.night);notice.textContent='深夜亮窗：实验还没跑完… 今晚也在探索。';
  const text=`${String(Math.floor(state.hour)).padStart(2,'0')}:${String(Math.floor(state.hour%1*60)).padStart(2,'0')} · ${state.night?'深夜':light>.4?'白昼':'晨昏'} · ${{clear:'晴',cloudy:'多云',rain:'雨'}[state.weather]}${timeSelect.value!=='auto'||weatherSelect.value!=='auto'?' · 预览':''}`;
  if(text!==lastStatus){card.querySelector('summary')!.textContent=text;lastStatus=text;}
 }
 return {update,dogPoint:()=>{const p=cats[4].group.position;return {x:p.x,z:p.z};},catPoint:()=>{const p=cats[0].group.position;return {x:p.x,z:p.z};},labPoint,debug:()=>({state,preview:timeSelect.value!=='auto'||weatherSelect.value!=='auto',rain:rain.visible,labVisible:pane.visible,labPoint,cats:cats.filter(c=>c.kind==='cat').map(c=>({x:c.group.position.x,z:c.group.position.z,heart:c.heart.visible}))})};
}
