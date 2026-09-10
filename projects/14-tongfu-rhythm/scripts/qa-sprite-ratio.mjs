import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();const report=[];
await mkdir('test-results',{recursive:true});
for(const width of [375,390,430,1000]){
 await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:4313');await page.waitForSelector('.sprite');
 await page.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','32px'));
 const home=await page.locator('.roster .sprite').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.width/r.height;}));
 home.forEach(r=>assert.ok(Math.abs(r-.5)<.001));
 await page.screenshot({path:`test-results/proportion-home-${width}.png`,fullPage:true});
 await page.click('#practice');await page.waitForSelector('#fighter-sprite');
 const game=await page.locator('#fighter-sprite').evaluate(e=>{const r=e.getBoundingClientRect();return r.width/r.height;});assert.ok(Math.abs(game-.5)<.001);
 // Verify the same result markup rules without waiting through another song.
 const result=await page.evaluate(()=>{const host=document.createElement('div');host.className='result-roster';host.style.width='320px';host.innerHTML='<div class="sprite"></div>'.repeat(4);document.querySelector('.shell').append(host);const ratios=[...host.children].map(e=>{const r=e.getBoundingClientRect();return r.width/r.height;});host.remove();return ratios;});result.forEach(r=>assert.ok(Math.abs(r-.5)<.001));
 report.push({width,home,game,result});
 if(width===390){await page.waitForFunction(()=>document.querySelector('#countdown').hidden);await page.screenshot({path:'test-results/proportion-game-390.png'});}
}
await writeFile('test-results/proportion-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
