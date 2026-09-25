import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report=[],errors=[],base='http://127.0.0.1:4326/',key='spring-letter:v1';
async function seeded(page,path,chapter='agency',beat=0){
 await page.goto(base);await page.evaluate(({key,path,chapter,beat})=>localStorage.setItem(key,JSON.stringify({version:1,path,chapter,beat,read:[],artwork:[],unlocked:[],seen:[]})),{key,path,chapter,beat});await page.reload();await page.locator('[data-action=start],[data-action=continue]').click();
}
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
 await seeded(page,[]);
 await page.locator('[data-action=skip-read]').click();assert.equal(await page.locator('.beat-count').first().innerText(),'1 / 11');
 await page.locator('.dialogue').click();await page.locator('.dialogue').click();
 const spoken=await page.locator('.dialogue-text').innerText();
 await page.locator('[data-action=prev-beat]').click();await page.locator('[data-action=skip-read]').click();assert.equal(await page.locator('.dialogue-text').innerText(),spoken);
 await page.reload();await page.locator('[data-action=continue]').click();assert.equal(await page.locator('.dialogue-text').innerText(),spoken);report.push('Unread stop, read-only skip and stable dialogue restore');
 await page.locator('[data-action=gallery]').click();assert.equal(await page.locator('.cast-card').count(),9);assert.equal(await page.locator('.gallery-event').count(),0);await page.locator('[data-action=close]').click();report.push('Nine-character gallery; event images remain locked');
 await seeded(page,['confide','negotiate']);
 const frames=c.nodes.a_terms.beats,enter=frames.findIndex(b=>b.cast&&b.cast.includes('jiugao'));
 for(let i=0;i<enter;i++)await page.locator('[data-action=next-beat]').click();
 assert.equal(await page.locator('[data-character=jiugao]').count(),1);assert.equal(await page.locator('[data-character=lin]').count(),0);
 await page.locator('[data-action=prev-beat]').click();assert.equal(await page.locator('[data-character=lin]').count(),1);assert.equal(await page.locator('[data-character=jiugao]').count(),0);report.push('Entrance and rollback restore the correct people');
 await seeded(page,['confide','negotiate','both','plan','public','signal','finish','distance']);
 assert.equal(await page.locator('[data-epilogue]').count(),1);assert.equal(await page.locator('[data-ending]').count(),0);
 while(!(await page.locator('.event-art').count()))await page.locator('[data-action=next-epilogue]').click();
 await page.screenshot({path:join(root,'review/supper-v3.png'),fullPage:true});
 await page.reload();await page.locator('[data-action=continue]').click();assert.equal(await page.locator('.event-art').count(),1);
 await page.locator('[data-action=gallery]').click();assert.equal(await page.locator('.gallery-event').count(),1);await page.locator('[data-action=close]').click();
 while(await page.locator('[data-action=next-epilogue]').count())await page.locator('[data-action=next-epilogue]').click();
 assert.equal(await page.locator('[data-ending]').getAttribute('data-ending'),'end_together');report.push('Epilogue precedes ending; seen event image persists and unlocks');
 await seeded(page,[],'freedom',1);assert.equal(await page.locator('[data-character=father]').count(),1);assert.equal(await page.locator('[data-character=mother]').count(),1);report.push('Family opening renders both parents');
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});await page.locator('[data-action=gallery]').click();
  assert.ok(await page.locator('.modal').evaluate(x=>x.getBoundingClientRect().bottom<=innerHeight));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('[data-action=close]').click();
 }
 report.push('Gallery responsive at 375/390/430 widths');
 // Real timing: first click completes text, second advances; auto pauses on choices and modals.
 const animated=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});animated.on('pageerror',e=>errors.push(e.message));
 await seeded(animated,[]);
 const count=await animated.locator('.beat-count').first().innerText();
 await animated.locator('.dialogue').click();assert.equal(await animated.locator('.beat-count').first().innerText(),count);
 await animated.locator('.dialogue').click();assert.notEqual(await animated.locator('.beat-count').first().innerText(),count);report.push('Typing click completes before advancing');
 await animated.locator('[data-action=auto]').click();assert.equal(await animated.locator('[data-action=auto]').getAttribute('aria-pressed'),'true');
 await animated.locator('[data-action=gallery]').click();await animated.locator('[data-action=close]').click();assert.equal(await animated.locator('[data-action=auto]').getAttribute('aria-pressed'),'false');report.push('Modal cancels auto reading');
 // Use a real short last frame at the starting scene, without editing timers.
 await seeded(page,[],'agency',c.nodes.a_door.beats.length);
 await page.locator('[data-action=auto]').click();
 await page.locator('[data-action=choose]').first().waitFor({timeout:12000});
 assert.equal(await page.locator('[data-action=auto]').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('[data-node]').getAttribute('data-node'),'a_door');report.push('Auto reading stops at choices without selecting');
 assert.deepEqual(errors,[]);await mkdir(join(root,'qa/output'),{recursive:true});await writeFile(join(root,'qa/output/novel-report.json'),JSON.stringify({passed:true,checkedAt:new Date().toISOString(),checks:report,errors},null,2));
 console.log('Novel feature checks passed:',report.length);
}finally{await browser.close();}
