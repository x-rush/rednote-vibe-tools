import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=user-gesture-required']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.fetch=()=>{throw Error('Network forbidden')};window.XMLHttpRequest=function(){throw Error('XHR forbidden')};});
await page.goto(pathToFileURL(process.cwd()+'/release/audio-probe/index.html').href);
for(const width of [375,390,430]){await page.setViewportSize({width,height:844});await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','32px');document.documentElement.style.setProperty('--safe-area-inset-bottom','20px')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert.ok((await page.locator('h1').boundingBox()).y>=32);await page.screenshot({path:`test-results/audio-probe-${width}.png`,fullPage:true});}
await page.click('#play');await page.waitForSelector('[data-state="playing"]');await page.waitForTimeout(400);await page.click('#pause');const paused=await page.locator('#clock').innerText();await page.waitForTimeout(300);assert.equal(await page.locator('#clock').innerText(),paused);await page.click('#play');await page.waitForSelector('[data-state="playing"]');await page.waitForTimeout(300);assert.notEqual(await page.locator('#clock').innerText(),paused);await page.click('#restart');await page.waitForSelector('[data-state="ended"]',{timeout:12000});assert.deepEqual(errors,[]);
const report={widths:[375,390,430],safeArea:{top:32,bottom:20},decode:true,pause:true,resume:true,restart:true,ended:true,errors,log:await page.locator('#log').innerText(),actualSoundHeard:false,xiaohongshuDeviceTested:false};
await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});await page.reload();await page.click('#play');await page.waitForSelector('[data-state="failed"]');report.unsupportedFallback=true;
await writeFile('test-results/audio-probe-report.json',JSON.stringify(report,null,2));console.log(report);await browser.close();
