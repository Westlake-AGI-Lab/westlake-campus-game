import baked from '../data/water-navigation.json' with {type:'json'};
import type {WaterMode} from '../shared/water-modes';
/** Bounded breadth-first routing over precomputed collision-safe arena edges. */
export function waterNpcRoute(mode:WaterMode,start:{x:number;z:number},goal:{x:number;z:number}){
 const g=baked.layouts[mode==='classic'?'classic':'compact'];
 const nearest=(p:typeof start)=>{let best=-1,d=Infinity;for(let i=0;i<g.mask.length;i++)if(g.mask[i]!=='.'){const x=g.minX+i%g.width*g.step,z=g.minZ+Math.floor(i/g.width)*g.step,v=(x-p.x)**2+(z-p.z)**2;if(v<d){d=v;best=i;}}return best;};
 const a=nearest(start),b=nearest(goal);if(a<0||b<0)return[];const parent=new Int32Array(g.mask.length).fill(-1),queue=new Int32Array(g.mask.length);let head=0,tail=1;queue[0]=a;parent[a]=a;
 const offsets=[1,g.width,-1,-g.width];while(head<tail&&parent[b]<0){const i=queue[head++],mask=parseInt(g.mask[i],16);for(let n=0;n<4;n++)if(mask&(1<<n)){const j=i+offsets[n];if(j>=0&&j<parent.length&&parent[j]<0){parent[j]=i;queue[tail++]=j;}}}
 if(parent[b]<0)return[];const ids=[b];while(ids[ids.length-1]!==a)ids.push(parent[ids[ids.length-1]]);return ids.reverse().map(i=>({x:g.minX+i%g.width*g.step,z:g.minZ+Math.floor(i/g.width)*g.step}));
}
