import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const content=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8'));
const engine=require('../src/engine.js')(content);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  for(const [width,height] of [[295,590],[375,844],[390,844],[430,844],[844,390]]){
    const context=await browser.newContext({viewport:{width,height}});
    const page=await context.newPage();
    const seed=engine.fresh(Date.now());seed.coins=2000;seed.xp=500;seed.bank=20;
    for(const item of ['orchid','bamboo']){const point=engine.suggest(seed,item,0,false);assert.ok(point);assert.equal(engine.act(seed,{type:'buy',item,...point},seed.last).ok,true);}seed.coins=2000;
    await page.addInitScript(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key:content.storageKey,seed});
    await page.goto('http://127.0.0.1:4327/');
    await page.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','24px'));
    await page.locator('[data-action="shop"]').first().click();
    const thumbRatios=await page.locator('.shop-card .sprite').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};}));
    assert.ok(thumbRatios.length>0);
    assert.ok(thumbRatios.every(r=>Math.abs(r.width-r.height)<1),width+' scenery thumbnails must keep square atlas cells');
    const clips=await page.evaluate(()=>[...document.querySelectorAll('clipPath[id^="plant-clip-"]')].map(el=>el.id));
    assert.ok(clips.length>=4);
    assert.equal(new Set(clips).size,clips.length,'each plant instance must have a unique clipping path');
    if(width===295||width===390){
      const png=await page.locator('.shop-card[data-item="bamboo"] .plant-sprite').screenshot();
      const colored=await page.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const data=context.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i+1]>data[i]+9&&data[i+1]>data[i+2]+8&&data[i+1]<225)count++;return count;},png.toString('base64'));
      assert.ok(colored>100,'bamboo thumbnail must render actual green plant pixels');
    }
    await page.locator('#modal-root [data-action="close"]').click();
    await page.locator('[data-action="manage"]').click();
    assert.equal(await page.locator('#sheet-title').innerText(),content.ui.manage);
    assert.ok(await page.locator('.growth-unlocks article').count()>=1);
    assert.ok(await page.locator('.growth-primary [data-action="collect"]').count());
    await page.locator('.growth-primary [data-action="collect"]').click();
    assert.ok((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).coins,content.storageKey))>=2020);
    assert.equal(await page.locator('#sheet-title').innerText(),content.ui.manage);
    await page.locator('.growth-unlocks [data-action="shopTier"]').click();
    assert.equal(await page.locator('#sheet-title').innerText(),content.ui.shop);
    await page.locator('#modal-root [data-action="close"]').click();
    await page.locator('[data-action="manage"]').click();
    await page.locator('.growth-more summary').click();
    const objects=page.locator('.growth-more [data-action="objects"]');
    await objects.evaluate(el=>el.scrollIntoView({block:'center'}));
    await objects.click();
    assert.equal(await page.locator('#sheet-title').innerText(),content.ui.gardenList);
    await page.locator('#modal-root [data-action="close"]').click();
    await page.locator('[data-action="moments"]').click();
    assert.equal(await page.locator('#sheet-title').innerText(),content.ui.momentHub);
    assert.ok(await page.locator('.moment-feature').count());
    await page.locator('.moment-paths [data-action="quests"]').click();
    assert.equal(await page.locator('#sheet-title').innerText(),content.ui.quests);
    console.log(width+' growth, advanced tools and story paths passed');
    await context.close();
  }
}finally{await browser.close();}
