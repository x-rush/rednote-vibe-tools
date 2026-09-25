import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const c=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8')),e=require('../src/engine.js')(c);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[],errors=[];
const out=new URL('./screenshots-v5/',import.meta.url);await mkdir(out,{recursive:true});
async function click(p,a,extra=''){await p.locator('[data-action="'+a+'"]'+extra+':visible').first().click();}
const state=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),c.storageKey);
const cam=p=>p.locator('#garden-scene').evaluate(el=>({width:el.style.width,transform:el.style.transform}));
try{for(const [width,height] of [[375,844],[390,844],[430,844],[844,390],[1280,800]]){
 const ctx=await browser.newContext({viewport:{width,height}}),p=await ctx.newPage();p.on('pageerror',x=>errors.push(x.message));
 const seed=e.fresh(Date.now());seed.coins=100000;seed.xp=5000;seed.expansion=7;
 for(const [item,x,y] of [['bamboo',25,40],['pavilion',65,75],['orchid',45,80]])assert.ok(e.act(seed,{type:'buy',item,area:0,x,y},seed.last).ok);
 await p.addInitScript(({seed,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{seed,key:c.storageKey});await p.goto('http://127.0.0.1:4327/');
 await p.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','24px');for(const side of ['left','right']){const el=document.createElement('div');el.className='host-test';el.style.cssText='position:fixed;top:24px;'+side+':8px;width:64px;height:44px;background:#2226;z-index:9999;';document.body.appendChild(el);}});
 assert.equal(Math.round((await p.locator('#garden-viewport').boundingBox()).height),height);results.push(width+' full canvas');
 const before=await cam(p);await click(p,'shop');await click(p,'drawerSize');await p.screenshot({path:fileURLToPath(new URL(width+'-drawer.png',out))});await click(p,'close');assert.deepEqual(await cam(p),before);results.push(width+' drawer preserves camera');
 await click(p,'objects');await click(p,'selectFromList','[data-uid="1"]');await click(p,'move');const beforeEdit=await cam(p);await click(p,'details');await click(p,'variant','[data-variant="2"]');await click(p,'visualSize','[data-size="2"]');assert.deepEqual(await cam(p),beforeEdit);await p.screenshot({path:fileURLToPath(new URL(width+'-edit.png',out))});await click(p,'confirmPlace');assert.equal((await state(p)).objects[0].variant,2);await click(p,'undo');assert.equal((await state(p)).objects[0].variant||0,0);await click(p,'redo');assert.equal((await state(p)).objects[0].variant,2);assert.equal((await state(p)).coins,seed.coins);results.push(width+' appearance undo redo without money rollback');
 await click(p,'view');assert.equal(await p.locator('.dock').isVisible(),false);await p.screenshot({path:fileURLToPath(new URL(width+'-garden.png',out))});await click(p,'view');results.push(width+' preview and return');
 await click(p,'home');await click(p,'manage');await p.locator('.growth-more summary').click();await click(p,'ground');await click(p,'groundTool','[data-id="path"]');
 const start={x:width*.42,y:height*.34},end={x:width*.62,y:height*.46};await p.mouse.move(start.x,start.y);await p.mouse.down();await p.mouse.move(end.x,end.y,{steps:12});await p.mouse.up();
 assert.equal((await state(p)).ground.length,1);assert.equal((await state(p)).coins,seed.coins);await click(p,'groundDone');await click(p,'undo');assert.equal((await state(p)).ground.length,0);await click(p,'redo');assert.equal((await state(p)).ground.length,1);results.push(width+' ground drawing persists and undo is free');
 await click(p,'view');await p.screenshot({path:fileURLToPath(new URL(width+'-paths.png',out))});await click(p,'view');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),true);
 await p.reload();assert.equal((await state(p)).objects[0].variant,2);results.push(width+' restore and no page scroll');await ctx.close();
}assert.deepEqual(errors,[]);await writeFile(new URL('./editor-results-v5.json',import.meta.url),JSON.stringify({passed:results.length,results,errors},null,2));console.log({passed:results.length,errors});}finally{await browser.close();}
