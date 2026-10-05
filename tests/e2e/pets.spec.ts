import {test,expect,type Page} from '@playwright/test';
import {registerPage} from '../account-helpers';import {campus} from '../../shared/world';
const debug=(p:Page)=>p.evaluate(()=>(window as any).__campusDebug);
async function approach(p:Page,id:string){
 if(await p.locator('#map-panel').isHidden())await p.locator('#map-toggle').click();if(!((await p.locator('#map-panel').getAttribute('class'))||'').includes('expanded'))await p.locator('#map-expand').click();
 const pet=(await debug(p)).world.pets.find((v:any)=>v.id===id),rect=(await p.locator('#map').boundingBox())!,b=campus.meta.bounds;
 await p.locator('#map').click({position:{x:(20+(pet.x-b.minX)/(b.maxX-b.minX)*520)/560*rect.width,y:(20+(pet.z-b.minZ)/(b.maxZ-b.minZ)*480)/520*rect.height}});await p.locator('#airdrop').click();await p.locator('#map-expand').click();await expect(p.locator('#pet-name')).toContainText(pet.name);
}
test('猫狗认领、投喂、跟随、解除认领与刷新，双页面同步和窄屏入口',async({context})=>{
 const a=await context.newPage(),b=await context.newPage(),errors:string[]=[];for(const p of[a,b])p.on('pageerror',e=>errors.push(e.message));
 await registerPage(a);await registerPage(b);await expect.poll(async()=>(await debug(a)).world.pets.length).toBe(7);
 await approach(a,'pet-5');await a.locator('#pet-feed').click();await expect.poll(async()=>(await debug(b)).world.pets.find((p:any)=>p.id==='pet-5').fedAt).toBeGreaterThan(0);await expect(a.locator('#pet-feed')).toBeDisabled();
 await a.waitForTimeout(450);await a.locator('#pet-adopt').click();await expect(a.locator('#pet-adopt')).toHaveText('解除认领');const id=(await debug(a)).playerId;await expect.poll(async()=>(await debug(b)).world.pets.find((p:any)=>p.id==='pet-5').ownerId).toBe(id);
 await a.locator('#world').click({position:{x:600,y:340}});await a.keyboard.down('KeyD');await a.waitForTimeout(900);await a.keyboard.up('KeyD');await expect.poll(async()=>{const d=await debug(a),p=d.world.pets.find((v:any)=>v.id==='pet-5');return Math.hypot(p.x-d.local.x,p.z-d.local.z);}).toBeLessThan(4);
 await a.locator('#ambience-panel summary').click();await a.locator('#ambience-time').selectOption('13');await a.locator('#ambience-panel summary').click();await a.screenshot({path:'reports/screenshots/pet-dog.png'});
 await a.reload();await expect.poll(async()=>(await debug(a)).connected).toBe(true);await expect(a.locator('#my-pets')).toBeVisible();await a.locator('#my-pets summary').click();await a.locator('[data-pet-release="pet-5"]').click();await expect.poll(async()=>(await debug(b)).world.pets.find((p:any)=>p.id==='pet-5').ownerId).toBeNull();
 await a.waitForTimeout(2200);await approach(a,'pet-1');await a.locator('#pet-adopt').click();await expect(a.locator('#my-pets')).toBeVisible();await a.waitForTimeout(450);await a.locator('#pet-feed').click();await expect.poll(async()=>(await debug(a)).ambience.cats.some((p:any)=>p.heart)).toBe(true);await a.screenshot({path:'reports/screenshots/pet-cat.png'});
 await a.setViewportSize({width:390,height:844});await a.locator('#map-toggle').click();await expect(a.locator('#pet-feed')).toBeInViewport();await expect(a.locator('#pet-adopt')).toBeInViewport();await a.screenshot({path:'reports/screenshots/pet-mobile.png'});expect(errors).toEqual([]);await a.close();await b.close();
});
