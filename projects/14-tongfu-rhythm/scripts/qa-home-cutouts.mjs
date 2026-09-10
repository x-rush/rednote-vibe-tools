import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();const errors=[],report=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
await mkdir('test-results',{recursive:true});
for(const width of [375,390,430]){
 await page.setViewportSize({width,height:844});await page.goto((process.env.QA_BASE_URL||'http://127.0.0.1:4313'));await page.waitForSelector('.cutout');
 await page.evaluate(async()=>{document.documentElement.style.setProperty('--safe-area-inset-top','32px');const c=await fetch('src/content/content.json').then(r=>r.json());await Promise.all(c.cast.filter(p=>p.homeMask).map(p=>new Promise((res,rej)=>{const im=new Image();im.onload=res;im.onerror=rej;im.src=p.homeMask;})));});
 const checks=await page.locator('.roster .sprite').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {cutout:e.classList.contains('cutout'),ratio:r.width/r.height,mask:s.maskImage,mode:s.maskMode,blend:s.mixBlendMode};}));
 assert.deepEqual(checks.map(c=>c.cutout),[true,true,true,true]);for(const c of checks){assert.ok(Math.abs(c.ratio-.5)<.001);assert.equal(c.mode,'luminance');assert.ok(c.mask.includes('-home-mask.png'));assert.equal(c.blend,'normal');}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
 await page.screenshot({path:`test-results/cutout-home-${width}.png`,fullPage:true});report.push({width,checks});
}
// A contrasting surface makes any remaining opaque background easy to inspect.
await page.evaluate(()=>{document.querySelector('.hero').style.height='610px';document.querySelector('.hero-copy').style.visibility='hidden';const roster=document.querySelector('.roster');roster.style.cssText='height:400px;bottom:40px;left:0;right:0;background:repeating-conic-gradient(#b8c9c5 0% 25%,#e9eee8 0% 50%) 0 0/24px 24px;';document.querySelectorAll('.roster-person').forEach((p,i)=>{p.style.display=[0,3].includes(i)?'block':'none';p.style.width='50%';p.style.transform='none';p.querySelector('.sprite').style.width='200px';});});
await page.screenshot({path:'test-results/cutout-edge-check.png',fullPage:true});
assert.deepEqual(errors,[]);await writeFile('test-results/cutout-report.json',JSON.stringify(report,null,2));console.log('Home cutouts, original proportions and mobile layouts passed.');await browser.close();
