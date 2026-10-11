import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {COLORS} from '../shared/config';
import {APPEARANCE_OPTIONS as OPTIONS,defaultAppearance,type Appearance} from '../shared/appearance';
export function avatar(color:number,appearance:Appearance=defaultAppearance(color),hitTint='#d6654f'){
 const group=new T.Group();group.userData.appearance={...appearance};
 const skin=new T.MeshStandardMaterial({color:OPTIONS.skin[appearance.skin].color,roughness:.62}),coat=new T.MeshStandardMaterial({color:COLORS[appearance.coat],roughness:.78}),trousers=new T.MeshStandardMaterial({color:OPTIONS.pants[appearance.pants].color}),shoe=new T.MeshStandardMaterial({color:'#ecece0'}),hair=new T.MeshStandardMaterial({color:OPTIONS.hairColor[appearance.hairColor].color});
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,parent:T.Group=group)=>{const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.18),m);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
 box(.57,.62,.32,0,1.22,0,coat);box(.49,.15,.30,0,.89,0,coat);
 const head=new T.Mesh(new T.SphereGeometry(.21,24,16),skin);head.scale.set(.94,1.15,1);head.position.set(0,1.76,0);head.castShadow=true;group.add(head);
 const cap=new T.Mesh(new T.SphereGeometry(.221,20,12,0,Math.PI*2,0,Math.PI/2),hair);cap.position.set(0,1.81,0);group.add(cap);
 if(appearance.hair===1){const fringe=box(.31,.09,.13,.03,1.94,.13,hair);fringe.rotation.z=-.18;}
 if(appearance.hair===2){for(let n=0;n<10;n++){const curl=new T.Mesh(new T.SphereGeometry(.08,8,6),hair);curl.position.set(Math.cos(n*Math.PI/5)*.17,1.95+Math.sin(n)*.02,Math.sin(n*Math.PI/5)*.16);group.add(curl);}}
 if(appearance.hair===3){box(.10,.29,.26,-.20,1.75,-.015,hair);box(.10,.29,.26,.20,1.75,-.015,hair);box(.35,.27,.10,0,1.74,-.18,hair);}
 if(appearance.hair===4){const bun=new T.Mesh(new T.SphereGeometry(.14,10,8),hair);bun.position.set(0,1.93,-.22);group.add(bun);}
 const trim=new T.MeshStandardMaterial({color:'#ece4cf',roughness:.78});
 if(appearance.outfit===1){const hood=new T.Mesh(new T.TorusGeometry(.22,.065,8,16),coat);hood.position.set(0,1.57,-.15);group.add(hood);box(.035,.22,.03,-.075,1.42,.19,trim);box(.035,.22,.03,.075,1.42,.19,trim);box(.28,.13,.035,0,1.08,.18,coat);}
 if(appearance.outfit===2){box(.035,.52,.035,0,1.22,.18,trim);box(.22,.045,.035,-.15,1.38,.18,trim);box(.49,.07,.33,0,.92,0,trim);}
 if(appearance.outfit===3){for(const x of[-.1,.1]){const collar=box(.13,.10,.04,x,1.5,.18,trim);collar.rotation.z=x<0?-.4:.4;}for(const y of[1.13,1.28,1.42])box(.025,.025,.03,0,y,.19,trim);}
 if(appearance.accessory===1){const frame=new T.MeshStandardMaterial({color:'#303d40'});for(const x of[-.065,.065]){const lens=new T.Mesh(new T.TorusGeometry(.055,.009,6,16),frame);lens.position.set(x,1.78,.213);group.add(lens);}box(.04,.015,.015,0,1.79,.216,frame);}
 if(appearance.accessory===2){const hat=new T.Mesh(new T.SphereGeometry(.251,12,8,0,Math.PI*2,0,Math.PI/2),coat);hat.position.set(0,1.84,0);group.add(hat);box(.42,.035,.23,0,1.92,.20,coat);}
 if(appearance.accessory===3){const scarf=new T.Mesh(new T.TorusGeometry(.17,.055,6,16),trim);scarf.rotation.x=Math.PI/2;scarf.position.set(0,1.55,0);group.add(scarf);box(.1,.36,.06,-.08,1.34,.22,trim);}
 if(appearance.accessory===4){const bag=new T.MeshStandardMaterial({color:'#9c785b'});box(.36,.48,.22,0,1.2,-.28,bag);for(const x of[-.18,.18])box(.04,.5,.035,x,1.23,.19,bag);}
 const sleeves=appearance.outfit===2?trim:coat;
 const eye=new T.MeshBasicMaterial({color:'#292e2a'});for(const x of [-.065,.065])box(.025,.035,.02,x,1.78,.196,eye);
 // Small silhouette details make the shared preview and in-world model read at close range.
 const nose=new T.Mesh(new T.SphereGeometry(.034,10,8),skin);nose.position.set(0,1.745,.205);group.add(nose);
 for(const x of[-.205,.205]){const ear=new T.Mesh(new T.SphereGeometry(.043,10,8),skin);ear.position.set(x,1.76,0);ear.scale.set(.55,1,.7);group.add(ear);}
 const seam=new T.MeshStandardMaterial({color:COLORS[appearance.coat],roughness:1});seam.color.multiplyScalar(.65);
 box(.016,.47,.015,0,1.22,.172,seam);for(const x of[-.17,.17])box(.12,.017,.016,x,1.12,.174,seam);
 const brow=new T.MeshStandardMaterial({color:OPTIONS.hairColor[appearance.hairColor].color});for(const x of[-.065,.065])box(.045,.013,.016,x,1.825,.20,brow);
 const limbs:T.Group[]=[];for(const x of [-.17,.17]){const leg=new T.Group();leg.position.set(x,.94,0);box(.18,.62,.19,0,-.32,0,trousers,leg);box(.20,.14,.32,0,-.71,.06,shoe,leg);box(.205,.04,.33,0,-.765,.06,trim,leg);for(const y of[-.69,-.66])box(.12,.012,.025,0,y,.205,trim,leg);group.add(leg);limbs.push(leg);}for(const x of [-.37,.37]){const arm=new T.Group();arm.position.set(x,1.48,0);box(.16,.42,.19,0,-.2,0,sleeves,arm);box(.13,.17,.14,0,-.49,0,skin,arm);group.add(arm);limbs.push(arm);}
 const shadow=new T.Mesh(new T.CircleGeometry(.5,24),new T.MeshBasicMaterial({color:'#284231',transparent:true,opacity:.16,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.04;group.add(shadow);
 const shield=new T.Mesh(new T.TorusGeometry(.65,.035,6,32),new T.MeshBasicMaterial({color:'#9bdce6',transparent:true,opacity:.8}));shield.rotation.x=-Math.PI/2;shield.position.y=.09;shield.visible=false;group.add(shield);
 const coatColor=new T.Color(COLORS[appearance.coat]),hitColor=new T.Color(hitTint);
 return {group,arms:limbs.slice(2),skin,sleeves,head,animate:(time:number,moving:boolean,punch=0,hit=0,protectedNow=false,state='')=>{const swing=moving?Math.sin(time*10)*.55:0,extension=punch>0&&punch<1?Math.sin(punch*Math.PI):0;limbs[0].rotation.x=swing;limbs[1].rotation.x=-swing;limbs[2].rotation.x=-swing*.8-extension*.55;limbs[3].rotation.x=swing*.8-extension*1.8;limbs[2].rotation.z=-extension*.2;limbs[3].rotation.z=extension*.12;if(state==='格挡'){limbs[2].rotation.x=limbs[3].rotation.x=-1.9;limbs[2].rotation.z=-.25;limbs[3].rotation.z=.25;}if(state==='重拳蓄力'){limbs[3].rotation.x=.7;limbs[3].rotation.z=-.35;}head.position.y=1.76+(moving?Math.abs(Math.sin(time*10))*.025:0);coat.color.copy(coatColor).lerp(hitColor,hit>0&&hit<1?(1-hit)*.8:0);shield.visible=protectedNow||!!state;(shield.material as T.MeshBasicMaterial).color.set(state==='重拳蓄力'?'#f1ae55':state==='硬直'?'#d6654f':state==='格挡'?'#77ace1':'#9bdce6');shield.scale.setScalar(1+Math.sin(time*8)*.04);},dispose:()=>group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}})};
}
