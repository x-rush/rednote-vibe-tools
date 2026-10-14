import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const c=JSON.parse(fs.readFileSync('src/content/content.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[],remote=[];
fs.mkdirSync('qa/methods',{recursive:true});
async function click(p,a,v){await p.locator(`[data-action="${a}"]${v===undefined?'':`[data-value="${v}"]`}`).first().click();}
async function state(p){return p.evaluate(()=>JSON.parse(localStorage.getItem('agent-engineer-lab-dev-1.3')));}
async function geometry(p,name){const r=await p.evaluate(()=>{const pane=document.querySelector('.pane'),pr=pane.getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();return {overflow:pane.scrollWidth>pane.clientWidth+1,host:[...document.querySelectorAll('button,input,textarea,select')].filter(e=>{const r=e.getBoundingClientRect(),top=e.closest('.pane')?Math.max(r.top,pr.top):r.top,bottom=e.closest('.pane')?Math.min(r.bottom,pr.bottom):r.bottom;return bottom>top&&top<74&&(r.left<78||r.right>innerWidth-78);}).length,nav:nav.bottom<=innerHeight-16};});assert.deepEqual(r,{overflow:false,host:0,nav:true},name);checks.push(name);}
async function shot(p,name){await p.locator('img').evaluateAll(async es=>Promise.all(es.map(e=>e.decode().catch(()=>{}))));await p.evaluate(()=>document.getAnimations().forEach(a=>{if(a.effect.getTiming().iterations!==Infinity)a.finish();}));await p.screenshot({path:`qa/methods/${name}.png`});}
try{
for(const width of [375,390,430]){
 const context=await browser.newContext({viewport:{width,height:844}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4261'))remote.push(r.url());});await p.goto('http://127.0.0.1:4261');await p.addStyleTag({content:':root{--safe-area-inset-top:24px;--safe-area-inset-bottom:16px}'});
 assert.equal(await p.locator('.ticket-action').getAttribute('data-action'),'methodDetail');await geometry(p,width+' method home');if(width===390)await shot(p,'home-390');
 await click(p,'tab','1');assert.equal(await p.locator('[data-action=methodDetail]').count(),4);await geometry(p,width+' main method route');if(width===390)await shot(p,'courses-390');
 for(const m of c.learning.items){await click(p,'methodDetail',m.id);await click(p,'methodRead',m.id);
  for(let section=0;section<5;section++){await click(p,'methodSection',String(section));await geometry(p,`${width} ${m.id} section ${section}`);if(section===0)assert.equal(await p.locator('.method-diagram').count(),1);if(section===3)assert.equal(await p.locator('.card').count(),m.faq.length+1);if(section===4)assert.equal(await p.locator('.reading-guide').count(),m.readings.length);}
  await click(p,'methodSection','2');for(let i=0;i<m.experiment.steps.length;i++){const step=m.experiment.steps[i];await click(p,'methodPick',String((step.answer+1)%3));assert.equal(await p.locator('[data-action=methodNext]').isDisabled(),true);await click(p,'methodPick',String(step.answer));if(width===390&&m.id==='P01'&&i===0)await shot(p,'experiment-390');await click(p,'methodNext');}
  assert.equal((await state(p)).methodRuns[m.id].done,true);assert.equal((await state(p)).methodRuns[m.id].choices.length,m.experiment.steps.length);await geometry(p,width+' '+m.id+' completed experiment');await click(p,'methodBack');
 }
 const s=await state(p);assert.equal(s.contentVersion,'1.3.0');assert.equal(s.methodReads.length,4);assert.equal(Object.keys(s.answers).length,0);assert.equal(s.reads.length,0);checks.push(width+' method progress independent from foundations');
 for(const id of c.learning.featuredFrameworkIds){await click(p,'techDetail',id);await geometry(p,width+' framework '+id);await click(p,'tab','1');}
 await click(p,'foundations');assert.equal(await p.locator('#courseSearch').count(),1);await click(p,'node','A01');await geometry(p,width+' foundation reference retained');await click(p,'tab','3');if(width===390)await shot(p,'my-390');await click(p,'myView','records');assert.equal(await p.locator('.record-row').count(),8);await click(p,'myBack');await click(p,'myView','backup');const backup=await p.locator('#exportState').inputValue();await p.locator('#restoreState').fill(backup);await click(p,'restorePreview');assert.ok((await p.locator('.restore-preview').innerText()).includes('模式：已学4项'));await click(p,'restoreConfirm');await click(p,'dismiss');await p.reload();await click(p,'tab','1');await click(p,'methodDetail','P03');await click(p,'methodSection','2');assert.equal(await p.locator('[data-action=methodReset]').count(),1);checks.push(width+' method backup restore and reload');await context.close();
}
assert.equal(errors.length,0);assert.equal(remote.length,0);fs.writeFileSync('method-browser-results.json',JSON.stringify({date:'2026-10-14',checks,errors,remote},null,2));console.log(`${checks.length} method route / experiment / framework / migration checks passed`);
}finally{await browser.close();}
