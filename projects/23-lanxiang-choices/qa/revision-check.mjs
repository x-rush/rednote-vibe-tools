import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),report=[],errors=[];
try{
 for(const [name,path,expected,chapter="agency"] of [
  ['family-honest',['leave','honest','piece','askhelp','share','plan'],'end_shared','freedom'],
  ['family-promise',['leave','promise','piece','askhelp','share','plan'],'end_shared','freedom'],
  ['family-letter',['ask','together','refuse','step','family'],'end_bridge','freedom'],
  ['family-paid',['stay','want','pay','terms','boundary'],'end_steady','freedom'],
  ['stove-exit',['confide','negotiate','both','plan','look_stove','return_duty','signal','work_entry'],'end_rescue'],
  ['witness-exit',['confide','negotiate','both','plan','look_steward','return_duty','signal','finish','distance'],'end_together'],
  ['witness-respect',['confide','negotiate','both','plan','look_steward','return_duty','signal','finish','equal'],'end_respect'],
  ['zhao-direct',['conceal','obey','zhao','bargain'],'end_pact'],
  ['zhao-verified',['conceal','obey','zhao','verify','limited'],'end_pact'],
  ['zhao-declined',['conceal','obey','zhao','verify','retreat'],'end_caution'],
  ['hidden-exit',['confide','negotiate','both','plan','public','signal','keep_hidden'],'end_waiting']]){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4326/');
  await page.evaluate(chapter=>localStorage.setItem('spring-letter:v1',JSON.stringify({version:1,chapter,path:[],instant:true,music:false,voices:false})),chapter);
  await page.reload();await page.locator('[data-action=start]').click();
  for(const choice of path){while(await page.locator('[data-action=next-beat]').count())await page.locator('[data-action=next-beat]').click();await page.locator('[data-action=choose][data-id="'+choice+'"]').click();await page.waitForTimeout(190);}
  const shown=[];
  while(await page.locator('[data-action=next-epilogue]').count()){shown.push(await page.locator('.dialogue-text').innerText());await page.locator('[data-action=next-epilogue]').click();}
  assert.equal(await page.locator('[data-ending]').getAttribute('data-ending'),expected);
  const wanted=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('spring-letter:v1')),r=StoryEngine.replay(STORY_CONTENT,s.path,s.chapter);return STORY_CONTENT.endings[r.node].epilogue.filter(b=>StoryEngine.matches(r.flags,b.when)).map(b=>b.text);});
  assert.deepEqual(shown,wanted,'Every conditional epilogue is displayed once in correct order');
  await page.screenshot({path:join(root,'qa/output/revision-'+name+'.png'),fullPage:true});
  report.push({name,ending:expected,frames:shown.length});await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(join(root,'qa/output/revision-report.json'),JSON.stringify({routes:report,errors},null,2));console.log('Revision routes passed:',report.length);
}finally{await browser.close();}
