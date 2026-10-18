const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');const out='design/review-2026-10-18';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:4109/');await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','44px');Date.now=()=>727});await page.getByRole('button').first().click();
 await page.evaluate(()=>{const canvas=document.querySelector('canvas');let fiber=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];while(fiber&&!fiber.memoizedProps?.engine)fiber=fiber.return;window.__auditEngine=fiber?.memoizedProps.engine});
 const samples=[];let firstEngulf;let choiceCaptured=false;
 await page.mouse.move(195,720);await page.mouse.down();
 for(let i=0;i<40;i++){
  const sample=await page.evaluate(()=>{const e=window.__auditEngine;if(!e)return {error:'no engine'};const w=e.renderSnapshot();const p=w.entities.find(x=>x.id==='player');const visible=p?w.entities.filter(x=>x.id!==p.id&&Math.abs(x.position.x-p.position.x)<75&&Math.abs(x.position.y-p.position.y)<150):[];const edible=p?w.entities.filter(x=>x.id!==p.id&&x.status==='active'&&x.body.radius<p.body.radius).sort((a,b)=>Math.hypot(a.position.x-p.position.x,a.position.y-p.position.y)-Math.hypot(b.position.x-p.position.x,b.position.y-p.position.y)):[];const target=edible[0];return {hud:e.snapshot(),entities:w.entities.length,visibleCount:visible.length,nearestEdible:target?{distance:Math.hypot(target.position.x-p.position.x,target.position.y-p.position.y),dx:target.position.x-p.position.x,dy:target.position.y-p.position.y,role:target.role}:null,player:p?{radius:p.body.radius,position:p.position}:null,hasChoices:!!document.querySelector('.evolution-overlay')}});
  samples.push(sample);if(sample.hud?.engulfScore>0&&!firstEngulf)firstEngulf=sample.hud.elapsedMs;
  if(sample.hasChoices){await page.mouse.up();await page.screenshot({path:`${out}/390-mutation.png`});choiceCaptured=true;break}
  if(i===8||i===20)await page.screenshot({path:`${out}/390-playing-${i}.png`});
  if(sample.nearestEdible){const {dx,dy}=sample.nearestEdible;const d=Math.hypot(dx,dy)||1;await page.mouse.move(195+dx/d*65,720+dy/d*65)}
  await page.waitForTimeout(1100);
 }
 await page.mouse.up();await page.screenshot({path:`${out}/390-run-final.png`});
 fs.writeFileSync(`${out}/first-run.json`,JSON.stringify({seed:727,policy:'one finger steers toward nearest edible; no health, radius, enemy or time modifications',firstEngulfMs:firstEngulf,choiceCaptured,samples},null,2));console.log(JSON.stringify({firstEngulfMs:firstEngulf,choiceCaptured,last:samples.at(-1),samples:samples.length}));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
