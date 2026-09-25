import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const c=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8')),e=require('../src/engine.js')(c),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[],errors=[];
const out=new URL('./screenshots-v3/',import.meta.url);await mkdir(out,{recursive:true});
async function camera(page){return page.locator('#garden-scene').evaluate(el=>({width:el.getBoundingClientRect().width,transform:el.style.transform}));}
async function state(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),c.storageKey);}
async function drag(page,from,to){await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();}
async function spot(page,x,y,area=0){return page.locator('#garden-scene').evaluate((el,p)=>{const r=el.getBoundingClientRect();return {x:r.left+(p.x+p.area%2*100)/200*r.width,y:r.top+(p.top+(p.y+Math.floor(p.area/2)*100)*p.band/100)/100*r.height};},{x,y,area,top:c.layout.world.top,band:c.layout.world.band});}
try{
for(const width of [375,390,430]){
 const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:true}),page=await ctx.newPage();page.on('pageerror',x=>errors.push(x.message));
 const seed=e.fresh(Date.now());seed.xp=5000;seed.coins=100000;seed.expansion=7;assert.equal(e.act(seed,{type:'buy',item:'library',area:0,x:35,y:60},seed.last).ok,true);assert.equal(e.act(seed,{type:'buy',item:'orchid',area:3,x:40,y:65},seed.last).ok,true);
 await page.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:c.storageKey,seed});await page.goto('http://127.0.0.1:4327/');
 assert.equal(await page.locator('.placed').count(),2);results.push(width+' simultaneous districts');
 await page.locator('[data-action="overview"]').click();const initial=await camera(page);await page.locator('[data-action="zoomIn"]').click();assert.ok((await camera(page)).width>initial.width);await page.locator('[data-action="overview"]').click();assert.equal((await camera(page)).width,initial.width);results.push(width+' zoom and overview');
 await page.locator('[data-action="locate"]').click();const before=await camera(page),v=await page.locator('#garden-viewport').boundingBox();await drag(page,{x:v.x+v.width*.8,y:v.y+v.height*.7},{x:v.x+v.width*.6,y:v.y+v.height*.55});assert.notEqual((await camera(page)).transform,before.transform);assert.equal(await page.locator('.ghost').count(),0);results.push(width+' pan without accidental selection');
 await page.locator('[data-action="locate"]').click();await page.locator('[data-action="objects"]:visible').click();await page.locator('[data-action="selectFromList"][data-uid="1"]').click();const target=await spot(page,65,65),b=await page.locator('.placed[data-uid="1"]').boundingBox();const original=(await state(page)).objects[0];await drag(page,{x:b.x+b.width/2,y:b.y+b.height*.6},target);
 assert.equal(await page.locator('.ghost').count(),1);assert.deepEqual((await state(page)).objects[0],original);assert.equal(await page.locator('[data-action="confirmPlace"]').isDisabled(),false);await page.locator('[data-action="confirmPlace"]').click();const moved=(await state(page)).objects[0];assert.ok(Math.abs(moved.x-65)<1&&Math.abs(moved.y-65)<1);assert.equal(moved.level,original.level);assert.equal((await state(page)).coins,seed.coins);results.push(width+' large building drag commits only on confirmation');
 await page.locator('[data-action="move"]').click();await page.locator('[data-action="overview"]').click();const invalid=await spot(page,2,50);const b2=await page.locator('.ghost').boundingBox();await drag(page,{x:b2.x+b2.width/2,y:b2.y+b2.height*.7},invalid);assert.equal(await page.locator('[data-action="confirmPlace"]').isDisabled(),true);await page.locator('[data-action="cancel"]').click();assert.deepEqual((await state(page)).objects[0],moved);results.push(width+' invalid drag and cancellation preserve placement');
 await page.locator('[data-action="overview"]').click();const client=await ctx.newCDPSession(page);await page.locator('#garden-viewport').scrollIntoViewIfNeeded();const vr=await page.locator('#garden-viewport').boundingBox(),cx=vr.x+vr.width/2,cy=vr.y+vr.height/2;
 const touch=(type,d)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:cx-d,y:cy,id:1},{x:cx+d,y:cy,id:2}]});await touch('touchStart',30);await touch('touchMove',75);await touch('touchEnd',0);assert.ok((await camera(page)).width>initial.width*1.5);assert.deepEqual((await state(page)).objects[0],moved);results.push(width+' native two finger pinch');
 await page.locator('[data-action="overview"]').click();await page.locator('[data-action="zoomOut"]').click();assert.equal((await camera(page)).width,initial.width);for(let i=0;i<9;i++)await page.locator('[data-action="zoomIn"]').click();assert.ok((await camera(page)).width<=initial.width*6+1);results.push(width+' zoom limits');
 await page.locator('[data-action="locate"]').click();await page.screenshot({path:fileURLToPath(new URL(width+'-large-building.png',out))});
 await page.reload();assert.deepEqual((await state(page)).objects[0],moved);results.push(width+' drag survives reload');
 await page.locator('[data-action="objects"]:visible').click();await page.locator('[data-action="selectFromList"][data-uid="1"]').click();await page.locator('[data-action="overview"]').click();await page.locator('#garden-viewport').scrollIntoViewIfNeeded();const obj=await page.locator('.placed[data-uid="1"]').boundingBox(),dest=await spot(page,75,25,3);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:obj.x+obj.width/2,y:obj.y+obj.height*.6,id:3}]});
 for(let step=1;step<=8;step++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:obj.x+obj.width/2+(dest.x-obj.x-obj.width/2)*step/8,y:obj.y+obj.height*.6+(dest.y-obj.y-obj.height*.6)*step/8,id:3}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.locator('[data-action="confirmPlace"]').isDisabled(),false);await page.locator('[data-action="confirmPlace"]').click();assert.equal((await state(page)).objects[0].pos,36);results.push(width+' native touch drag across districts');
 await ctx.close();
}
assert.deepEqual(errors,[]);await writeFile(new URL('./camera-results.json',import.meta.url),JSON.stringify({passed:results.length,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors}));
}finally{await browser.close();}
