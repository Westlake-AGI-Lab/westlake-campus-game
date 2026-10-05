import * as T from 'three';
import {campus} from '../shared/world';
import {buildingName} from '../shared/buildings';

export const campusCenter=new T.Vector3((campus.meta.bounds.minX+campus.meta.bounds.maxX)/2,0,(campus.meta.bounds.minZ+campus.meta.bounds.maxZ)/2);
// Fit the rotated campus rectangle, allowing space for the header and controls.
export function campusDistance(aspect:number,azimuth=0){
 const b=campus.meta.bounds,w=b.maxX-b.minX,d=b.maxZ-b.minZ,c=Math.abs(Math.cos(azimuth)),s=Math.abs(Math.sin(azimuth));
 return Math.max((w*c+d*s)/aspect,d*c+w*s)/(2*Math.tan(26*Math.PI/180))*1.32+120;
}
export function overviewLabels(){
 const root=document.getElementById('overview-labels')!,pin=document.getElementById('player-pin')!;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('landmark-leaders');root.append(svg);const lines=new Map<HTMLElement,SVGLineElement>();const measure=document.createElement('canvas').getContext('2d')!;
 function leader(el:HTMLElement){const line=document.createElementNS('http://www.w3.org/2000/svg','line');svg.append(line);lines.set(el,line);}
 const ids=['E0','E10','E4-E5','E1-E3','E6-E7','E8-E9','library','teaching','research','A1','A2','sports','H2','H4','H5','southgate','northgate'];
 const major=new Set(ids);
 const numbered=campus.buildings.filter(b=>b.codes?.length&&!major.has(b.id)).sort((a,b)=>Number(!a.codes!.some(c=>c.startsWith('C')))-Number(!b.codes!.some(c=>c.startsWith('C')))||a.codes![0].localeCompare(b.codes![0],'en',{numeric:true}));
 const labels=[...ids,...numbered.map(b=>b.id)].map(id=>{const b=campus.buildings.find(b=>b.id===id)!;const el=document.createElement('div');el.className='landmark-label';el.dataset.buildingId=id;const compact=!major.has(id);el.classList.toggle('building-code-label',compact);el.textContent=compact?b.codes!.join(' / '):buildingName(b).replace('本科生书院','书院');el.title=buildingName(b);el.setAttribute('aria-label',buildingName(b));root.append(el);leader(el);return{b,el};});
 // Broad regions remain readable at the farthest view.
 for(const [name,x,z]of[['西侧生活区',-500,250],['北侧生活区',-250,-560]] as const){const el=document.createElement('div');el.className='landmark-label region-label';el.textContent=name;root.append(el);leader(el);labels.push({b:{x,z,h:24} as typeof labels[number]['b'],el});}
 function pixel(p:T.Vector3,camera:T.Camera){const v=p.project(camera);return{x:(v.x*.5+.5)*innerWidth,y:(.5-v.y*.5)*innerHeight,visible:v.z>-1&&v.z<1&&Math.abs(v.x)<.97&&Math.abs(v.y)<.90};}
 return{update(camera:T.Camera,active:boolean,player?:{x:number;z:number}){
  root.hidden=!active;pin.hidden=!active||!player;if(!active)return;
  const occupied:{x:number;y:number;w:number;h:number}[]=[];
  if(innerWidth>=1000){for(const panel of Array.from(document.querySelectorAll<HTMLElement>('#left-rail,#map-panel'))){if(panel.hidden)continue;const r=panel.getBoundingClientRect();if(r.width&&r.height)occupied.push({x:r.x,y:r.y,w:r.width,h:r.height});}}
  if(player){const p=pixel(new T.Vector3(player.x,2,player.z),camera);pin.hidden=!p.visible;pin.style.left=p.x+'px';pin.style.top=p.y+'px';occupied.push({x:p.x-48,y:p.y-51,w:96,h:55});}
  measure.font=(innerWidth<620?'9':'11')+'px -apple-system, PingFang SC, sans-serif';
  for(const{b,el}of labels){const anchor=new T.Vector3(b.x,b.h+3,b.z);if(b.id==='E10')anchor.set(-135,23,75);const p=pixel(anchor,camera),line=lines.get(el)!;el.hidden=!p.visible;line.style.display='none';if(!p.visible)continue;const compact=el.classList.contains('building-code-label'),w=measure.measureText(el.textContent!).width+(compact?12:20),h=compact?20:26;let placed=false;
   const offsets=(compact?[0,-30,30,-60,60,-90,90,-120,120]:[0,-55,55,-110,110,-170,170]).flatMap(dx=>(compact?[-12,-36,12,-60,36,-84,60,-108,84]:[-20,-49,9,-78,38,-107,67]).map(dy=>[dx,dy]));if(compact)offsets.sort((a,b)=>a[0]**2+a[1]**2-b[0]**2-b[1]**2);
   placement:for(const [dx,dy] of offsets){const rect={x:p.x+dx-w/2,y:p.y+dy-h/2,w,h};if(rect.y<87||rect.y+h>innerHeight-75||rect.x<14||rect.x+w>innerWidth-14)continue;if(occupied.some(r=>rect.x<r.x+r.w+6&&rect.x+w+6>r.x&&rect.y<r.y+r.h+5&&rect.y+h+5>r.y))continue;el.style.left=(p.x+dx)+'px';el.style.top=(p.y+dy)+'px';line.setAttribute('x1',String(p.x));line.setAttribute('y1',String(p.y));line.setAttribute('x2',String(p.x+dx));line.setAttribute('y2',String(p.y+dy));line.style.display='';occupied.push(rect);placed=true;break placement;}el.hidden=!placed;
  }
 }};
}
