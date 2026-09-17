import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{for(const [width,height,mode]of [[375,844,'portrait'],[390,844,'portrait'],[430,844,'portrait'],[390,844,'forced'],[844,390,'natural'],[1280,900,'desktop']]){
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:mode!=='desktop',isMobile:mode!=='desktop'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(4000);
 await page.route('**/src/app.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__readAudit={get scene(){return scene},get selected(){return selected}};'});});
 await page.goto('http://127.0.0.1:4311/');await page.waitForFunction(()=>window.__readAudit?.scene);await page.addStyleTag({content:':root{--safe-area-inset-top:28px}'});if(mode==='forced')await page.locator('.orientation-toggle').click();await page.waitForTimeout(200);
 const click=async a=>{if(a.startsWith('tab-')&&!await page.locator(`[data-action="${a}"]:visible`).count())await page.locator('[data-action="open-studio"]:visible').click();if(a==='room-properties'&&!await page.locator('[data-action="room-properties"]:visible').count())await page.locator('[data-action="room-actions"]:visible').click();const modal=page.locator(`#modal[open] [data-action="${a}"]:visible`);await(await modal.count()?modal:page.locator(`[data-action="${a}"]:visible`)).first().click();await page.waitForTimeout(180);};
 const checks=[];
 if(mode!=='desktop'){
  const overlap=await page.evaluate(()=>{const w=innerWidth,areas=[{l:12,t:48,r:48,b:84},{l:w-48,t:48,r:w-12,b:84}];return [...document.querySelectorAll('button')].filter(b=>b.checkVisibility()).filter(b=>{const r=b.getBoundingClientRect();return areas.some(a=>r.left<a.r&&r.right>a.l&&r.top<a.b&&r.bottom>a.t)}).map(b=>b.dataset.action||b.className)});assert.deepEqual(overlap,[],'host button intersection');checks.push('host corner clearance');
 }
 const pt=await page.evaluate(async()=>{const s=window.__readAudit.scene,{viewportRect}=await import('./src/orientation.js'),r=viewportRect(s.renderer.domElement),root=document.querySelector('#app').getBoundingClientRect(),forced=document.body.classList.contains('forced-landscape');for(let y=r.top+10;y<r.top+r.height-10;y+=4)for(let x=r.left+10;x<r.left+r.width-10;x+=4){const px=forced?root.right-y:x,py=forced?root.top+x:y;if(document.elementFromPoint(px,py)!==s.renderer.domElement)continue;const h=s.hit({clientX:x,clientY:y,pointerType:'touch'});if(h?.object.userData.kind==='opening')return{x:px,y:py};}return null;});
 assert.ok(pt,'visible door target');await page.mouse.click(pt.x,pt.y);await page.waitForTimeout(100);
 const highlight=()=>page.evaluate(()=>!!window.__readAudit.selected?.openingId&&!!window.__readAudit.scene.doorPreview?.visible);
 assert.ok(await highlight(),'initial door highlight');await click('tab-styles');await page.locator('[data-action="style"]:visible').first().click();await page.waitForTimeout(100);assert.ok(await highlight(),'style rebuild lost highlight');
 const close=page.locator('[data-action="close-panel"]:visible');if(await close.count())await close.first().click();
 if(mode==='desktop'||mode==='forced')await click('undo');else{await click('mobile-menu');await click('undo');await click('close-modal');}
 assert.ok(await highlight(),'undo lost highlight');checks.push('door highlight survives style and undo');
 await click('tab-layouts');await click('blank');await click('room-properties');await page.locator('#room-form [name="w"]').fill('');await page.keyboard.press('Escape');assert.equal(await page.locator('#inspector').evaluate(e=>getComputedStyle(e).display),'none');await click('room-properties');assert.equal(await page.locator('#room-form [name="w"]').inputValue(),'');checks.push('Escape closes and preserves draft');
 await page.locator('#inspector [data-action="deselect"]:visible').first().click();await click(mode==='desktop'?'inventory':'mobile-menu');assert.ok(await page.locator('#modal').evaluate(e=>e.open));await click('close-modal');checks.push('invalid draft does not block modal');
 await click('room-properties');assert.equal(await page.locator('#room-form [name="w"]').inputValue(),'');await page.locator('#room-form [name="w"]').fill('6');if(mode==='desktop')await page.locator('#room-form button[type="submit"]').click();else await click('complete-settings');await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('roomish-project-15-v1')).plans[0].rooms[0].w),6);checks.push('explicit save commits draft');assert.deepEqual(errors,[]);
 const result={width,height,mode,checks,errors};results.push(result);console.log(JSON.stringify(result));await writeFile(new URL('fix-verification.json',import.meta.url),JSON.stringify(results,null,2));await ctx.close();
}}finally{await browser.close();}
