import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),out=new URL('./',import.meta.url),results=[];
try{for(const mode of ['portrait','forced','natural'])for(let attempt=1;attempt<=2;attempt++){
 const context=await browser.newContext({viewport:mode==='natural'?{width:844,height:390}:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(3000);
 await page.route('**/src/app.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__readAudit={get scene(){return scene},get plan(){return plan},get selected(){return selected}};'});});
 const click=async a=>{if(a.startsWith('tab-')&&!await page.locator(`[data-action="${a}"]:visible`).count())await page.locator('[data-action="open-studio"]:visible').click();await page.locator(`[data-action="${a}"]:visible`).first().tap();await page.waitForTimeout(120);};
 const record=async(name,pass,data={})=>{const row={mode,attempt,name,pass,...data,errors:[...errors]};if(!pass){row.screenshot=`native-${mode}-${attempt}-${name}.png`;await page.screenshot({path:fileURLToPath(new URL(row.screenshot,out))});}results.push(row);console.log(JSON.stringify(row));await writeFile(new URL('native.json',out),JSON.stringify(results,null,2));};
 try{
  await page.goto('http://127.0.0.1:4311/');await page.waitForFunction(()=>window.__readAudit?.scene);if(mode==='forced')await page.locator('.orientation-toggle').tap();await page.addStyleTag({content:':root{--safe-area-inset-top:28px}'});await page.waitForTimeout(300);
  const state=()=>page.evaluate(()=>JSON.stringify(window.__readAudit.plan.openings));
  const target=async kind=>page.evaluate(async kind=>{const s=window.__readAudit.scene,{viewportRect}=await import('./src/orientation.js'),r=viewportRect(s.renderer.domElement),root=document.querySelector('#app').getBoundingClientRect(),forced=document.body.classList.contains('forced-landscape');for(let y=r.top+12;y<r.top+r.height-12;y+=5)for(let x=r.left+12;x<r.left+r.width-12;x+=5){const px=forced?root.right-y:x,py=forced?root.top+x:y;if(document.elementFromPoint(px,py)!==s.renderer.domElement)continue;const hit=s.hit({clientX:x,clientY:y,pointerType:'touch'});if(hit?.object.userData.kind===kind)return{x:px,y:py,id:hit.object.userData.id};}return null;},kind);
  const drag=async(a,b)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:a.x,y:a.y}]});for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);};
  const door=await target('opening');if(!door)await record('door-hit',false,{reason:'No unobstructed door found'});else{const before=await state();await drag(door,{x:door.x+35,y:door.y+25});await record('unselected-door-orbit',before===await state());}
  await click('tab-layouts');await click('blank');await click('room-properties');await page.locator('#room-form [name="w"]').fill('6');await click('complete-settings');await page.waitForTimeout(300);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('roomish-project-15-v1')).plans[0].rooms[0].w);await record('real-layout-save',stored===6);
  await click('room-properties');await page.locator('#room-form [name="w"]').fill('');await page.locator('#inspector [data-action="deselect"]:visible').first().tap();const hidden=await page.locator('#inspector').evaluate(e=>getComputedStyle(e).display==='none');await click('room-properties');await record('real-close-reopen-draft',hidden&&await page.locator('#room-form [name="w"]').inputValue()==='');
  await page.locator('#inspector [data-action="deselect"]:visible').first().tap();await click('mobile-menu');const opened=await page.locator('#modal').evaluate(e=>e.open);await record('closed-draft-menu',opened,{toast:await page.locator('#toast').textContent()});
 }catch(e){await record('flow-error',false,{error:e.message});}await context.close();
}}finally{await browser.close();}
