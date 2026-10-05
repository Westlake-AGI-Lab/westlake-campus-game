import {test,expect} from '@playwright/test';
import {io,type Socket} from 'socket.io-client';
import {registerPage,registration} from '../account-helpers';
import {blocked} from '../../shared/world';
import type {Welcome,Snapshot,AttackReply} from '../../shared/types';

test('真实浏览器操作格挡、重拳和方向闪避；对手由独立真实协议连接控制',async({page,baseURL},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await registerPage(page);await page.locator("#hud-toggle").click();const debug=()=>page.evaluate(()=>(window as any).__campusDebug);
 const me=(await debug()).playerId,opponent:Socket=io(baseURL!,{transports:['websocket'],reconnection:false});let snapshot:Snapshot={time:0,count:0,players:[]};opponent.on('world',v=>snapshot=v);
 const welcome=await new Promise<Welcome>(r=>opponent.on('connect',()=>opponent.emit('join',registration(2),r)));let seq=0,attackSeq=0;
 const hit=(kind:'light'|'heavy')=>new Promise<AttackReply>(r=>opponent.emit('attack',{seq:++attackSeq,kind,yaw:-Math.PI/2},r));
 try{
  await expect.poll(()=>snapshot.count).toBe(2);
  while(snapshot.players.find(p=>p.id===welcome.playerId)!.x-snapshot.players.find(p=>p.id===me)!.x>1.7){opponent.emit('input',{seq:++seq,x:-1,z:0,run:false});await page.waitForTimeout(100);expect(seq).toBeLessThan(25);}
  opponent.emit('input',{seq:++seq,x:0,z:0,run:false});
  await page.bringToFront();await page.locator('#world').click({position:{x:600,y:340}});await page.keyboard.down('KeyD');await page.waitForTimeout(70);await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyK');await expect(page.locator('#guard-toggle')).toHaveAttribute('aria-pressed','true');await page.waitForTimeout(250);
  const block=await hit('light');expect(block.punch?.defense).toBe('block');await expect(page.locator('#my-health')).toHaveAttribute('aria-valuenow','95');
  await page.keyboard.up('KeyK');await page.waitForTimeout(650);
  await page.locator('#guard-toggle').click();await expect(page.locator('#guard-toggle')).toHaveAttribute('aria-pressed','true');
  const heavy=await hit('heavy');expect(heavy.charging).toBe(true);await expect.poll(async()=>{const d=await debug();return d.world.players.find((p:any)=>p.id===welcome.playerId).heavyUntil;}).toBeGreaterThan(Date.now());
  await page.waitForTimeout(200);await expect(page.locator('#my-health')).toHaveAttribute('aria-valuenow','95');
  await expect(page.locator('#my-health')).toHaveAttribute('aria-valuenow','70');await expect(page.locator('#combat-state')).toHaveText('硬直');
  // Changing focus releases guard; after recovery, move away from a committed heavy punch.
  await page.locator('#world').click({position:{x:600,y:340}});await page.keyboard.press('Escape');await page.waitForTimeout(1100);
  expect((await hit('heavy')).charging).toBe(true);await page.waitForTimeout(420);
  await page.keyboard.down('KeyW');await page.keyboard.press('KeyQ');await page.keyboard.up('KeyW');
  await expect.poll(async()=>(await debug()).local.dodgeAt).toBeGreaterThan(0);await expect(page.locator('#dodge-toggle')).toBeDisabled();await page.waitForTimeout(450);await expect(page.locator('#my-health')).toHaveAttribute('aria-valuenow','70');expect(blocked((await debug()).local)).toBe(false);
  await expect(page.locator('#heavy-toggle')).toBeEnabled();const before=(await debug()).local.energy;await page.keyboard.press('KeyL');await expect(page.locator('#combat-state')).toHaveText('重拳蓄力');await expect.poll(async()=>(await debug()).local.energy).toBeLessThan(before-25);await expect(page.locator('#attack-toggle')).toBeDisabled();
  await page.screenshot({path:'reports/screenshots/competitive-heavy.png'});await info.attach('competitive-heavy',{path:'reports/screenshots/competitive-heavy.png',contentType:'image/png'});
  await expect.poll(async()=>(await debug()).local.heavyUntil).toBe(0);await expect(page.locator('#energy-track')).toBeVisible();expect(errors).toEqual([]);
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#dodge-toggle')).toBeInViewport();await expect(page.locator('#guard-toggle')).toBeInViewport();await expect(page.locator('#heavy-toggle')).toBeInViewport();
 }finally{opponent.disconnect();}
});
