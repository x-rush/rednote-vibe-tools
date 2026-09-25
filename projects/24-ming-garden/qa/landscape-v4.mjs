import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),c=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8')),e=require('../src/engine.js')(c);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[],errors=[],out=new URL('./screenshots-v4/',import.meta.url);await mkdir(out,{recursive:true});
import {click} from './editor-actions.mjs';
async function state(p){return p.evaluate(key=>JSON.parse(localStorage.getItem(key)),c.storageKey);}
async function select(p,uid){await click(p,'objects');await click(p,'selectFromList','[data-uid="'+uid+'"]');}
try{
for(const width of [375,390,430]){
 const ctx=await browser.newContext({viewport:{width,height:844}}),p=await ctx.newPage();p.on('pageerror',x=>errors.push(x.message));
 const seed=e.fresh(Date.now());seed.xp=5000;seed.expansion=7;seed.coins=100000;
 for(const [item,x,y] of [['bamboo',25,40],['pavilion',65,75],['orchid',45,80]])assert.equal(e.act(seed,{type:'buy',item,area:0,x,y},seed.last).ok,true);
 await p.addInitScript(({seed,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{seed,key:c.storageKey});await p.goto('http://127.0.0.1:4327/');
 await p.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','24px');document.documentElement.style.setProperty('--safe-area-inset-bottom','16px');});
 const bamboo=await p.locator('.placed[data-uid="1"]').boundingBox(),orchid=await p.locator('.placed[data-uid="3"]').boundingBox();assert.ok(bamboo.height>orchid.height*2.5);results.push(width+' bamboo taller than orchid');
 await select(p,1);await click(p,'move');assert.equal(await p.locator('[data-action="variant"]').count(),3);await click(p,'variant','[data-variant="2"]');await click(p,'visualSize','[data-size="2"]');assert.ok((await p.locator('.ghost').boundingBox()).width>bamboo.width*1.5);results.push(width+' separate silhouettes and scaled preview');
 await p.screenshot({path:fileURLToPath(new URL(width+'-bamboo-edit.png',out))});const money=(await state(p)).coins;await click(p,'confirmPlace');assert.equal((await state(p)).objects[0].variant,2);assert.equal((await state(p)).objects[0].size,2);assert.equal((await state(p)).coins,money);results.push(width+' appearance commits without charge');
 await p.reload();assert.equal((await state(p)).objects[0].variant,2);assert.equal((await state(p)).objects[0].size,2);await select(p,1);await click(p,'move');await click(p,'variant','[data-variant="0"]');await click(p,'cancel');assert.equal((await state(p)).objects[0].variant,2);results.push(width+' restore and cancel appearance');
 await click(p,'plans');assert.equal(await p.locator('#modal-root [data-action="plan"]').count(),8);await click(p,'plan','[data-id="first"]');assert.match(await p.locator('.plan-panel').textContent(),/待添置/);await click(p,'planItem','[data-item="lantern"]');await click(p,'buyMode');await click(p,'confirmPlace');assert.ok((await state(p)).combos.includes('first'));assert.match(await p.locator('.plan-panel').textContent(),/已成景/);results.push(width+' guided composition completes real combo');
 await click(p,'expand');assert.match(await p.locator('.expand-map').textContent(),/可自由摆放/);await click(p,'close');results.push(width+' capacity matches expanded world');
 await click(p,'home');await p.locator('.main-layout').evaluate(el=>el.scrollTop=0);await p.screenshot({path:fileURLToPath(new URL(width+'-garden.png',out))});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);results.push(width+' no horizontal page overflow');await ctx.close();
}
assert.deepEqual(errors,[]);await writeFile(new URL('./landscape-results-v4.json',import.meta.url),JSON.stringify({passed:results.length,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors}));
}finally{await browser.close();}
