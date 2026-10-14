import type {Point} from './types';
export type TrafficBody=Point&{id:string;yaw:number;width:number;length:number};
// Minimum SAT overlap of oriented footprints. Zero means separated, including corners.
export function trafficPenetration(a:TrafficBody,b:TrafficBody,pad=.15){
 const ac=Math.cos(a.yaw),as=-Math.sin(a.yaw),bc=Math.cos(b.yaw),bs=-Math.sin(b.yaw),dx=b.x-a.x,dz=b.z-a.z;
 let depth=Infinity;for(const [x,z]of [[ac,as],[-as,ac],[bc,bs],[-bs,bc]]){
  const overlap=Math.abs(ac*x+as*z)*(a.width/2+pad/2)+Math.abs(-as*x+ac*z)*(a.length/2+pad/2)+Math.abs(bc*x+bs*z)*(b.width/2+pad/2)+Math.abs(-bs*x+bc*z)*(b.length/2+pad/2)-Math.abs(dx*x+dz*z);
  if(overlap<=0)return 0;depth=Math.min(depth,overlap);
 }return depth;
}

export function trafficEscaping(from:TrafficBody,to:TrafficBody,obstacle:TrafficBody){
 const next=trafficPenetration(to,obstacle),old=trafficPenetration(from,obstacle);
 return next===0||old>0&&(next<old-1e-7||next<=old+1e-7&&(to.x-obstacle.x)**2+(to.z-obstacle.z)**2>(from.x-obstacle.x)**2+(from.z-obstacle.z)**2+1e-7);
}
