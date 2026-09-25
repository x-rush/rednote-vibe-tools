import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'qa/output');await mkdir(out,{recursive:true});
const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8')),context={window:{}};vm.runInNewContext(await readFile(join(root,'src/engine.js'),'utf8'),context);const engine=context.window.StoryEngine,paths={};
function walk(path,chapter){const s=engine.replay(c,path,chapter);if(c.endings[s.node]){if(!paths[s.node]||paths[s.node].path.length>path.length)paths[s.node]={path,chapter};}else for(const ch of c.nodes[s.node].choices.filter(ch=>engine.matches(s.flags,ch.when)))walk([...path,ch.id],chapter);}for(const ch of c.chapters)walk([],ch.id);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],external=[],report=[];const base='http://127.0.0.1:4326',key='spring-letter:v1';
async function check(page,name){
  await page.screenshot({path:join(out,name+'.png'),fullPage:true,animations:'disabled'});
  const layout=await page.evaluate(()=>{
    const covers=Array.from(document.querySelectorAll('[data-host-cover]')).map(x=>x.getBoundingClientRect());
    const modal=document.querySelector('.modal'),scope=modal||document.querySelector('#app');
    const hits=Array.from(scope.querySelectorAll('button,h1,.brand')).filter(el=>{const r=el.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight||!r.width||!r.height)return false;return covers.some(b=>r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top);}).map(x=>x.textContent);
    return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,hits,modalFits:!modal||(modal.getBoundingClientRect().top>=24&&modal.getBoundingClientRect().bottom<=innerHeight)};
  });
  assert.equal(layout.overflow,false,name+' horizontal overflow');assert.deepEqual(layout.hits,[],name+' host overlaps');assert.equal(layout.modalFits,true,name+' modal outside viewport');report.push({name,...layout});
}
async function setup(width,height){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
  await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{
    document.documentElement.style.setProperty('--safe-area-inset-top','24px');document.documentElement.style.setProperty('--safe-area-inset-bottom','20px');
    ['left','right'].forEach(side=>{const e=document.createElement('div');e.dataset.hostCover=side;e.textContent=side==='left'?'宿主返回':'宿主操作';Object.assign(e.style,{position:'fixed',top:'30px',[side]:'8px',width:'82px',height:'42px',background:'rgba(186,70,83,.75)',zIndex:'9999',fontSize:'10px',textAlign:'center',lineHeight:'42px',pointerEvents:'none',borderRadius:'22px'});document.body.appendChild(e);});
  });});
  await page.goto(base);return page;
}
async function reveal(page){while(await page.locator('[data-action=next-beat]').count())await page.locator('[data-action=next-beat]').click();}
async function family(page){await page.locator('[data-action=chapters]').click();await page.locator('[data-action=select-chapter][data-id=freedom]').click();await page.locator('[data-action=chapter-confirm]').click();}
async function choose(page,id){await reveal(page);await page.locator('[data-action=choose][data-id="'+id+'"]').click();await page.waitForTimeout(210);while(await page.locator('[data-action=next-epilogue]').count())await page.locator('[data-action=next-epilogue]').click();}
try{
  for(const width of [375,390,430]){
    const page=await setup(width,844);await check(page,'home-'+width);
    await page.locator('[data-action=about]').click();await check(page,'about-'+width);await page.locator('[data-action=close]').click();
    await family(page);await check(page,'story-'+width);
    await page.locator('[data-action=inspect][data-id=bowl]').click();await check(page,'object-'+width);await page.locator('[data-action=close]').click();
    await choose(page,'leave');await check(page,'departure-'+width);
    await page.locator('[data-action=settings]').click();await page.locator('[data-action=large]').click();await check(page,'settings-'+width);await page.locator('[data-action=close]').click();await check(page,'large-text-'+width);
    await page.locator('[data-action=settings]').click();await page.locator('[data-action=large]').click();await page.locator('[data-action=close]').click();
    await page.reload();await page.locator('[data-action=continue]').click();assert.equal(await page.locator('[data-node]').getAttribute('data-node'),'leave_gate');
    await page.locator('[data-action=history]').click();await check(page,'history-'+width);await page.locator('[data-action=rewind]').first().click();assert.equal(await page.locator('[data-node]').getAttribute('data-node'),'night');
    await choose(page,'ask');await choose(page,'together');await choose(page,'refuse');await choose(page,'step');await choose(page,'own');assert.equal(await page.locator('[data-ending]').getAttribute('data-ending'),'end_own');await check(page,'ending-'+width);
    await page.locator('[data-action=capture]').click();await check(page,'letter-'+width);await page.keyboard.press('Escape');
    await page.locator('[data-action=book]').click();await check(page,'book-'+width);assert.equal(await page.locator('[data-action=read-ending]').count(),1);await page.locator('[data-action=read-ending]').click();await page.locator('.modal [data-action=capture]').click();await page.locator('[data-action=close]').click();
    await page.locator('[data-action=restart]').click();await page.getByRole('button',{name:'留在此刻'}).click();assert.equal(await page.locator('[data-ending]').getAttribute('data-ending'),'end_own');
    await page.locator('[data-action=restart]').click();await page.locator('[data-action=new-confirm]').click();await page.locator('[data-action=book]').click();assert.equal(await page.locator('[data-action=read-ending]').count(),1);await page.locator('[data-action=close]').click();
    await page.close();
  }
  for(const width of [375,390,430]){
    const vn=await setup(width,844);await vn.locator('[data-action=start]').click();
    await check(vn,'vn-context-'+width);
    await vn.locator('[data-action=next-beat]').click();await vn.locator('[data-action=next-beat]').click();
    const before=await vn.locator('.dialogue-text').innerText();await vn.reload();await vn.locator('[data-action=continue]').click();assert.equal(await vn.locator('.dialogue-text').innerText(),before);
    await check(vn,'vn-sprites-'+width);assert.equal(await vn.locator('.sprite').count(),2);
    await reveal(vn);await check(vn,'vn-choices-'+width);
    await choose(vn,'confide');await vn.locator('[data-action=clues]').click();await check(vn,'vn-clues-'+width);await vn.locator('[data-action=close]').click();
    await choose(vn,'negotiate');await vn.locator('[data-action=next-beat]').click();assert.equal(await vn.locator('.emotion-intense').count(),1);await check(vn,'vn-expression-'+width);
    await vn.locator('[data-action=log]').first().click();await check(vn,'vn-log-'+width);await vn.keyboard.press('Escape');
    await vn.locator('[data-action=settings]').click();await vn.locator('[data-action=large]').click();await vn.locator('[data-action=close]').click();await check(vn,'vn-large-'+width);
    await vn.setViewportSize({width:844,height:390});await check(vn,'vn-landscape-'+width);
    await vn.locator('[data-action=history]').click();await check(vn,'vn-landscape-modal-'+width);await vn.locator('[data-action=close]').click();
    await vn.close();
  }
  const page=await setup(390,844);
  for(const [end,route] of Object.entries(paths)){
    const {path,chapter}=route;
    await page.evaluate(k=>localStorage.removeItem(k),key);await page.reload();if(chapter==='freedom')await family(page);else await page.locator('[data-action=start]').click();
    for(const id of path)await choose(page,id);
    assert.equal(await page.locator('[data-ending]').getAttribute('data-ending'),end);await check(page,end);
    await page.reload();await page.locator('[data-action=continue]').click();assert.equal(await page.locator('[data-ending]').getAttribute('data-ending'),end);
  }
  await page.setViewportSize({width:844,height:390});await check(page,'landscape-ending');await page.locator('[data-action=home]').click();await check(page,'landscape-home');await page.locator('[data-action=continue]').click();await page.locator('[data-action=history]').first().click();await check(page,'landscape-history');await page.locator('[data-action=rewind]').first().click();await check(page,'landscape-story');
  await page.setViewportSize({width:1440,height:1000});await check(page,'desktop-story');await page.locator('[data-action=home]').click();await check(page,'desktop-home');
  await page.evaluate(k=>localStorage.setItem(k,'{broken'),key);await page.reload();assert.equal(await page.locator('[data-action=start]').count(),1);report.push({name:'corrupt-save',passed:true});
  await page.close();
  const blocked=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});blocked.on('pageerror',e=>errors.push(e.message));await blocked.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('blocked');};Storage.prototype.setItem=function(){throw Error('blocked');};});await blocked.goto(base);await blocked.locator('[data-action=start]').click();await choose(blocked,'confide');assert.equal(await blocked.locator('[data-node]').getAttribute('data-node'),'a_study');assert.ok((await blocked.locator('#status').textContent()).includes('无法保存'));report.push({name:'storage-denied-still-playable',passed:true});await blocked.close();
  const offline=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});offline.on('pageerror',e=>errors.push(e.message));await offline.goto(new URL('../dist/index.html',import.meta.url).href);await offline.locator('[data-action=start]').click();await choose(offline,'confide');assert.equal(await offline.locator('[data-node]').getAttribute('data-node'),'a_study');report.push({name:'file-protocol-classic-offline',passed:true});await offline.close();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(join(out,'report.json'),JSON.stringify({passed:true,checkedAt:new Date().toISOString(),checks:report,errors,external,limits:['Small-red-book real-device host untested','Chrome 61 runtime untested; ES2017 baseline code inspected','CSS simulated rotation is not implemented; real landscape viewport tested']},null,2));
  console.log('Browser checks passed:',report.length,'screens/states; all',Object.keys(c.endings).length,'endings; no external requests or runtime errors.');
}finally{await browser.close();}
