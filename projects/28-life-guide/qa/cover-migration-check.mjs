import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const content=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8')),checks=[];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  for(const width of [375,390,430])for(const middle of [false,true]){
    const context=await browser.newContext({viewport:{width,height:844}});
    await context.addInitScript(({width,middle,commit})=>{
      if(!localStorage.getItem('life-guide:v1'))localStorage.setItem('life-guide:v1',JSON.stringify({schemaVersion:1,contentVersion:commit,chapterId:'6',readerView:'reading',reading:{entryId:middle?'6-2':'6-1',readerMode:'chapter-scroll',textOffset:middle?120:0,offsetWithinEntry:0,scrollY:middle?1400:70,scrollLayout:width+':16px:151:reading'}}));
      document.addEventListener('DOMContentLoaded',()=>document.documentElement.style.setProperty('--safe-area-inset-top','24px'));
    },{width,middle,commit:content.meta.sourceCommit});
    let p=await context.newPage();await p.goto('http://127.0.0.1:4328');await p.waitForFunction(()=>document.querySelector('#reader-location').textContent.includes('已读'));await p.waitForTimeout(200);
    const position=await p.evaluate(()=>({y:scrollY,entry:JSON.parse(localStorage.getItem('life-guide:v1')).reading.entryId,banner:getComputedStyle(document.querySelector('.hero')).display,chapter:document.querySelector('.chapter-title').getBoundingClientRect().top,toolbar:document.querySelector('#toolbar').getBoundingClientRect().bottom}));
    assert.notEqual(position.banner,'none');assert.ok(position.y>200,'old compact scroll offset must be migrated');assert.equal(position.entry,middle?'6-2':'6-1');if(!middle)assert.ok(Math.abs(position.chapter-position.toolbar-12)<=1,'old chapter-start checkpoint restores title');
    await p.close();p=await context.newPage();await p.goto('http://127.0.0.1:4328');await p.waitForFunction(()=>document.querySelector('#reader-location').textContent.includes('已读'));await p.waitForTimeout(200);assert.ok(Math.abs(await p.evaluate(()=>scrollY)-position.y)<=2,'reentry reading position');
    await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(200);assert.ok(await p.locator('.hero').evaluate(e=>e.getBoundingClientRect().top>=80&&e.offsetHeight>=130));assert.equal(await p.locator('.hero-cat').isVisible(),true);checks.push({width,middle,migratedY:position.y,reentryRestored:true,scrollUpShowsCover:true});await context.close();
  }
  await writeFile(new URL('./output/cover-migration-report.json',import.meta.url),JSON.stringify({version:'1.3.3',checks},null,2));console.log('PASS '+checks.length+' compact-layout migrations and reading reentries');
}finally{await browser.close();}
