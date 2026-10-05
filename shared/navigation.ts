import grid from '../data/navigation.json' with {type:'json'};
import {campus,blocked} from './world';
import {collisionQuery} from './navigation-geometry';
import type {Point,RouteReply} from './types';
export const directions=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]] as const;
const edges=new Uint8Array(grid.width*grid.height),query=collisionQuery();let cursor=0;
for(let i=0;i<grid.runs.length;i+=2){edges.fill(grid.runs[i],cursor,cursor+grid.runs[i+1]);cursor+=grid.runs[i+1];}
if(cursor!==edges.length)throw Error('Invalid navigation graph');
const point=(n:number):Point=>({x:grid.minX+n%grid.width*grid.step,z:grid.minZ+Math.floor(n/grid.width)*grid.step});
const offset=directions.map(([x,z])=>x+z*grid.width),distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
let components:Int32Array|undefined;
function connected(){
 if(components)return components;components=new Int32Array(edges.length);const queue=new Int32Array(edges.length);let label=0;
 for(let n=0;n<edges.length;n++){if(!edges[n]||components[n])continue;let head=0,tail=1;queue[0]=n;components[n]=++label;while(head<tail){const current=queue[head++];for(let d=0;d<8;d++){if(!(edges[current]&(1<<d)))continue;const next=current+offset[d];if(!components[next]){components[next]=label;queue[tail++]=next;}}}}
 return components;
}
export function validMapPoint(value:unknown):value is Point{
 if(!value||typeof value!=='object')return false;const p=value as Record<string,unknown>,b=campus.meta.bounds;
 return Object.keys(p).length===2&&Object.keys(p).every(k=>k==='x'||k==='z')&&typeof p.x==='number'&&typeof p.z==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ;
}
export function landingPoint(requested:Point,occupied:Point[]=[]):Point|undefined{
 if(!validMapPoint(requested))return;
 const free=(p:Point)=>!blocked(p)&&occupied.every(other=>distance(p,other)>1.5);
 if(free(requested))return{...requested};
 let best=-1,bestDistance=Infinity;
 for(let n=0;n<edges.length;n++){if(!edges[n])continue;const p=point(n),d=(p.x-requested.x)**2+(p.z-requested.z)**2;if(d<bestDistance&&occupied.every(other=>distance(p,other)>1.5)){best=n;bestDistance=d;}}
 if(best>=0&&free(point(best)))return point(best);
}
function nearbyNode(p:Point,component?:number){
 const labels=component?connected():undefined;
 for(const radius of[6,14,30]){let best=-1,bestDistance=Infinity;const minX=Math.max(0,Math.floor((p.x-radius-grid.minX)/grid.step)),maxX=Math.min(grid.width-1,Math.ceil((p.x+radius-grid.minX)/grid.step)),minZ=Math.max(0,Math.floor((p.z-radius-grid.minZ)/grid.step)),maxZ=Math.min(grid.height-1,Math.ceil((p.z+radius-grid.minZ)/grid.step));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const n=z*grid.width+x;if(!edges[n]||labels&&labels[n]!==component)continue;const q=point(n),d=(p.x-q.x)**2+(p.z-q.z)**2;if(d<bestDistance&&query.clear(p,q)){best=n;bestDistance=d;}}
  if(best>=0)return best;
 }
 return -1;
}
class Heap{
 private items:{node:number;score:number}[]=[];
 push(node:number,score:number){const item={node,score};let i=this.items.length;this.items.push(item);while(i>0){const parent=(i-1)>>1;if(this.items[parent].score<=score)break;this.items[i]=this.items[parent];i=parent;}this.items[i]=item;}
 pop(){const top=this.items[0],last=this.items.pop()!;if(this.items.length){let i=0;while(i*2+1<this.items.length){let child=i*2+1;if(child+1<this.items.length&&this.items[child+1].score<this.items[child].score)child++;if(this.items[child].score>=last.score)break;this.items[i]=this.items[child];i=child;}this.items[i]=last;}return top;}
 get length(){return this.items.length;}
}
function smooth(path:Point[]){const result=[path[0]];let current=0;while(current<path.length-1){let next=current+1;for(let i=current+2;i<path.length&&i<current+90;i++){if(query.clear(path[current],path[i]))next=i;else break;}result.push(path[next]);current=next;}return result;}
export function planRoute(start:Point,requested:Point,allowApproach=false):RouteReply{
 if(!validMapPoint(start)||!validMapPoint(requested)||query.blocked(start))return{ok:false,error:'当前位置或目的地不可用，请重新选择地图位置。'};
 const first=nearbyNode(start);if(first<0)return{ok:false,error:'当前位置没有可步行的出口，可以先空降到附近开放区域。'};
 const labels=connected(),component=labels[first];let goal=nearbyNode(requested,component),target={...requested};
 if(goal<0&&(allowApproach||query.blocked(requested))){let closest=Infinity;for(let n=0;n<edges.length;n++){if(labels[n]!==component)continue;const p=point(n),d=(p.x-requested.x)**2+(p.z-requested.z)**2;if(d<closest){closest=d;goal=n;}}if(goal>=0)target=point(goal);}
 if(goal<0)return{ok:false,error:'这个位置没有连通的步行路线，可改选入口附近，或直接空降。'};
 const costs=new Float64Array(edges.length);costs.fill(Infinity);costs[first]=0;const previous=new Int32Array(edges.length);previous.fill(-1);const closed=new Uint8Array(edges.length),heap=new Heap();heap.push(first,distance(point(first),point(goal)));
 while(heap.length){const {node}=heap.pop();if(closed[node])continue;closed[node]=1;if(node===goal){const path:Point[]=[];let n=goal;while(n>=0){path.push(point(n));n=previous[n];}path.reverse();path.unshift({...start});path.push(target);const route=smooth(path),metres=route.slice(1).reduce((sum,p,i)=>sum+distance(p,route[i]),0);return{ok:true,path:route,target,distance:metres,adjusted:distance(requested,target)>.5};}
  for(let d=0;d<8;d++){if(!(edges[node]&(1<<d)))continue;const next=node+offset[d],cost=costs[node]+grid.step*(d%2?Math.SQRT2:1);if(closed[next]||cost>=costs[next])continue;costs[next]=cost;previous[next]=node;heap.push(next,cost+distance(point(next),point(goal)));}
 }
 return{ok:false,error:'暂时无法规划这条步行路线，请换一个附近落点。'};
}
export const navigationGraph={step:grid.step,nodes:edges.length,sourceHash:grid.sourceHash};
