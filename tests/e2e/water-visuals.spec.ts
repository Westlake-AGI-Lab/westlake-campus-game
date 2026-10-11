import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {createGame} from '../../server/game';
import {createWaterGame} from '../../server/water';
import {arenaPath} from '../water-paths';
import {registration} from '../account-helpers';
import {WATER,type WaterInput} from '../../shared/water';

// A memory-only fixture accelerates legitimate directional walking, never teleports a player.
// The browser loads the actual production bundle and receives normal authoritative snapshots.
test('持枪双臂、三种模型、射击补水同步、循环特效与资源回收',async({browser})=>{
 const root=resolve('dist');let offset=0;const clock=()=>Date.now()+offset;
 const http=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url!,'http://localhost').pathname);if(!p.startsWith(root+sep)||!(await stat(p)).isFile())throw Error('missing');res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.json':'application/json'} as Record<string,string>)[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});
 const presence=new Set<string>(),parent=createGame(http,{databasePath:':memory:',presence}),room=createWaterGame(parent.io.of('/water'),parent.accountStore,presence,{clock,buyMs:15000,roundMs:240000,resultsMs:100});
 await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(http.address() as any).port}`;
 const context=await browser.newContext({viewport:{width:1600,height:900}}),page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let peer:Socket|undefined,timer:ReturnType<typeof setInterval>|undefined;
 const debug=()=>page.evaluate(()=>(window as any).__waterDebug),emit=(event:string,v:unknown)=>new Promise<any>(r=>peer!.emit(event,v,r));let seq=0,action=0,shot=0;
 const input=(extra:Partial<WaterInput>={}):WaterInput=>({seq:++seq,forward:0,side:0,yaw:.5,pitch:0,walk:false,crouch:false,jump:false,interact:false,...extra});
 try{
  await page.goto(url+'/water.html');const auth=registration();await page.locator('#auth-register').click();await page.locator('#username').fill(auth.username);for(let i=0;i<3;i++)await page.locator('#name-part-'+i).selectOption(auth.displayName[i]);await page.locator('#password').fill(auth.password);await page.locator('#enter-campus').click();await expect(page.locator('#entry')).toBeHidden();
  peer=io(url+'/water',{transports:['websocket'],reconnection:false});await new Promise<void>(r=>peer!.once('connect',r));const joined=await emit('join',registration(1));expect(joined.playerId).toBeTruthy();room.step();offset+=15050;room.step();
  const observer=room.snapshot().players.find(p=>p.id!==joined.playerId)!,target={x:observer.x+.8,z:observer.z+3.6};
  const position=()=>room.snapshot().players.find(p=>p.id===joined.playerId)!;
  for(const goal of arenaPath(position(),target)){for(let n=0;n<30;n++){const p=position(),dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);if(d<.18)break;expect(n,'Directional walking must reach each route point').toBeLessThan(29);await emit('water-input',input({forward:Math.min(1,d/(WATER.speed*.05)),yaw:Math.atan2(-dx,-dz)}));offset+=50;room.step();}}
  await emit('water-input',input());room.step();timer=setInterval(()=>room.step(),50);
  await expect.poll(async()=>(await debug()).visuals.players.length).toBe(1);await page.evaluate(()=>document.getElementById('water-lock')!.hidden=true);
  const visual=async()=> (await debug()).visuals.players[0];await expect.poll(async()=>(await visual()).gripError).toBeLessThan(.00001);
  await mkdir('reports/screenshots',{recursive:true});await page.waitForTimeout(650);await page.screenshot({path:'reports/screenshots/water-third-person.png'});
  const before=await debug();await emit('water-shot',{seq:++shot,yaw:.5,pitch:-.2,time:clock()});await expect.poll(async()=>(await debug()).visuals.effects.emitted).toBeGreaterThan(0);await page.screenshot({path:'reports/screenshots/water-spray.png'});
  expect((await emit('water-action',{seq:++action,kind:'reload'})).ok).toBe(true);await expect.poll(async()=>(await visual()).reload).toBeGreaterThan(.1);await page.waitForTimeout(320);const reload=await visual();expect(reload.reload).toBeLessThan(1);expect(reload.hands[0][1]).toBeGreaterThan(before.visuals.players[0].hands[0][1]+.1);await page.screenshot({path:'reports/screenshots/water-refill.png'});await expect.poll(async()=>(await visual()).reload).toBe(-1);
  // Leaving the other participant returns to warm-up; equipment can then be switched normally.
  await page.locator('#water-logout').click();await expect.poll(()=>room.snapshot().players.length).toBe(1);offset+=200;room.step();expect(room.snapshot().phase).toBe('waiting');expect((await emit('water-action',{seq:++action,kind:'buy',item:'splash'})).ok).toBe(true);
  // Resume the same observer account without changing its appearance or saved roaming stats.
  await page.locator('#auth-login').click();await page.locator('#username').fill(auth.username);await page.locator('#password').fill(auth.password);await page.locator('#enter-campus').click();await expect(page.locator('#entry')).toBeHidden();room.step();
  for(const kind of ['precision','stream','sprayer']){expect((await emit('water-action',{seq:++action,kind:'buy',item:kind})).ok).toBe(true);await expect.poll(async()=>(await visual()).weapon).toBe(kind);}
  offset+=15050;room.step();expect((await emit('water-action',{seq:++action,kind:'splash'})).ok).toBe(true);offset+=1450;room.step();await expect.poll(async()=>(await debug()).visuals.effects.rings).toBeGreaterThan(0);await page.waitForTimeout(750);
  await expect.poll(async()=>(await debug()).visuals.players.length).toBe(1);await page.waitForTimeout(400);await emit('water-shot',{seq:++shot,yaw:.5,pitch:0,time:clock()});await page.waitForTimeout(700);const settled=await debug();
  for(let n=0;n<40;n++){await emit('water-shot',{seq:++shot,yaw:.5,pitch:0,time:clock()});offset+=350;room.step();if(n%10===9){await emit('water-action',{seq:++action,kind:'reload'});offset+=1500;room.step();}}
  await page.waitForTimeout(750);const after=await debug();expect(after.visuals.effects.active).toBe(0);expect(after.visuals.effects.jets).toBe(0);expect(after.memory.geometries).toBeLessThanOrEqual(settled.memory.geometries+2);expect(after.memory.textures).toBe(settled.memory.textures);expect(after.visuals.effects.capacity).toBe(256);expect(after.errors).toEqual([]);expect(errors).toEqual([]);
  await writeFile('reports/water-visual-results.json',JSON.stringify({status:'PASS',heldPose:before.visuals.players,refillPose:reload,render:after.render,memoryBefore:settled.memory,memoryAfter:after.memory,effects:after.visuals.effects,errors},null,2));
 }finally{if(timer)clearInterval(timer);peer?.disconnect();await context.close();await room.close();await parent.close();}
});
