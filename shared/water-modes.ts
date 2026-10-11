import {WATER_BOUNDS,WATER_BOXES,WATER_SITES,WATER_SPAWNS,WATER_COVER} from './water-arena';
export type WaterMode='classic'|'duo'|'quick';
export const WATER_MODES={
 classic:{name:'经典回合赛',namespace:'/water',teamSize:5,capacity:20,buyMs:15000,roundMs:100000,winningScore:7,swapAfter:6},
 duo:{name:'2v2 会堂小场',namespace:'/water-duo',teamSize:2,capacity:10,buyMs:10000,roundMs:75000,winningScore:5,swapAfter:4},
 quick:{name:'五分钟快速赛',namespace:'/water-quick',teamSize:5,capacity:20,buyMs:8000,roundMs:300000,winningScore:30,swapAfter:0},
} as const;
export const WATER_TOTAL_CAPACITY=40;
export const waterMode=(v:unknown):WaterMode=>v==='duo'||v==='quick'?v:'classic';
export const COMPACT_BOUNDS={minX:-45,maxX:78,minZ:-20,maxZ:68};
const compactCover=WATER_COVER.filter(b=>b.x>COMPACT_BOUNDS.minX&&b.x<COMPACT_BOUNDS.maxX&&b.z>COMPACT_BOUNDS.minZ&&b.z<COMPACT_BOUNDS.maxZ);
export const COMPACT_ARENA={bounds:COMPACT_BOUNDS,boxes:[...WATER_BOXES.filter(b=>b.kind==='building'&&b.objectId==='E0'),...compactCover],sites:[WATER_SITES[1]].map(s=>({...s,id:'A'}))};
export const CLASSIC_ARENA={bounds:WATER_BOUNDS,boxes:WATER_BOXES,sites:WATER_SITES};
const QUICK_ARENA={...COMPACT_ARENA,sites:[]};
export const waterArena=(mode:WaterMode)=>mode==='classic'?CLASSIC_ARENA:mode==='duo'?COMPACT_ARENA:QUICK_ARENA;
export const waterSpawns=(mode:WaterMode)=>mode==='classic'?WATER_SPAWNS:{attack:{x:-24,z:-12,yaw:Math.PI},defend:{x:-24,z:64,yaw:0}};
export type WaterArena=ReturnType<typeof waterArena>;
