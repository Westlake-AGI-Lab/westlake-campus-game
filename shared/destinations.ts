import {campus} from './world';
import {PARKING} from './vehicles';
import {SHUTTLE_STOPS} from './shuttle';
import {CAT_PATHS,LAB_POINT} from './wildlife';
import {buildingName,normalizeSearch} from './buildings';
import type {Point} from './types';
export type Destination={id:string;name:string;point:Point;group:string;building:boolean;aliases:string;codes?:string[]};
const plazaNames:Record<string,string>={'plaza-0':'南入口广场','plaza-1':'水庭园','plaza-3':'东庭广场','plaza-4':'西庭广场','library-apron':'图书中心门前','H5-front':'H5 门前广场'};
export const destinations:Destination[]=[
 ...SHUTTLE_STOPS.map(s=>({id:s.id,name:s.name,point:s.point,group:'校车站',building:false,aliases:s.name+' 校车 巴士 公交 环线 车站'})),
 {id:'campus-cat',name:'校园猫 · 庭园小径',point:CAT_PATHS[0][0],group:'校园空间',building:false,aliases:'流浪猫 校园猫 猫咪 小猫'},
 {id:'night-lab',name:'深夜实验室亮窗',point:LAB_POINT,group:'校园空间',building:false,aliases:'彩蛋 深夜 亮窗 实验室 AGI Lab'},
 {id:'parking',name:'西南角共享停车区',point:{...PARKING.point},group:'校园空间',building:false,aliases:'停车区 停车场 汽车 开车 共享车'},
 {id:'garden',name:'中央庭园',point:campus.spawnPoints[0],group:'校园空间',building:false,aliases:'中央庭园 起点'},
 ...campus.buildings.map((b,i)=>({id:b.id,name:buildingName(b),codes:b.codes,point:b.id==='E10'?{x:123,z:86}:{x:b.x,z:b.z},group:i<10?'学术核心':i<28?'公共设施':'生活区',building:true,aliases:[b.name,...b.codes||[],...b.nameAliases||[]].join(' ')})),
 ...campus.plazas.map(p=>({id:'place-'+p.id,name:plazaNames[p.id]||'校园广场',point:{x:p.x,z:p.z},group:'校园空间',building:false,aliases:plazaNames[p.id]||p.id})),
 ...campus.bridges.map((b,i)=>({id:b.id,name:`水环桥 ${i+1}`,point:b.points[Math.floor(b.points.length/2)],group:'桥梁与水岸',building:false,aliases:`水环桥 ${i+1} ${b.id}`})),
 ...(campus.waterWalkways||[]).map(b=>({id:b.id,name:b.id==='shuttle-east-connector'?'东侧环线连接桥':'水庭园栈道',point:b.points[Math.floor(b.points.length/2)],group:'桥梁与水岸',building:false,aliases:b.id==='shuttle-east-connector'?'校车环线 过水桥 连接桥':'水庭园 栈道'}))
];

export function searchDestinations(query:string):Destination[]{
 const q=normalizeSearch(query);if(!q)return destinations;
 const numbered=/^[A-Z]\d+$/.test(q);
 return destinations.map((d,index)=>{
  const codes=(d.codes||[]).map(normalizeSearch),name=normalizeSearch(d.name),aliases=normalizeSearch(d.aliases);
  const exact=codes.includes(q);
  // C1 must locate C1, never C10/C11; unknown codes must not match internal IDs.
  const score=exact?0:numbered?Infinity:name===q?1:name.startsWith(q)?2:aliases.includes(q)?3:Infinity;
  return {d,index,score};
 }).filter(v=>Number.isFinite(v.score)).sort((a,b)=>a.score-b.score||a.index-b.index).map(v=>v.d);
}
