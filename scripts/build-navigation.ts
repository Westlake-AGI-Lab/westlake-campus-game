import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {campus} from '../shared/world';
import {collisionQuery} from '../shared/navigation-geometry';
const hash=createHash('sha256');for(const f of ['data/campus.json','shared/world.ts','shared/config.ts','shared/navigation-geometry.ts', 'scripts/build-navigation.ts'])hash.update(readFileSync(f));const sourceHash=hash.digest('hex'),file='data/navigation.json';
if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).sourceHash===sourceHash){console.log('Navigation graph up to date');process.exit(0);}
const began=Date.now(),step=2,b=campus.meta.bounds,minX=b.minX+1,minZ=b.minZ+1,width=Math.floor((b.maxX-1-minX)/step)+1,height=Math.floor((b.maxZ-1-minZ)/step)+1,size=width*height,free=new Uint8Array(size),edges=new Uint8Array(size),query=collisionQuery();
const point=(n:number)=>({x:minX+(n%width)*step,z:minZ+Math.floor(n/width)*step});
for(let n=0;n<size;n++)free[n]=Number(!query.blocked(point(n)));
const directions=[[1,0],[1,1],[0,1],[-1,1]];
for(let n=0;n<size;n++){if(!free[n])continue;const x=n%width,z=Math.floor(n/width),a=point(n);for(let d=0;d<4;d++){const[dx,dz]=directions[d],nx=x+dx,nz=z+dz;if(nx<0||nx>=width||nz<0||nz>=height)continue;const next=n+dx+dz*width;if(free[next]&&query.clear(a,point(next))){edges[n]|=1<<d;edges[next]|=1<<(d+4);}}}
const runs:number[]=[];let value=edges[0],count=0;for(const edge of edges){if(edge===value)count++;else{runs.push(value,count);value=edge;count=1;}}runs.push(value,count);
writeFileSync(file,JSON.stringify({version:1,sourceHash,step,minX,minZ,width,height,runs})+'\n');console.log('Navigation graph built:',size,'nodes,',free.reduce((a,b)=>a+b,0),'walkable,',Date.now()-began,'ms');
