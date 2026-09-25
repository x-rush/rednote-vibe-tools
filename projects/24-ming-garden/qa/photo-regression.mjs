import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const c=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8'));
const engine=require('../src/engine.js')(c);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  for(const [width,height] of [[390,844],[844,390]]){
    const state=engine.fresh(Date.now());state.coins=100000;state.xp=5000;state.expansion=7;
    for(const [item,x,y] of [['bamboo',25,40],['pavilion',65,75],['orchid',45,80]])assert.ok(engine.act(state,{type:'buy',item,area:0,x,y},state.last).ok);
    state.ground=[{map:0,kind:'path',points:[[25,63],[35,66],[50,69]]}];
    const context=await browser.newContext({viewport:{width,height}});
    await context.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:c.storageKey,state});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4327/');
    await page.locator('.camera-bar [data-action="photo"]').click();
    await page.locator('.photo-preview img').waitFor();
    const data=await page.locator('.photo-preview img').getAttribute('src');
    assert.ok(data.startsWith('data:image/png;base64,'));
    const info=await page.locator('.photo-preview img').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,complete:img.complete}));
    assert.deepEqual(info,{width:1200,height:1200,complete:true});
    assert.deepEqual(errors,[]);
    if(width===390)await writeFile(new URL('./photo-composite.png',import.meta.url),Buffer.from(data.split(',')[1],'base64'));
    await page.screenshot({path:fileURLToPath(new URL('./photo-'+width+'.png',import.meta.url))});
    await page.locator('.sheet-footer [data-action="close"]').click();
    assert.equal(await page.locator('.photo-preview').count(),0);
    console.log(width+' photo composed and previewed');
    await context.close();
  }
}finally{await browser.close();}
