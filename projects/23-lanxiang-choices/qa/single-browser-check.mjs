import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'qa/output/single');
const url=new URL('../dist-single/index.html',import.meta.url).href;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],external=[],failed=[],screens=[];

async function setup(width,height){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith('file:'))external.push(request.url());});
  page.on('requestfailed',request=>failed.push(request.url()+' '+(request.failure()?.errorText||'')));
  await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{
    document.documentElement.style.setProperty('--safe-area-inset-top','24px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom','20px');
    ['left','right'].forEach(side=>{const cover=document.createElement('div');cover.dataset.hostCover=side;Object.assign(cover.style,{position:'fixed',top:'30px',[side]:'8px',width:'82px',height:'42px',zIndex:'9999',pointerEvents:'none'});document.body.appendChild(cover);});
  });});
  await page.goto(url);
  await page.locator('[data-action=start]').waitFor();
  return page;
}
async function check(page,name){
  const layout=await page.evaluate(()=>{
    const covers=Array.from(document.querySelectorAll('[data-host-cover]')).map(x=>x.getBoundingClientRect());
    const modal=document.querySelector('.modal'),scope=modal||document.querySelector('#app');
    const hits=Array.from(scope.querySelectorAll('button,h1,.brand')).filter(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.width&&r.height&&covers.some(b=>r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top);}).map(x=>x.textContent);
    return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,hits,modalFits:!modal||(modal.getBoundingClientRect().top>=24&&modal.getBoundingClientRect().bottom<=innerHeight)};
  });
  assert.equal(layout.overflow,false,name+' horizontal overflow');
  assert.deepEqual(layout.hits,[],name+' host button overlap');
  assert.equal(layout.modalFits,true,name+' modal outside viewport');
  await page.screenshot({path:join(out,name+'.png'),fullPage:true,animations:'disabled'});
  screens.push({name,...layout});
}
async function reveal(page){while(await page.locator('[data-action=next-beat]').count())await page.locator('[data-action=next-beat]').click();}
async function checkSpriteAspect(page,name){
  const sizes=await page.locator('.sprite').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};}));
  assert.ok(sizes.length>0,name+' missing portrait');
  for(const size of sizes)assert.ok(Math.abs(size.width-size.height)<1,name+' stretched portrait '+JSON.stringify(size));
}
async function choose(page,id){
  await reveal(page);
  await page.locator('[data-action=choose][data-id="'+id+'"]').click();
  await page.waitForTimeout(210);
  while(await page.locator('[data-action=next-epilogue]').count())await page.locator('[data-action=next-epilogue]').click();
}
try{
  for(const width of [375,390,430]){
    const page=await setup(width,844);
    assert.match(await page.locator('h1').innerText(),/一枝春信/);
    assert.equal(await page.locator('[data-action=chapters]').count(),0);
    await check(page,'home-'+width);
    await page.locator('[data-action=about]').click();
    const about=await page.locator('.modal-body').innerText();
    assert.doesNotMatch(about,/兰香|小莲|离府|秋宴|https?:\/\//);
    await check(page,'about-'+width);await page.locator('[data-action=close]').click();
    await page.locator('[data-action=settings]').click();
    assert.equal(await page.locator('[data-action=music],[data-action=voices]').count(),0);
    await check(page,'settings-'+width);await page.locator('[data-action=close]').click();
    await page.locator('[data-action=gallery]').click();
    assert.match(await page.locator('.modal-body').innerText(),/许知枝/);
    assert.match(await page.locator('.modal-body').innerText(),/青禾/);
    await checkSpriteAspect(page,'gallery-'+width);
    await check(page,'gallery-'+width);await page.locator('[data-action=close]').click();
    await page.locator('[data-action=start]').click();
    assert.equal(await page.locator('[data-node]').getAttribute('data-node'),'s_order');
    await check(page,'story-'+width);
    await choose(page,'ask_memory');
    assert.equal(await page.locator('[data-node]').getAttribute('data-node'),'s_work');
    assert.equal(await page.locator('[data-character=zhizhi],[data-character=qinghe]').count(),2);
    await checkSpriteAspect(page,'work-'+width);
    await check(page,'work-'+width);
    await page.setViewportSize({width:844,height:390});await checkSpriteAspect(page,'landscape-work-'+width);await check(page,'landscape-work-'+width);
    await page.setViewportSize({width,height:844});
    await page.reload();await page.locator('[data-action=continue]').click();
    assert.equal(await page.locator('[data-node]').getAttribute('data-node'),'s_work');
    await choose(page,'work_together');await choose(page,'keep_old_leaf');
    assert.equal(await page.locator('[data-ending]').getAttribute('data-ending'),'s_end_leaf');
    await check(page,'ending-leaf-'+width);
    await page.locator('[data-action=capture]').click();await check(page,'letter-'+width);await page.locator('[data-action=close]').click();
    await page.locator('[data-action=history]').first().click();await check(page,'history-'+width);await page.locator('[data-action=close]').click();
    await page.locator('[data-action=restart]').click();await page.locator('[data-action=new-confirm]').click();
    await choose(page,'study_cloth');await choose(page,'work_slowly');await choose(page,'fold_old_leaf');
    assert.equal(await page.locator('[data-ending]').getAttribute('data-ending'),'s_end_window');
    await check(page,'ending-window-'+width);
    await page.locator('[data-action=book]').first().click();
    assert.equal(await page.locator('[data-action=read-ending]').count(),2);
    await check(page,'book-'+width);await page.locator('[data-action=close]').click();
    await page.setViewportSize({width:844,height:390});await check(page,'landscape-'+width);
    await page.close();
  }
  const tablet=await setup(900,900);
  await tablet.locator('[data-action=start]').click();
  await choose(tablet,'ask_memory');
  await checkSpriteAspect(tablet,'tablet-work-900');
  await check(tablet,'tablet-work-900');
  await tablet.close();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);
  await writeFile(join(out,'report.json'),JSON.stringify({passed:true,screens,errors,external,failed,limitations:['Browser-only; platform simulator and real devices not tested']},null,2));
  console.log('Single-story browser checks passed:',screens.length,'screens, both endings, save/restart/book/letter/settings, no external requests or runtime errors.');
}finally{await browser.close();}
