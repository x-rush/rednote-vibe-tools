import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const touchContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const touch=await touchContext.newPage();
  await touch.goto('http://127.0.0.1:4327/');
  await touch.locator('[data-action="zoomIn"]').tap();
  assert.equal(await touch.locator('[data-action="zoomIn"]').evaluate(el=>getComputedStyle(el).outlineStyle),'none','touching a camera button must not leave a focus box');
  await touch.locator('[data-action="shop"]').first().tap();
  assert.equal(await touch.locator('#sheet-title').evaluate(el=>getComputedStyle(el).outlineStyle),'none','the announced drawer heading must not draw a focus box');
  await touch.locator('[data-action="tier"]').nth(1).tap();
  assert.equal(await touch.locator('#sheet-title').evaluate(el=>getComputedStyle(el).outlineStyle),'none','redrawing a drawer must not draw a heading box');
  await touch.locator('[data-action="drawerSize"]').tap();
  assert.equal(await touch.locator('#sheet-title').evaluate(el=>getComputedStyle(el).outlineStyle),'none','expanding a drawer must not draw a heading box');
  await touchContext.close();

  const keyboardContext=await browser.newContext({viewport:{width:390,height:844}});
  const keyboard=await keyboardContext.newPage();
  await keyboard.goto('http://127.0.0.1:4327/');
  let focus;
  for(let n=0;n<30;n++){
    await keyboard.keyboard.press('Tab');
    focus=await keyboard.evaluate(()=>({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle}));
    if(focus.tag==='BUTTON')break;
  }
  assert.equal(focus?.tag,'BUTTON','keyboard navigation must reach a button');
  assert.equal(focus.outline,'solid','keyboard focus must remain visible');
  await keyboardContext.close();
  console.log('PASS touch focus boxes hidden; keyboard focus visible');
}finally{await browser.close();}
