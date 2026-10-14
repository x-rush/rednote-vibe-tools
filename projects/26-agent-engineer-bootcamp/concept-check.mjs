import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('qa/concept-final',{recursive:true});
const checks=[],errors=[];
async function click(p,a,v){await p.locator(`[data-action="${a}"]${v===undefined?'':`[data-value="${v}"]`}`).first().click();}
async function inspect(p,name){
  await p.locator('img').evaluateAll(async images=>{await Promise.all(images.map(i=>i.decode()));});
  await p.evaluate(()=>document.getAnimations().forEach(a=>{if(a.effect.getTiming().iterations!==Infinity)a.finish();}));
  const result=await p.evaluate(()=>{
    const pane=document.querySelector('.pane'),pr=pane.getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();
    const visibleArt=[...pane.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return i.naturalWidth>0&&r.width>=40&&r.height>=40&&r.top>=pr.top&&r.bottom<=pr.bottom&&getComputedStyle(i).visibility!=='hidden';}).length;
    const overlap=[...document.querySelectorAll('button,input,textarea,select')].filter(e=>{const r=e.getBoundingClientRect(),top=e.closest('.pane')?Math.max(r.top,pr.top):r.top,bottom=e.closest('.pane')?Math.min(r.bottom,pr.bottom):r.bottom;return bottom>top&&top<74&&(r.left<78||r.right>innerWidth-78);}).length;
    return {visibleArt,overflow:pane.scrollWidth>pane.clientWidth+1,hostOverlap:overlap,navSafe:nav.bottom<=innerHeight-16};
  });
  assert.ok(result.visibleArt>0,name+' has actual first-screen illustration');
  assert.equal(result.overflow,false,name+' no overflow');assert.equal(result.hostOverlap,0,name+' host clearance');assert.equal(result.navSafe,true,name+' bottom safe area');
  await p.screenshot({path:`qa/concept-final/${name}.png`});checks.push(name);
}
try{
for(const width of [375,390,430]){
 const context=await browser.newContext({viewport:{width,height:844}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4261');await p.addStyleTag({content:':root{--safe-area-inset-top:24px;--safe-area-inset-bottom:16px}'});
 await inspect(p,`home-${width}`);
 assert.ok(await p.locator('.explore-list').evaluate(el=>{const nav=document.querySelector('.bottom-nav').getBoundingClientRect();return [...el.querySelectorAll('button')].every(e=>e.getBoundingClientRect().bottom<=nav.top);}),`both home exploration entries visible at ${width}`);
 await p.locator('.bottom-nav [data-value="1"]').click();await inspect(p,`course-${width}`);
 await click(p,'techList');await inspect(p,`tech-${width}`);
 await p.locator('.bottom-nav [data-value="3"]').click();await inspect(p,`my-${width}`);
 await p.locator('.bottom-nav [data-value="1"]').click();await click(p,'foundations');await click(p,'node','A01');await inspect(p,`lesson-${width}`);
 await click(p,'nodeQuiz','A01');await inspect(p,`question-${width}`);await context.close();
}
assert.equal(errors.length,0);fs.writeFileSync('concept-results.json',JSON.stringify({date:'2026-10-14',checks,errors},null,2));console.log(`${checks.length} concept-alignment screen checks passed; illustrations visible on each main screen, both home exploration entries visible`);
}finally{await browser.close();}
