import {ARENA,waterBlocked,type Vec} from '../shared/water';
// A test-only grid planner. Production movement still accepts directions only.
export function arenaPath(start:Vec,target:{x:number;z:number}){
 const b=ARENA.bounds,cell=2,minX=Math.ceil((b.minX+1)/cell),maxX=Math.floor((b.maxX-1)/cell),minZ=Math.ceil((b.minZ+1)/cell),maxZ=Math.floor((b.maxZ-1)/cell),key=(x:number,z:number)=>`${x},${z}`,safe=(x:number,z:number)=>x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ&&!waterBlocked({x:x*cell,y:0,z:z*cell});
 const nearest=(p:{x:number;z:number})=>{const x=Math.round(p.x/cell),z=Math.round(p.z/cell);for(let r=0;r<10;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)if(safe(x+dx,z+dz))return{x:x+dx,z:z+dz};throw Error('No nearby walkable grid cell');};
 const a=nearest(start),goal=nearest(target),queue=[a],parents=new Map<string,string|null>([[key(a.x,a.z),null]]);let found='';for(let i=0;i<queue.length;i++){const p=queue[i],k=key(p.x,p.z);if(p.x===goal.x&&p.z===goal.z){found=k;break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,n=key(x,z);if(parents.has(n)||!safe(x,z))continue;
 // Sample segment interiors so a thin rotated screen cannot fall between cells.
 if([.25,.5,.75].some(t=>waterBlocked({x:(p.x+dx*t)*cell,y:0,z:(p.z+dz*t)*cell})))continue;parents.set(n,k);queue.push({x,z});}}
 if(!found)throw Error(`No arena route from ${JSON.stringify(start)} to ${JSON.stringify(target)}`);const points:{x:number;z:number}[]=[];while(found){const [x,z]=found.split(',').map(Number);points.push({x:x*cell,z:z*cell});found=parents.get(found)||'';}return points.reverse();
}
