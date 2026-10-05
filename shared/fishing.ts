import type {Player,Point} from './types';
export const FISHING={point:{x:-148,z:296},water:{x:-148,z:304},range:3,drift:1.5,waitMin:4000,waitMax:8000,biteWindow:2400,recastMs:1000,resultMs:4000};
export type FishingAction={kind:'cast'|'reel'|'cancel'};
export type FishingView={playerId:string;anchor:Point;castAt:number;phase:'waiting'|'bite'|'caught';result?:'fish'|'goldfish'|'bottle';message?:string};
export type FishingReply={ok:boolean;error?:string;message?:string;result?:FishingView['result']};
export function validFishingAction(value:unknown):value is FishingAction{if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;return Object.keys(v).length===1&&['cast','reel','cancel'].includes(String(v.kind));}
export const fishingBusy=(p:Player,now:number)=>!!p.vehicleId||!!p.shuttleId||Math.max(p.stunnedUntil,p.heavyUntil,p.dodgeUntil,p.guardUntil)>now;
export class FishingRoom{
 private casts=new Map<string,FishingView&{biteAt:number;endAt:number}>();private last=new Map<string,number>();
 constructor(private random:()=>number=Math.random){}
 remove(id:string){this.casts.delete(id);this.last.delete(id);}
 action(p:Player,value:unknown,now:number):FishingReply{
  if(!validFishingAction(value))return {ok:false,error:'操作无效。'};
  if(value.kind==='cancel'&&this.casts.has(p.id)){this.casts.delete(p.id);this.last.set(p.id,now);return {ok:true};}
  if(now-(this.last.get(p.id)||-Infinity)<(value.kind==='cast'?FISHING.recastMs:250))return {ok:false,error:'请稍等。'};this.last.set(p.id,now);
  const cast=this.casts.get(p.id);
  if(value.kind==='cancel'){this.casts.delete(p.id);return {ok:true};}
  if(value.kind==='cast'){
   if(cast)return {ok:false,error:'先收竿再试。'};
   if(fishingBusy(p,now)||p.moving||Math.hypot(p.x-FISHING.point.x,p.z-FISHING.point.z)>FISHING.range)return {ok:false,error:'请在水边站稳后再抛竿。'};
   const biteAt=now+FISHING.waitMin+Math.floor(this.random()*(FISHING.waitMax-FISHING.waitMin));this.casts.set(p.id,{playerId:p.id,anchor:{x:p.x,z:p.z},castAt:now,biteAt,endAt:biteAt+FISHING.biteWindow,phase:'waiting'});return {ok:true};
  }
  if(!cast||cast.phase==='caught')return {ok:false,error:'还没有抛竿。'};
  this.casts.delete(p.id);
  if(fishingBusy(p,now)||Math.hypot(p.x-cast.anchor.x,p.z-cast.anchor.z)>FISHING.drift||p.punchAt>cast.castAt||p.hitAt>cast.castAt)return {ok:false,error:'鱼线松开了。'};
  if(now<cast.biteAt)return {ok:true,message:'收得有点早，水面只泛起一圈涟漪。'};
  if(now>cast.endAt)return {ok:true,message:'慢了一点，鱼儿已经溜走了。'};
  const roll=this.random(),result=roll<.8?'fish':roll<.95?'goldfish':'bottle';
  const message={fish:'钓到一尾小鱼，轻轻放回水里。',goldfish:'一尾金色小鱼跃出水面，又游回了水里。',bottle:'漂流瓶里有张纸条：实验还在跑，先来吹吹风。'}[result];
  this.casts.set(p.id,{...cast,phase:'caught',result,message,endAt:now+FISHING.resultMs});return {ok:true,result,message};
 }
 tick(players:Player[],now:number){const notices:{playerId:string;message:string}[]=[];
  for(const [id,c]of this.casts){const p=players.find(p=>p.id===id);if(!p){this.remove(id);continue;}
   if(c.phase!=='caught'&&(fishingBusy(p,now)||Math.hypot(p.x-c.anchor.x,p.z-c.anchor.z)>FISHING.drift||p.punchAt>c.castAt||p.hitAt>c.castAt)){this.casts.delete(id);notices.push({playerId:id,message:'你离开了鱼竿，鱼线松开了。'});continue;}
   if(now>c.endAt){this.casts.delete(id);if(c.phase!=='caught')notices.push({playerId:id,message:'浮漂又静下来了。'});}else if(c.phase!=='caught')c.phase=now>=c.biteAt?'bite':'waiting';
  }return notices;
 }
 snapshot():FishingView[]{return [...this.casts.values()].map(({biteAt,endAt,...view})=>({...view,anchor:{...view.anchor}}));}
}
