import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base='http://127.0.0.1:4326/',key='spring-letter:v1',report=[],errors=[];
async function page(options={}){
 const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(({unsupported,resumeFail,decodeFail,delay})=>{
  window.__sounds=[];window.__contexts=[];window.__delay=delay||0;window.__decodeFail=decodeFail;
  const Native=window.AudioContext||window.webkitAudioContext;
  if(unsupported){window.AudioContext=undefined;window.webkitAudioContext=undefined;return;}
  window.AudioContext=function(){
   const ctx=new Native();window.__contexts.push(ctx);
   const resume=ctx.resume.bind(ctx);ctx.resume=()=>resumeFail?Promise.reject(Error('test resume denied')):resume();
   const decode=ctx.decodeAudioData.bind(ctx);ctx.decodeAudioData=(bytes,ok,no)=>{
    if(window.__decodeFail){setTimeout(()=>no(Error('test bad audio')),20);return;}
    const delayed=fn=>value=>setTimeout(()=>fn(value),window.__delay);
    const promise=decode(bytes,delayed(ok),delayed(no));if(promise)promise.catch(()=>{});
   };
   const create=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=()=>{
    const s=create(),entry={started:false,stopped:false,ended:false};
    const start=s.start.bind(s),stop=s.stop.bind(s),connect=s.connect.bind(s);
    s.connect=g=>{entry.gain=g;return connect(g);};
    s.start=(...args)=>{Object.assign(entry,{started:true,loop:s.loop,duration:s.buffer.duration,at:Date.now(),peak:Math.max(...s.buffer.getChannelData(0).slice(0,5000).map(Math.abs))});window.__sounds.push(entry);return start(...args);};
    s.stop=(...args)=>{entry.stopped=true;return stop(...args);};s.addEventListener('ended',()=>entry.ended=true);return s;
   };return ctx;
  };
 },options);
 await p.goto(base);return p;
}
async function seed(p,{path=[],chapter='agency',frameId='',music=true,voices=true}={}){
 await p.evaluate(({key,path,chapter,frameId,music,voices})=>localStorage.setItem(key,JSON.stringify({version:1,path,chapter,frameId,music,voices,instant:true,beat:0,read:[],unlocked:[],seen:[]})),{key,path,chapter,frameId,music,voices});await p.reload();
}
async function start(p){await p.locator('[data-action=start],[data-action=continue]').click();}
async function counts(p){return p.evaluate(()=>({all:__sounds.length,voices:__sounds.filter(s=>!s.loop).length,active:__sounds.filter(s=>s.started&&!s.stopped&&!s.ended).length,music:__sounds.filter(s=>s.loop&&!s.stopped&&!s.ended).length}));}
const cueSeed={path:['confide','negotiate','both','plan'],frameId:'a_plan-v1-1'};
try{
 const p=await page();assert.equal(await p.evaluate(()=>__contexts.length),0);
 await seed(p,cueSeed);await start(p);await p.waitForTimeout(500);
 assert.equal((await counts(p)).voices,1);assert.equal((await counts(p)).music,1);
 assert.ok(await p.evaluate(()=>__sounds.every(s=>s.duration>0&&s.peak>0)));report.push('Actual MP3 bytes decoded; music starts from user gesture; cue plays once; nonzero PCM');
 // Finish the current line does not replay it; rolling back suppresses the old cue.
 await p.locator('[data-action=prev-beat]').click();await p.waitForTimeout(300);assert.equal((await counts(p)).voices,1);
 await p.locator('[data-action=settings]').click();assert.equal((await counts(p)).active,1);
 await p.locator('[data-action=music]').click();assert.equal((await counts(p)).active,0);
 await p.locator('[data-action=voices]').click();await p.locator('[data-action=close]').click();
 await p.reload();await start(p);assert.equal(await p.evaluate(()=>__contexts.length),0);report.push('Rollback and modal cancel voice; independent mute preferences survive reload; both off create no context');
 await p.locator('[data-action=settings]').click();await p.locator('[data-action=music]').click();await p.locator('[data-action=close]').click();await p.waitForTimeout(250);assert.equal((await counts(p)).music,1);
 await p.locator('[data-action=home]').click();assert.equal((await counts(p)).active,0);report.push('Music can be re-enabled; home stops all nodes');
 const delay=await page({delay:900});await seed(delay,cueSeed);await start(delay);await delay.waitForTimeout(220);await delay.locator('[data-action=prev-beat]').click();await delay.waitForTimeout(1200);assert.equal((await counts(delay)).voices,0);report.push('Navigating away during actual delayed decode prevents late voice');
 const home=await page({delay:800});await start(home);await home.locator('[data-action=home]').click();await home.waitForTimeout(1000);assert.equal((await counts(home)).all,0);report.push('Home cancels music while decoding before a source can start');
 const transition=await page();await seed(transition,{path:['confide']});await start(transition);await transition.waitForTimeout(300);assert.equal((await counts(transition)).music,1);
 while(await transition.locator('[data-action=next-beat]').count())await transition.locator('[data-action=next-beat]').click();
 await transition.locator('[data-action=choose][data-id=refuse]').click();assert.equal((await counts(transition)).music,0);report.push('Refusal scene stops the preceding study music and leaves intentional silence');
 const immediate=await page();await seed(immediate,cueSeed);await start(immediate);await immediate.locator('[data-action=settings]').click();await immediate.waitForTimeout(450);assert.equal((await counts(immediate)).voices,0);report.push('Opening a dialog cancels the pending cue timer');
 await immediate.locator('[data-action=close]').click();await immediate.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal((await counts(immediate)).active,0);
 await immediate.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await immediate.waitForTimeout(250);assert.equal((await counts(immediate)).active,0);
 await immediate.locator('[data-action=next-beat]').click();await immediate.waitForTimeout(250);assert.equal((await counts(immediate)).music,1);report.push('Hidden page stops audio; returning waits for a new gesture');
 for(const options of [{unsupported:true},{resumeFail:true},{decodeFail:true}]){
  const bad=await page(options);await start(bad);await bad.waitForTimeout(300);assert.match(await bad.locator('#status').innerText(),/无声阅读/);await bad.locator('[data-action=next-beat]').click();assert.equal(await bad.locator('.dialogue').count(),1);await bad.close();
 }report.push('Missing Web Audio, rejected resume and decode error keep story readable and show recovery hint');
 const retry=await page({decodeFail:true});await start(retry);await retry.waitForTimeout(200);await retry.evaluate(()=>{window.__decodeFail=false;});await retry.locator('[data-action=settings]').click();await retry.locator('[data-action=audio-retry]').click();await retry.waitForTimeout(400);assert.equal((await counts(retry)).music,1);report.push('Retry recovers from decode failure without resetting the story');
 const all=await page();await start(all);const decoded=await all.evaluate(async()=>{
  const ctx=__contexts[0],rows=[];
  for(const id of Object.keys(STORY_AUDIO)){const bytes=Uint8Array.from(atob(STORY_AUDIO[id]),x=>x.charCodeAt(0)),size=bytes.length;const b=await new Promise((ok,no)=>ctx.decodeAudioData(bytes.buffer,ok,no));rows.push({id,bytes:size,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate});}return rows;
 });assert.equal(decoded.length,5);assert.ok(decoded.every(x=>x.bytes>0&&x.bytes<=102400&&x.duration>0));report.push({allFiveActualDecodes:decoded});
 // Verify a real loop continues beyond one complete 24-second buffer.
 const looping=await page();await start(looping);await looping.waitForTimeout(350);
 const since=Date.now();
 for(const width of [375,390,430,844]){
  await looping.setViewportSize({width,height:width===844?390:844});
  await looping.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','24px');document.documentElement.style.setProperty('--safe-area-inset-bottom','20px');});
  await looping.locator('[data-action=settings]').click();
  for(const action of ['music','voices','audio-retry','close']){const el=looping.locator('[data-action='+action+']');await el.scrollIntoViewIfNeeded();const box=await el.boundingBox();assert.ok(box.y>=72&&box.y+box.height<=(width===844?390:844),action+' host/safe-area bounds');}
  assert.ok(await looping.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await looping.screenshot({path:join(root,'qa/output/audio-settings-'+width+'.png')});await looping.locator('[data-action=close]').click();
 }report.push('Audio settings fit 375/390/430 and 844×390 with 24px safe area; controls below simulated host button zone');
 await looping.waitForTimeout(Math.max(0,25000-(Date.now()-since)));
 assert.equal((await counts(looping)).music,1);assert.equal((await counts(looping)).all,1);report.push('Real music loop remains active beyond 24 seconds without spawning additional sources');
 assert.deepEqual(errors,[]);await writeFile(join(root,'qa/output/audio-report.json'),JSON.stringify({passed:report,errors},null,2));console.log(JSON.stringify({checks:report.length,errors},null,2));
}finally{await browser.close();}
