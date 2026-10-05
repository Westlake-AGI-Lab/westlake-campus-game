import * as T from 'three';
import {avatar} from './avatars';
import {studioEnvironment} from './art';
import {APPEARANCE_OPTIONS,appearanceKeys,defaultAppearance,copyAppearance,randomAppearance,type Appearance} from '../shared/appearance';

// A small, on-demand preview using the exact same meshes as campus players.
export function appearanceEditor(){
 const root=document.getElementById('appearance-editor')!,canvas=document.getElementById('avatar-preview') as HTMLCanvasElement;
 let draft=defaultAppearance(),renderer:T.WebGLRenderer|undefined,model:ReturnType<typeof avatar>|undefined;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,260/180,.1,20);
 scene.background=new T.Color('#e9f0e3');scene.add(new T.HemisphereLight('#fff8e9','#668379',2));const light=new T.DirectionalLight('#ffffff',2);light.position.set(3,5,4);scene.add(light);
 camera.position.set(2.6,1.9,4);camera.lookAt(0,1.05,0);
 const controls=new Map<keyof Appearance,HTMLSelectElement>();
 for(const key of appearanceKeys.filter(k=>k!=='coat')){
  const select=document.getElementById('avatar-'+key) as HTMLSelectElement;controls.set(key,select);
  APPEARANCE_OPTIONS[key].forEach((option,i)=>{const el=document.createElement('option');el.value=String(i);el.textContent=option.name;select.append(el);});
  select.value=String(draft[key]);select.onchange=()=>{draft[key]=Number(select.value);render();};
 }
 function render(){
  if(root.hidden)return;
  try{
   if(!renderer){renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});studioEnvironment(renderer,scene);}renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(260,180,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
   if(model){scene.remove(model.group);model.dispose();}model=avatar(draft.coat,draft);model.group.rotation.y=-.3;scene.add(model.group);renderer.render(scene,camera);
   canvas.dataset.appearance=JSON.stringify(draft);document.getElementById('avatar-preview-note')!.textContent='与你进入校园后的角色一致 · 外观不影响战斗能力';
  }catch{document.getElementById('avatar-preview-note')!.textContent='预览暂不可用，仍可选择外观并注册';}
 }
 document.getElementById('avatar-random')!.onclick=()=>{draft=randomAppearance();for(const[key,select]of controls)select.value=String(draft[key]);const button=document.querySelectorAll<HTMLButtonElement>('.color-choice')[draft.coat];if(button)button.click();else render();};
 return {value:(coat:number)=>copyAppearance({...draft,coat}),show:(visible:boolean)=>{root.hidden=!visible;if(visible)render();else if(model){scene.remove(model.group);model.dispose();model=undefined;}},setCoat:(coat:number)=>{draft.coat=coat;render();}};
}
