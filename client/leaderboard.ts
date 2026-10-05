import type {Socket} from 'socket.io-client';
import type {BoardKind,BoardReply} from '../shared/leaderboard';
export function leaderboardUI(socket:Socket,stop:()=>void){
 const $=(id:string)=>document.getElementById(id)!;const modal=$('leaderboard-modal');let kind:BoardKind='kills',page=0,generation=0;
 function close(){modal.hidden=true;generation++;$('leaderboard-toggle').focus();}
 function load(){const request=++generation;$('board-status').textContent='正在读取…';
  socket.timeout(5000).emit('leaderboard',{kind,page},(error:Error|null,reply:BoardReply)=>{
   if(request!==generation||modal.hidden)return;
   if(error||!reply?.ok){$('board-status').textContent=error?'连接暂不可用，请刷新重试。':('error' in reply?reply.error:'读取失败，请重试。');return;}
   const b=reply.board;page=b.page;$('board-status').textContent=b.total?`共 ${b.total} 位玩家 · ${new Date(b.time).toLocaleTimeString()} 更新`:'还没有记录';
   $('board-me').textContent=`我的名次：${b.me.rank===null?'暂未上榜':b.me.rank} · 击倒 ${b.me.kills} · 倒地 ${b.me.deaths}`;
   $('board-rows').replaceChildren(...b.rows.map(r=>{const tr=document.createElement('tr');if(r.id===b.me.id)tr.className='board-self';for(const v of[r.rank,r.name+(r.id===b.me.id?' · 你':''),r.kills,r.deaths]){const td=document.createElement('td');td.textContent=String(v);tr.append(td);}return tr;}));
   const pages=Math.max(1,Math.ceil(b.total/b.pageSize));$('board-page').textContent=`${page+1} / ${pages}`;($('board-prev') as HTMLButtonElement).disabled=page===0;($('board-next') as HTMLButtonElement).disabled=page+1>=pages;
  });
 }
 $('leaderboard-toggle').onclick=()=>{stop();modal.hidden=false;$('leaderboard-close').focus();load();};$('leaderboard-close').onclick=close;
 for(const k of ['kills','deaths'] as const)$('board-'+k).onclick=()=>{kind=k;page=0;for(const t of ['kills','deaths'])$('board-'+t).setAttribute('aria-selected',String(t===k));load();};
 $('board-prev').onclick=()=>{page=Math.max(0,page-1);load();};$('board-next').onclick=()=>{page++;load();};$('board-refresh').onclick=load;
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 modal.addEventListener('keydown',e=>{if(e.key==='Tab'){const buttons=Array.from(modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),first=buttons[0],last=buttons.at(-1)!;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 const timer=window.setInterval(()=>{if(!modal.hidden)load();},5000);window.addEventListener('pagehide',()=>clearInterval(timer));
 return {close};
}
