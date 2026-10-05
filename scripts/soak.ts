import {APPROVED_NAMES} from '../shared/names';
import {createServer} from 'node:http';
import {io,Socket} from 'socket.io-client';
import {createGame} from '../server/game';
import {writeFile} from 'node:fs/promises';
const duration=Number(process.env.SOAK_MS||900000),http=createServer(),game=createGame(http);
await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`;
const clients:Socket[]=[];let joins=0,leaves=0,seq=0,cycling=false,failures:string[]=[];
async function join(i:number){const s=io(url,{transports:['websocket'],reconnection:false});await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(Error('connect timeout')),5000);s.on('connect',()=>s.emit('join',{mode:'register',username:'soak_'+i,displayName:APPROVED_NAMES[i%APPROVED_NAMES.length],password:'campus-test-123',color:i%6},(w:any)=>{clearTimeout(t);if(!w.playerId)reject(Error('join failed'));else resolve();}));});joins++;return s;}
for(let i=0;i<10;i++)clients.push(await join(i));
const start=Date.now(),samples:any[]=[];
const inputTimer=setInterval(()=>{for(const[i,s]of clients.entries())s.emit('input',{seq:++seq,x:i%2?1:-1,z:0,run:false});},100);
const sampleTimer=setInterval(()=>{const stats=game.stats();samples.push({elapsedMs:Date.now()-start,...stats});if(!cycling&&stats.online!==10)failures.push('online='+stats.online);console.log(JSON.stringify({elapsedSeconds:Math.round((Date.now()-start)/1000),online:stats.online,recoveries:stats.recoveries,heapMB:+(stats.memory.heapUsed/1048576).toFixed(1),joins,leaves}));},30000);
const cycleTimer=setInterval(async()=>{cycling=true;const old=clients.pop()!;old.emit('leave');await new Promise(r=>setTimeout(r,80));old.disconnect();leaves++;clients.push(await join(10+joins));cycling=false;},45000);
await new Promise(r=>setTimeout(r,duration));clearInterval(inputTimer);clearInterval(sampleTimer);clearInterval(cycleTimer);for(const s of clients)s.emit('leave');await new Promise(r=>setTimeout(r,80));for(const s of clients)s.disconnect();await new Promise(r=>setTimeout(r,250));const final=game.stats();const result={status:failures.length||final.online!==0?'FAIL':'PASS',durationMs:Date.now()-start,clients:10,kind:'protocol clients (not ten browser renderers)',joins,leaves,failures,samples,final};await writeFile('reports/soak-results.json',JSON.stringify(result,null,2));await game.close();console.log('Soak complete',result.status);if(result.status!=='PASS')process.exitCode=1;
