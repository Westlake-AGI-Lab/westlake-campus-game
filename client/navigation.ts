import * as T from 'three';
import type {Socket} from 'socket.io-client';
import {campus,heightAt,nearestPath} from '../shared/world';
import {destinations,searchDestinations,type Destination} from '../shared/destinations';
import type {Player,Point,RouteReply,AirdropReply} from '../shared/types';
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
type Selection={id?:string;name:string;point:Point;building:boolean};
export function navigationUI(options:{scene:T.Scene;socket:Socket;player:()=>Player|undefined;stop:()=>void;locate:(d:Destination)=>void;returnCamera:()=>void;toast:(text:string)=>void;map:HTMLCanvasElement;mapPoint:(x:number,z:number)=>number[]}){
 const panel=$('map-panel'),controls=$('navigation-controls'),select=$<HTMLSelectElement>('destination'),search=$<HTMLInputElement>('destination-search'),airdrop=$<HTMLButtonElement>('airdrop'),navigate=$<HTMLButtonElement>('navigate'),note=$('navigation-note'),summary=$('navigation-summary');
 let selected:Selection|undefined,active:Selection|undefined,route:Point[]=[],target:Point|undefined,worker:Worker|undefined,requestId=0,pending=false,landing=false,lastRequest=0,routeOrigin:Point|undefined,routeLength=0;
 const group=new T.Group();group.name='navigation-route';options.scene.add(group);
 const focusGroup=new T.Group();focusGroup.name='building-highlight';options.scene.add(focusGroup);let focused:Destination|undefined;
 const results=$('building-results'),searchStatus=$('search-status'),locate=$<HTMLButtonElement>('locate-building'),returnButton=$('return-building');
 function clearFocus(){focused=undefined;for(const child of [...focusGroup.children]){focusGroup.remove(child);const line=child as T.Line;line.geometry.dispose();(line.material as T.Material).dispose();}returnButton.hidden=true;$('building-pin').hidden=true;}
 function locateDestination(d:Destination){
  clearFocus();chooseDestination(d);focused=d;const b=campus.buildings.find(b=>b.id===d.id);
  if(b){const outlines:T.Vector3[][]=[];
   if(b.kind==='loop'){for(const radius of [b.innerRadius!,b.outerRadius!])outlines.push(Array.from({length:161},(_,i)=>{const angle=(b.arc![0]+(b.arc![1]-b.arc![0])*i/160)*Math.PI/180;return new T.Vector3(b.x+Math.cos(angle)*radius,b.h+.4,b.z+Math.sin(angle)*radius);}));}
   else if(b.radius)outlines.push(Array.from({length:65},(_,i)=>new T.Vector3(b.x+Math.cos(i/64*Math.PI*2)*b.radius!,b.h+.4,b.z+Math.sin(i/64*Math.PI*2)*b.radius!)));
   else for(const a of b.parts||[b]){const rotation=a.rotation||0,c=Math.cos(rotation),s=Math.sin(rotation);outlines.push([[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([dx,dz])=>new T.Vector3(a.x+dx*a.w/2*c-dz*a.d/2*s,a.h+.4,a.z+dx*a.w/2*s+dz*a.d/2*c)));}
   for(const points of outlines){const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#f0aa35',depthTest:false}));line.renderOrder=7;focusGroup.add(line);}
  }
  returnButton.hidden=false;results.hidden=true;search.setAttribute('aria-expanded','false');options.locate(d);note.textContent='已定位 '+d.name+'。可返回漫游，或选择导航 / 空降。';
 }
 function returnCamera(){clearFocus();options.returnCamera();}
 function clearMeshes(){for(const child of [...group.children]){group.remove(child);const mesh=child as T.Mesh;if(mesh.geometry)mesh.geometry.dispose();const material=mesh.material;if(Array.isArray(material))material.forEach(m=>m.dispose());else material?.dispose();}}
 function paintRoute(){
  clearMeshes();if(route.length<2)return;const points:T.Vector3[]=[];
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/1.5));for(let j=i===1?0:1;j<=steps;j++){const t=j/steps,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};points.push(new T.Vector3(p.x,heightAt(p)+.24,p.z));}}
  const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#357ee9',depthTest:false,transparent:true,opacity:.95}));line.renderOrder=6;group.add(line);
  const path=new T.CurvePath<T.Vector3>();for(let i=1;i<points.length;i++)if(points[i].distanceTo(points[i-1])>.001)path.add(new T.LineCurve3(points[i-1],points[i]));
  if(path.curves.length){const ribbon=new T.Mesh(new T.TubeGeometry(path,Math.min(2200,Math.max(2,points.length*2)),.32,4,false),new T.MeshBasicMaterial({color:'#378bf2'}));group.add(ribbon);}
 }
 function renderChoices(showResults=false){const old=select.value,matches=searchDestinations(search.value);select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='选择建筑、广场或桥梁';select.append(placeholder);const groups=new Map<string,HTMLOptGroupElement>();for(const d of matches){let group=groups.get(d.group);if(!group){group=document.createElement('optgroup');group.label=d.group;groups.set(d.group,group);select.append(group);}const option=document.createElement('option');option.value=d.id;option.textContent=d.name;group.append(option);}select.value=old;
  results.replaceChildren();const visible=showResults&&!!search.value.trim();results.hidden=!visible;searchStatus.hidden=!visible;search.setAttribute('aria-expanded',String(visible));if(!visible)return;
  searchStatus.textContent=matches.length?`找到 ${matches.length} 处 · 点击或按 Enter 定位${matches.length>12?' · 输入楼号缩小范围':''}`:'没有找到，试试楼名、楼号或图书馆等别名。';
  for(const d of matches.slice(0,12)){const button=document.createElement('button');button.type='button';button.dataset.destinationId=d.id;button.textContent=d.name;button.onclick=()=>locateDestination(d);button.onkeydown=e=>{if(e.key==='Escape'){results.hidden=true;search.setAttribute('aria-expanded','false');search.focus();}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=e.key==='ArrowDown'?button.nextElementSibling:button.previousElementSibling;if(next)(next as HTMLElement).focus();else search.focus();}};results.append(button);}
 }
 function choose(value:Selection){selected=value;controls.hidden=false;panel.hidden=false;$('navigation-open').setAttribute('aria-expanded','true');$('selected-place').textContent=value.name;note.textContent='选择空降，或从当前位置规划步行路线。';options.stop();}
 function chooseDestination(d:Destination){select.value=d.id;choose({id:d.id,name:d.name,point:{...d.point},building:d.building});}
 renderChoices();search.oninput=()=>{options.stop();renderChoices(true);};search.onfocus=()=>{options.stop();renderChoices(true);};search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const d=searchDestinations(search.value)[0];if(d&&search.value.trim()){locateDestination(d);search.blur();}}if(e.key==='ArrowDown'){e.preventDefault();(results.firstElementChild as HTMLElement|null)?.focus();}if(e.key==='Escape'){results.hidden=true;search.setAttribute('aria-expanded','false');search.blur();returnCamera();}};
 select.onchange=()=>{const d=destinations.find(d=>d.id===select.value);if(d)locateDestination(d);};
 locate.onclick=()=>{const d=destinations.find(d=>d.id===selected?.id);if(d)locateDestination(d);};returnButton.onclick=returnCamera;
 $('navigation-open').onclick=()=>{controls.hidden=!controls.hidden;$('navigation-open').setAttribute('aria-expanded',String(!controls.hidden));options.stop();};
 $('map-expand').onclick=()=>{const expanded=panel.classList.toggle('expanded');$('map-expand').setAttribute('aria-pressed',String(expanded));$('map-expand').textContent=expanded?'收起地图':'放大地图';if(expanded)controls.hidden=false;options.stop();};
 options.map.addEventListener('click',event=>{returnCamera();const rect=options.map.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*options.map.width,z=(event.clientY-rect.top)/rect.height*options.map.height,b=campus.meta.bounds,p={x:Math.max(b.minX+1,Math.min(b.maxX-1,b.minX+(x-20)/(options.map.width-40)*(b.maxX-b.minX))),z:Math.max(b.minZ+1,Math.min(b.maxZ-1,b.minZ+(z-20)/(options.map.height-40)*(b.maxZ-b.minZ)))};const nearest=destinations.reduce((best,d)=>Math.hypot(d.point.x-p.x,d.point.z-p.z)<Math.hypot(best.point.x-p.x,best.point.z-p.z)?d:best);select.value='';choose({name:Math.hypot(nearest.point.x-p.x,nearest.point.z-p.z)<80?nearest.name+'附近':'地图选定位置',point:p,building:false});});
 function planner(){if(!worker){worker=new Worker(new URL('./navigation.worker.ts',import.meta.url),{type:'module'});worker.onmessage=(event:MessageEvent<{id:number;result:RouteReply}>)=>{if(event.data.id!==requestId||!active)return;pending=false;const result=event.data.result;if(!result.ok){note.textContent=result.error;active=undefined;summary.hidden=true;route=[];clearMeshes();return;}route=result.path;target=result.target;routeLength=result.distance;paintRoute();note.textContent=result.adjusted?'终点设在目标附近可通行的位置。':'蓝色路线已就绪，沿路线步行即可。';summary.hidden=false;};worker.onerror=()=>{pending=false;note.textContent='路线规划暂不可用，请再次尝试。';active=undefined;route=[];target=undefined;summary.hidden=true;clearMeshes();worker?.terminate();worker=undefined;};}return worker;}
 function requestRoute(){const player=options.player();if(!active||!player||pending)return;requestId++;pending=true;lastRequest=performance.now();routeOrigin={x:player.x,z:player.z};planner().postMessage({id:requestId,start:routeOrigin,target:active.point,building:active.building});note.textContent='正在规划可通行路线…';}
 navigate.onclick=()=>{if(!selected||!options.player())return;returnCamera();options.stop();active={...selected,point:{...selected.point}};requestId++;pending=false;route=[];target=undefined;summary.hidden=true;clearMeshes();requestRoute();};
 airdrop.onclick=()=>{if(!selected||landing||!options.player())return;landing=true;returnCamera();options.stop();const name=selected.name,journey=active,arrivalPoint=target&&{...target};options.socket.timeout(6000).emit('airdrop',selected.point,(error:Error|null,reply:AirdropReply)=>{landing=false;if(error||!reply){note.textContent='空降未确认，请等待连接恢复后再试。';return;}if(!reply.ok){note.textContent=reply.error;return;}selected={name,point:reply.point,building:false};if(journey&&arrivalPoint&&Math.hypot(reply.point.x-arrivalPoint.x,reply.point.z-arrivalPoint.z)<3){cancel();note.textContent='已到达 '+journey.name+'，空降位置已保存。';options.toast('已到达 '+journey.name);return;}note.textContent=reply.adjusted?'已空降到附近安全落点，位置已保存。':'空降成功，位置已保存。';options.toast('已空降至 '+name+(reply.adjusted?'附近安全位置':''));if(active){pending=false;requestId++;requestRoute();}});};
 function cancel(){active=undefined;route=[];target=undefined;pending=false;requestId++;clearMeshes();summary.hidden=true;$('destination-pin').hidden=true;}
 $('navigation-cancel').onclick=()=>{cancel();note.textContent='已结束导航，可重新选择目的地。';};
 function update(){const player=options.player();airdrop.disabled=!selected||!player||!!player.vehicleId||!!player.shuttleId||landing;navigate.disabled=!selected||!player||pending;group.visible=!!player&&!!active;
  locate.disabled=!selected?.id||!player;
  if(!active||!player)return;
  if(target&&Math.hypot(player.x-target.x,player.z-target.z)<3){const name=active.name;cancel();note.textContent='已到达 '+name;options.toast('已到达 '+name);return;}
  if(route.length>1){const nearest=nearestPath(player,route),remaining=Math.round(routeLength*(1-nearest.progress));$('navigation-target').textContent=active.name;$('navigation-distance').textContent=nearest.distance>8?'正在重新规划…':`沿蓝色路线 · 剩余约 ${remaining} 米`;}
  if(!pending&&performance.now()-lastRequest>1800&&routeOrigin&&Math.hypot(player.x-routeOrigin.x,player.z-routeOrigin.z)>5)requestRoute();
 }
 const timer=setInterval(update,200);update();
 return{
  reset:()=>{cancel();clearFocus();selected=undefined;search.value='';renderChoices();select.value='';note.textContent='在地图上点选位置，或搜索地点。';$('selected-place').textContent='尚未选择目的地';},
  clearFocus,
  displaced:()=>{if(active){pending=false;requestId++;requestRoute();}},
  draw:(ctx:CanvasRenderingContext2D)=>{for(const child of focusGroup.children){const line=child as T.Line,positions=line.geometry.getAttribute('position');ctx.beginPath();for(let i=0;i<positions.count;i++){const[x,y]=options.mapPoint(positions.getX(i),positions.getZ(i));i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle='#c77b1b';ctx.lineWidth=3;ctx.stroke();}if(active&&route.length>1){ctx.beginPath();route.forEach((p,i)=>{const[x,y]=options.mapPoint(p.x,p.z);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle='#fff';ctx.lineWidth=8;ctx.stroke();ctx.strokeStyle='#357ee9';ctx.lineWidth=5;ctx.stroke();}const goal=selected?.point||target;if(goal){const[x,y]=options.mapPoint(goal.x,goal.z);ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle='#d78238';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();}},
  project:(camera:T.Camera)=>{const building=focused&&campus.buildings.find(b=>b.id===focused!.id),buildingPin=$('building-pin');if(focused&&options.player()){const p=new T.Vector3(building?.x??focused.point.x,(building?.h||heightAt(focused.point))+6,building?.z??focused.point.z).project(camera);buildingPin.hidden=p.z<-1||p.z>1||Math.abs(p.x)>.97||Math.abs(p.y)>.9;buildingPin.style.left=(p.x*.5+.5)*innerWidth+'px';buildingPin.style.top=(.5-p.y*.5)*innerHeight+'px';buildingPin.textContent=focused.name;}else buildingPin.hidden=true;
   const goal=active&&target,pin=$('destination-pin');if(!goal||!options.player()){pin.hidden=true;return;}const p=new T.Vector3(goal.x,heightAt(goal)+3,goal.z).project(camera);pin.hidden=p.z<-1||p.z>1||Math.abs(p.x)>.97||Math.abs(p.y)>.9;pin.style.left=(p.x*.5+.5)*innerWidth+'px';pin.style.top=(.5-p.y*.5)*innerHeight+'px';pin.textContent='目的地 · '+active!.name;},
  debug:()=>({selected,focused:focused?.id,focusObjects:focusGroup.children.length,active,pending,target,path:route,distance:routeLength,sceneObjects:group.children.length,destinations:destinations.length}),
  dispose:()=>{clearInterval(timer);worker?.terminate();clearMeshes();clearFocus();options.scene.remove(group,focusGroup);}
 };
}
