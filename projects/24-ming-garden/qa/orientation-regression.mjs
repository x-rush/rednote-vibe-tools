import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors=[];
async function assertFullFrame(page,width,height){
  const frame=await page.locator('#screen-frame').boundingBox();
  assert.ok(frame&&Math.abs(frame.x)<1&&Math.abs(frame.y)<1&&Math.abs(frame.width-width)<1&&Math.abs(frame.height-height)<1,`frame fills ${width}x${height}: ${JSON.stringify(frame)}`);
}
try{
  for(const width of [375,390,430]){
    const page=await browser.newPage({viewport:{width,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4327/');
    await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','24px');document.documentElement.style.setProperty('--safe-area-inset-bottom','16px');});
    const button=page.locator('.camera-bar [data-action="orientation"]');
    assert.equal(await button.innerText(),'横屏');
    await button.click();
    assert.ok((await page.locator('body').getAttribute('class')).includes('sim-landscape'));
    await assertFullFrame(page,width,844);
    assert.equal(await button.innerText(),'竖屏');
    const initial=await page.locator('#garden-scene').evaluate(el=>el.style.transform);
    await page.mouse.move(width*.53,844*.67);
    await page.mouse.down();
    await page.mouse.move(width*.53,844*.52,{steps:10});
    await page.mouse.up();
    assert.notEqual(await page.locator('#garden-scene').evaluate(el=>el.style.transform),initial,'rotated scene can pan');
    await page.locator('.dock [data-action="shop"]').click();
    const list=page.locator('.sheet-content'),range=await list.evaluate(el=>el.scrollHeight-el.clientHeight);
    assert.ok(range>100,'shop has a scrollable list');
    const rect=await list.boundingBox();
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.mouse.wheel(0,160);
    await page.waitForTimeout(80);
    assert.ok(await list.evaluate(el=>el.scrollTop)>0,'rotated shop list scrolls');
    await list.evaluate(el=>{el.scrollTop=0;});
    const touch=await page.context().newCDPSession(page),x=rect.x+20,y=rect.y+rect.height/2;
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let k=1;k<=6;k++){await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+k*17,y}]});await page.waitForTimeout(20);}
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(await list.evaluate(el=>el.scrollTop)>50,'rotated shop list scrolls with a finger swipe');
    await page.locator('.sheet [data-action="close"]').click();
    await button.click();
    assert.equal(await button.innerText(),'横屏');
    assert.equal(await page.locator('body').getAttribute('class'),'');
    await assertFullFrame(page,width,844);
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:844,height:390}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4327/');
  const button=page.locator('.camera-bar [data-action="orientation"]');
  assert.equal(await button.innerText(),'竖屏');
  await button.click();
  assert.ok((await page.locator('body').getAttribute('class')).includes('sim-portrait'));
  await assertFullFrame(page,844,390);
  assert.equal(await button.innerText(),'横屏');
  await button.click();
  assert.equal(await page.locator('body').getAttribute('class'),'');
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('.app-shell').classList.contains('screen-portrait'));
  assert.ok((await page.locator('.app-shell').getAttribute('class')).includes('screen-portrait'));
  assert.equal(await button.innerText(),'横屏');
  assert.deepEqual(errors,[]);
  console.log('PASS manual rotation, pan, drawer scroll, reverse rotation, and physical resize at 375/390/430/844');
}finally{await browser.close();}
