import {pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const c=JSON.parse(await readFile('src/content/content.json','utf8'));
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:640},isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.fetch=()=>{throw Error('Unexpected network')};window.XMLHttpRequest=function(){throw Error('Unexpected network')};
 const A=window.AudioContext;window.starts=[];
 window.AudioContext=class extends A{createBufferSource(){const n=super.createBufferSource(),start=n.start.bind(n);n.start=(when,offset,...args)=>{window.starts.push({when,offset});return start(when,offset,...args)};return n;}};
});
await page.goto(pathToFileURL(process.cwd()+'/release/package/index.html').href);
await page.addStyleTag({content:'html,body{overflow:hidden!important}html{--safe-area-inset-top:32px;--safe-area-inset-bottom:20px}'});
for(const width of [375,390,430]){
 await page.setViewportSize({width,height:640});
 await page.locator('#verse-practice').tap();
 assert.equal(await page.locator('#verse-segment option').count(),8);
 const rect=await page.locator('dialog').boundingBox();assert.ok(rect.y>=32);assert.ok(rect.x>=0&&rect.x+rect.width<=width);
 await page.screenshot({path:`test-results/verse-flow-dialog-${width}.png`});
 await page.locator('[data-close]').tap();
}
const sections=[];
for(let i=0;i<c.verseFlow.practiceSegments.length;i++){
 const range=c.verseFlow.practiceSegments[i];
 await page.locator('#verse-practice').tap();await page.selectOption('#verse-segment',String(i));await page.locator('#verse-start').tap();
 await page.waitForSelector('#notes');assert.equal(await page.evaluate(()=>window.starts.at(-1).offset),range.start);
 assert.ok((await page.locator('.game-title').innerText()).includes(range.title));
 if(i===2){
  await page.waitForSelector('.result',{timeout:12000});await page.locator('#again').tap();await page.waitForSelector('#notes');
  assert.equal(await page.evaluate(()=>window.starts.at(-1).offset),range.start);
 }
 await page.locator('#pause').tap();await page.locator('#home').tap();sections.push(range.title);
}
assert.deepEqual(errors,[]);
await writeFile('test-results/verse-flow-browser-report.json',JSON.stringify({sections,retryKeepsSegment:true,widths:[375,390,430],safeArea:{top:32,bottom:20},networkBlocked:true,errors,humanListeningApproved:false},null,2));
console.log('All eight sections, repeated practice, responsive dialogs and offline playback passed');await browser.close();
