import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {root,publicContent} from '../tools.mjs';
import {createGame} from '../src/engine.mjs';
const require=createRequire(import.meta.url),modules=process.env.FLOWER_TOOL_MODULES;
const {chromium}=require(join(modules,'playwright')),JSZip=require(join(modules,'jszip'));
const manifest=JSON.parse(await readFile(join(root,'release/package-manifest.json'),'utf8'));
const zip=await JSZip.loadAsync(await readFile(join(root,'release',manifest.zip)));
assert.ok(zip.file('index.html'));
for(const file of manifest.files){const bytes=await zip.file(file.path).async('nodebuffer');assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
assert.equal(Object.values(zip.files).filter(f=>!f.dir).length,manifest.files.length);
const html=await zip.file('index.html').async('string');
assert.equal(/type="module"|onclick=|<base|<iframe/i.test(html),false);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const report={zip:manifest.zip,bytes:manifest.bytes,flows:[],layouts:[],errors:[],network:[],limitations:['Physical Chrome 61 / Android 8.1 and iOS WebView were not tested']};
const context=await browser.newContext({viewport:{width:390,height:844},offline:true});
await context.addInitScript(()=>{
  window.FLOWER_FORCE_LEGACY=true;
  Object.fromEntries=undefined;Array.prototype.at=undefined;window.structuredClone=undefined;
  window.fetch=()=>{throw Error('Network API must not be used');};
});
const page=await context.newPage();page.setDefaultTimeout(5000);
page.on('pageerror',e=>report.errors.push(e.message));
page.on('request',r=>{if(!r.url().startsWith('file:'))report.network.push(r.url());});
const c=await publicContent(),key='flower-werewolf-v1';
const click=(action)=>page.locator('[data-action="'+action+'"]').first().click();
try{
  await page.goto(pathToFileURL(join(root,'release/minitool/index.html')).href);await page.waitForSelector('.hero');
  for(const width of [375,390,430]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','24px');document.documentElement.style.setProperty('--safe-area-inset-bottom','20px');});
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,brandTop:document.querySelector('.brand').getBoundingClientRect().top}));
    assert.ok(layout.scroll<=width);assert.ok(layout.brandTop>=24);report.layouts.push(layout);
  }
  const seeds={};for(let seed=0;Object.keys(seeds).length<4;seed++){
    const s=createGame(seed,c.characters.map(x=>x.id),c.roleDeck);if(seeds[s.players[s.human].role]===undefined)seeds[s.players[s.human].role]=seed;
  }
  for(const [role,seed] of Object.entries(seeds)){
    const initial=createGame(seed,c.characters.map(x=>x.id),c.roleDeck);
    await page.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s:initial});
    await page.reload();await page.waitForSelector('.hero');await click('resume');await click('unlock');await click('reveal');await click('begin');
    const saved=await page.evaluate(k=>localStorage.getItem(k),key);
    await click('gallery');await page.locator('dialog [data-action="character"]').first().click();
    assert.equal(await page.locator('#character-quote').count(),0);
    assert.ok(await page.locator('.profile-notes').isVisible());
    assert.equal(await page.locator('.mobile-game-nav').isVisible(),false);
    assert.equal(await page.locator('a[target="_blank"]').count(),0);await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),saved);
    for(let step=0;step<120;step++){
      const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
      if(s.phase==='over')break;
      const alive=s.players[s.human].alive;
      if(s.phase==='night'){
        if(alive&&['wolf','seer'].includes(role))await click('select');await click('night');
      }else if(s.phase==='day'){
        if(alive){await click('select');await click('speak');}else await click('speak-skip');
      }else if(s.phase==='vote'){
        if(alive&&await page.locator('[data-action="select"]').count()){await click('select');await click('vote');}else await click('abstain');
      }else await click('next');
      assert.equal(await page.locator('#toast').textContent(),'');
    }
    const final=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert.equal(final.phase,'over');assert.equal(await page.locator('.reveal-player').count(),7);
    await page.waitForFunction(()=>document.querySelector('#score-canvas')?.dataset.ready==='true');
    assert.equal(await page.locator('[data-action="save-score"]').isDisabled(),true);
    await page.screenshot({path:join(root,'release/score-'+role+'.png'),fullPage:true});
    report.flows.push({role,seed,day:final.day,winner:final.winner});
  }
  await click('home');await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:join(root,'release/offline-preview-430.png'),fullPage:true,animations:'disabled'});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);
  await writeFile(join(root,'release/offline-check.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
