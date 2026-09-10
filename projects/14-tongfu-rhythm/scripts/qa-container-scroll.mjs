import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:640},isMobile:true,hasTouch:true});
const page=await context.newPage();const cdp=await context.newCDPSession(page);const results=[];
async function swipe(x,y,end){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(end-y)*i/12}]});await page.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);}
for(const width of [375,390,430]){
 await page.setViewportSize({width,height:640});await page.goto(pathToFileURL(process.cwd()+'/release/package/index.html').href);
 await page.addStyleTag({content:'html,body{height:100%;overflow:hidden!important}html{--safe-area-inset-top:32px;--safe-area-inset-bottom:20px}'});
 await swipe(width/2,570,160);await swipe(width/2,570,160);
 const row=await page.evaluate(()=>({scroll:document.querySelector('.home').scrollTop,bodyScroll:window.scrollY,buttonBottom:document.querySelector('#rap-practice').getBoundingClientRect().bottom,viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}));results.push({width,...row});
 await page.screenshot({path:`test-results/container-scroll-${process.env.BEFORE?'before':'after'}-${width}.png`,fullPage:true});
 if(!process.env.BEFORE){assert.ok(row.scroll>100);assert.ok(row.buttonBottom<=row.viewport-20);assert.equal(row.overflow,false);await page.locator('#rap-practice').tap();await page.waitForSelector('#notes');assert.ok((await page.locator('.lane-key').first().boundingBox()).y<600);await page.locator('#pause').tap();await page.locator('#pause-settings').tap();const d=await page.locator('dialog').boundingBox();await swipe(width/2,Math.min(d.y+d.height-30,590),Math.max(d.y+50,130));assert.ok(await page.locator('dialog').evaluate(e=>e.scrollTop)>0);await page.locator('#reset').tap();assert.equal(await page.locator('dialog').count(),1);}
}
await writeFile(`test-results/container-scroll-${process.env.BEFORE?'before':'after'}.json`,JSON.stringify(results,null,2));console.log(results);await browser.close();
