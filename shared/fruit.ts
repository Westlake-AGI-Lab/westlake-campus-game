import type {Player,Point} from './types';
export const FRUIT={range:3.5,regrowMs:90000,displayMs:3500,cooldownMs:700};
export const FRUIT_TREES=[{id:'fruit-tree-1',point:{x:22,z:92},name:'苹果',color:'#d97051'},{id:'fruit-tree-2',point:{x:-105,z:45},name:'柿子',color:'#eda24d'},{id:'fruit-tree-3',point:{x:142,z:90},name:'梨',color:'#dfc978'}] as const;
export type FruitState={id:string;ripeAt:number;pickedAt:number;pickedBy:string|null;golden:boolean};
export type FruitTreeState={id:string;fruits:FruitState[]};
export type FruitPick={treeId:string;fruitId:string};export type FruitReply={ok:boolean;error?:string;message?:string};
export const fruitPosition=(i:number)=>({x:Math.sin(i*Math.PI/3)*1.5,y:2.5+(i%2)*.35,z:Math.cos(i*Math.PI/3)*1.5});
export function validFruitPick(value:unknown):value is FruitPick{if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;return Object.keys(v).length===2&&typeof v.treeId==='string'&&typeof v.fruitId==='string'&&v.treeId.length<32&&v.fruitId.length<32;}
export class Orchard{
 private states:FruitTreeState[];private last=new Map<string,number>();
 constructor(now=Date.now(),private random:()=>number=Math.random){this.states=FRUIT_TREES.map(t=>({id:t.id,fruits:Array.from({length:6},(_,i)=>({id:'fruit-'+(i+1),ripeAt:now+(i===5?45000:0),pickedAt:0,pickedBy:null,golden:false}))}));}
 remove(id:string){this.last.delete(id);}
 pick(p:Player,value:unknown,now:number):FruitReply{
  if(!validFruitPick(value))return {ok:false,error:'采摘信息无效。'};
  if(now-(this.last.get(p.id)??-Infinity)<FRUIT.cooldownMs)return {ok:false,error:'轻轻摘，稍等一下。'};this.last.set(p.id,now);
  const tree=FRUIT_TREES.find(t=>t.id===value.treeId),state=this.states.find(t=>t.id===value.treeId),fruit=state?.fruits.find(f=>f.id===value.fruitId);
  if(!tree||!fruit)return {ok:false,error:'没有找到这颗果子。'};
  if(p.vehicleId||p.shuttleId||Math.max(p.stunnedUntil,p.heavyUntil,p.dodgeUntil,p.guardUntil)>now)return {ok:false,error:'先站稳再摘吧。'};
  if(Math.hypot(p.x-tree.point.x,p.z-tree.point.z)>FRUIT.range)return {ok:false,error:'请靠近这棵树。'};
  if(now<fruit.ripeAt)return {ok:false,error:'这颗还没熟，给它一点时间。'};
  fruit.pickedAt=now;fruit.pickedBy=p.id;fruit.ripeAt=now+FRUIT.regrowMs;fruit.golden=this.random()<.08;
  return {ok:true,message:fruit.golden?'枝叶间竟藏着一颗金色的果子。':`摘到一颗熟透的${tree.name}，树荫里的午后甜了一点。`};
 }
 snapshot():FruitTreeState[]{return this.states.map(t=>({...t,fruits:t.fruits.map(f=>({...f}))}));}
}
