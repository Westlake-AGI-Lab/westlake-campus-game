import {test,expect} from '@playwright/test';
import {registerPage} from '../account-helpers';
test('紧凑侧栏按需展开，窄屏状态可见',async({page})=>{
 await registerPage(page);
 await expect(page.locator('#hud-toggle')).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#my-health')).toBeVisible();await expect(page.locator('#energy-track')).toBeVisible();
 await expect(page.locator('#combat-skills')).toHaveCount(0);
 await expect(page.locator('.combat-skills')).toBeHidden();await expect(page.locator('#transport-panel')).toBeHidden();
 const compact=(await page.locator('#left-rail').boundingBox())!;expect(compact.height).toBeLessThan(190);
 await page.screenshot({path:'docs/images/hud-compact.png'});
 await page.locator('#hud-toggle').click();await expect(page.locator('#guard-toggle')).toBeVisible();await expect(page.locator('#shuttle-locate')).toBeVisible();
 await page.screenshot({path:'docs/images/hud-expanded.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#heavy-toggle')).toBeInViewport();
 await page.locator('#hud-toggle').click();await expect(page.locator('#my-health')).toBeInViewport();await expect(page.locator('.combat-skills')).toBeHidden();
});
