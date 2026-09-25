import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=new URL('../release/note-2026-09-21/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4326/');
 await page.evaluate(()=>localStorage.clear());await page.reload();
 await page.screenshot({path:fileURLToPath(new URL('02-home.png',out)),fullPage:true});
 await page.evaluate(()=>localStorage.setItem('spring-letter:v1',JSON.stringify({version:1,chapter:'agency',path:[],instant:true,music:false,voices:false})));
 await page.reload();await page.locator('[data-action=start]').click();
 for(let i=0;i<2;i++)await page.locator('[data-action=next-beat]').click();
 await page.locator('h1').evaluate(e=>e.focus());
 await page.screenshot({path:fileURLToPath(new URL('03-dialogue.png',out)),fullPage:true});
 while(await page.locator('[data-action=next-beat]').count())await page.locator('[data-action=next-beat]').click();
 await page.locator('h1').evaluate(e=>e.focus());
 await page.screenshot({path:fileURLToPath(new URL('04-choice.png',out)),fullPage:true});
 for(const id of ['confide','negotiate','both','plan','public','signal','finish','distance']){
 while(await page.locator('[data-action=next-beat]').count())await page.locator('[data-action=next-beat]').click();
 await page.locator('[data-action=choose][data-id="'+id+'"]').click();await page.waitForTimeout(190);
 }
 while(await page.locator('[data-action=next-epilogue]').count())await page.locator('[data-action=next-epilogue]').click();
 await page.locator('[data-action=capture]').click();await page.locator('.letter-card').screenshot({path:fileURLToPath(new URL('05-letter.png',out))});
 console.log('Captured four real game images');
}finally{await browser.close();}
