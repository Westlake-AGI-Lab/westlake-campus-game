import {PETS,type Pet,type PetAction,type PetReply} from '../shared/pets';
import type {Player} from '../shared/types';
export function petUI(send:(action:PetAction,reply:(r:PetReply)=>void)=>void,toast:(s:string)=>void,clearInput:()=>void){
 const panel=document.createElement('section');panel.id='pet-interaction';panel.hidden=true;panel.setAttribute('aria-label','猫狗互动');
 const title=document.createElement('strong');title.id='pet-name';const feed=document.createElement('button');feed.id='pet-feed';feed.textContent='投喂';const adopt=document.createElement('button');adopt.id='pet-adopt';adopt.textContent='认领';panel.append(title,feed,adopt);document.getElementById('hud')!.append(panel);
 const roster=document.createElement('details');roster.id='my-pets';roster.hidden=true;const summary=document.createElement('summary');summary.textContent='我的猫狗';const list=document.createElement('div');roster.append(summary,list);document.getElementById('left-rail')!.append(roster);
 let nearest:Pet|undefined,local:Player|undefined,pending=false,rosterKey='';
 const act=(pet:Pet,kind:PetAction['kind'])=>{if(pending)return;clearInput();pending=true;const timer=setTimeout(()=>{pending=false;toast('连接超时，请重试。');},4000);send({id:pet.id,kind},r=>{clearTimeout(timer);pending=false;toast(r.ok?kind==='feed'?`${pet.name}开心地吃了起来 ♥`:kind==='adopt'?`${pet.name}开始跟随你啦！`:`已解除对 ${pet.name} 的认领。`:r.error||'互动失败。');});};
 feed.onclick=()=>{if(nearest)act(nearest,'feed');};adopt.onclick=()=>{if(nearest)act(nearest,nearest.ownerId===local?.id?'release':'adopt');};
 function update(pets:Pet[],player:Player|undefined,players:Player[],now:number){
  local=player;nearest=player&&!player.vehicleId&&!player.shuttleId?pets.filter(p=>(!p.ownerId||players.some(o=>o.id===p.ownerId&&!o.vehicleId&&!o.shuttleId))&&Math.hypot(p.x-player.x,p.z-player.z)<=PETS.range).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]:undefined;
  panel.hidden=!nearest;if(nearest){const owner=players.find(p=>p.id===nearest!.ownerId);title.textContent=`${nearest.kind==='cat'?'🐈':'🐕'} ${nearest.name} · ${nearest.ownerId===player?.id?'跟随你':nearest.ownerId?`${owner?.name||'已认领'}的伙伴`:'流浪中'}`;feed.disabled=pending||now-nearest.fedAt<PETS.feedCooldown;adopt.disabled=pending||!!nearest.ownerId&&nearest.ownerId!==player?.id;adopt.textContent=nearest.ownerId===player?.id?'解除认领':'认领';}
  const owned=pets.filter(p=>p.ownerId===player?.id);roster.hidden=!owned.length;summary.textContent=`我的猫狗 · ${owned.length}`;const key=owned.map(p=>p.id).join(',');if(key!==rosterKey){rosterKey=key;list.replaceChildren(...owned.map(p=>{const row=document.createElement('div'),text=document.createElement('span'),button=document.createElement('button');text.textContent=`${p.kind==='cat'?'🐈':'🐕'} ${p.name}`;button.textContent='解除认领';button.dataset.petRelease=p.id;button.onclick=()=>act(p,'release');row.append(text,button);return row;}));}
 }
 return {update};
}
