import {chromium} from 'file:///C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out=new URL('./',import.meta.url),browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
const cases=['mobile-menu','inventory','plans','help','room-actions','item-actions','walk-rooms','manage-doors','add-room-shortcut','finish-tools','capture'];
for(const [w,h] of [[375,812],[390,844],[430,932]])for(const mode of ['portrait','natural','forced']){
 const p=await browser.newPage({viewport:mode==='natural'?{width:h,height:w}:{width:w,height:h},deviceScaleFactor:1});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4311/');await p.waitForTimeout(250);
 await p.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','20px'));
 if(mode==='forced')await p.locator('.orientation-toggle').click();
 await p.locator('[data-action="room"]').first().evaluate(e=>e.click());
 for(const action of cases){
  await p.evaluate(action=>{const d=document.querySelector('#modal');if(d.open)d.close();let el=document.querySelector('[data-action="'+action+'"]');if(el){el.click();return;}el=document.createElement('button');el.dataset.action=action;document.querySelector('#app').appendChild(el);el.click();el.remove();},action);
  try{await p.locator('#modal[open]').waitFor({timeout:5000});if(action==='capture')await p.locator('.export-preview').waitFor({timeout:5000});}catch{results.push({w,mode,action,error:'modal did not open'});continue;}
  const r=await p.evaluate(()=>{
   const d=document.querySelector('#modal'),c=d.querySelector('#modal-content'),x=d.querySelector('[data-action="close-modal"]'),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
   const b=rect(d),xr=rect(x),hit=document.elementFromPoint(xr.x+xr.w/2,xr.y+xr.h/2);
   return{title:d.querySelector('h2')?.textContent,box:b,closeVisible:!!hit&&(hit===x||x.contains(hit)),overflow:b.x<-.5||b.y<-.5||b.x+b.w>innerWidth+.5||b.y+b.h>innerHeight+.5,horizontalOverflow:d.scrollWidth>d.clientWidth+1,contentHeight:c.scrollHeight,dialogClientHeight:d.clientHeight,table:d.querySelector('.inventory-table')?{client:d.querySelector('.inventory-table').clientHeight,scroll:d.querySelector('.inventory-table').scrollHeight}:null};
  });
  if(w===390||r.overflow||!r.closeVisible)await p.screenshot({path:new URL(`${mode}-${w}-${action}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
  await p.locator('#modal [data-action="close-modal"]').click({timeout:2000}).catch(()=>{});
  r.closeWorks=await p.locator('#modal').evaluate(d=>!d.open);
  results.push({w,mode,action,...r});
 }
 console.log(JSON.stringify({w,mode,results:results.filter(r=>r.w===w&&r.mode===mode),errors}));await p.close();
}
await fs.writeFile(new URL('results.json',out),JSON.stringify(results,null,2));await browser.close();
