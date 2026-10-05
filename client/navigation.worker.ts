import {planRoute} from '../shared/navigation';
import type {Point} from '../shared/types';
self.onmessage=(event:MessageEvent<{id:number;start:Point;target:Point;building:boolean}>)=>{
 const {id,start,target,building}=event.data;
 try{self.postMessage({id,result:planRoute(start,target,building)});}catch{self.postMessage({id,result:{ok:false,error:'路线规划暂不可用，请重新选择目的地。'}});}
};
