import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';
import {createGame} from '../src/engine.mjs';
import {serve, publicContent, root} from '../tools.mjs';
const require=createRequire(import.meta.url);
const moduleRoot=process.env.FLOWER_TOOL_MODULES;
const {chromium}=moduleRoot?require(join(moduleRoot,'playwright')):require('playwright');
const server=await serve(0), url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.FLOWER_BROWSER_CHANNEL || 'msedge'});
const report={layouts:[],flows:[],consoleErrors:[],externalRequests:[]};
await mkdir(join(root,'qa'),{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',err=>report.consoleErrors.push(err.message));
page.on('request',r=>{if(!r.url().startsWith(url))report.externalRequests.push(r.url());});
async function loaded(){
  await page.waitForSelector('.hero');
  await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));
}
async function layout(label,width){
  const check=await page.evaluate(()=>{
    const header=document.querySelector('.masthead'), brand=document.querySelector('.brand');
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,headerBottom:header.getBoundingClientRect().bottom,brandTop:brand.getBoundingClientRect().top,brokenImages:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length};
  });
  if(check.scroll>width){
    console.log('Overflow elements',await page.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1||e.left < -1)));
    await page.screenshot({path:join(root,'qa/overflow.png'),fullPage:true});
  }
  assert.ok(check.scroll<=width,label+' horizontal overflow '+JSON.stringify(check));
  assert.ok(check.brandTop>=24,label+' unsafe top');
  assert.equal(check.brokenImages,0);
  report.layouts.push({label,...check});
}
try{
  await page.goto(url);await loaded();
  await page.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','24px'));
  for(const width of [1440,375,390,430]){
    await page.setViewportSize({width,height:width===1440?1000:844});
    await layout('home-'+width,width);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:join(root,'qa/home-'+width+'.png'),fullPage:true,animations:'disabled'});
  }
  await page.getByRole('button',{name:'玩法说明',exact:true}).first().click();
  assert.ok(await page.locator('dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('[data-action="character"]').first().click();
  const before=await page.locator('#character-quote').textContent();
  await page.locator('[data-action="quote"]').click();
  assert.equal(await page.locator('#character-quote').textContent(),before);
  assert.ok(await page.locator('#quote-source').isVisible());
  assert.equal(await page.locator('#quote-source a').getAttribute('target'),'_blank');
  await page.keyboard.press('Escape');
  await page.locator('[data-action="gallery"]').click();
  const anchor=await page.locator('#cast').boundingBox(), masthead=await page.locator('.masthead').boundingBox();
  assert.ok(anchor.y>=masthead.y+masthead.height-1,'cast anchor hidden by header');
  report.layouts.push({label:'cast-safe-anchor',anchorTop:anchor.y,headerBottom:masthead.y+masthead.height});
  const c=await publicContent();
  const seeds={};
  for(let seed=0;Object.keys(seeds).length<4;seed++){
    const s=createGame(seed,c.characters.map(x=>x.id),c.roleDeck);
    if(seeds[s.players[s.human].role]===undefined)seeds[s.players[s.human].role]=seed;
  }
  for(const [role,seed]of Object.entries(seeds)){
    await page.setViewportSize({width:390,height:844});
    const s=createGame(seed,c.characters.map(x=>x.id),c.roleDeck);
    await page.evaluate(s=>localStorage.setItem('flower-werewolf-v1',JSON.stringify(s)),s);
    await page.reload();await loaded();
    await page.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','24px'));
    await page.locator('[data-action="resume"]').click();
    assert.equal(await page.locator('.role-symbol').count(),0,'restore reveals role');
    await page.locator('[data-action="unlock"]').click();
    await page.locator('[data-action="reveal"]').click();
    assert.ok(await page.locator('.deal-role').textContent());
    await layout('deal-'+role,390);
    await page.locator('[data-action="begin"]').click();
    let steps=0,dayCaptured=false;
    while(steps++<120){
      const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('flower-werewolf-v1')));
      if(state.phase==='over')break;
      const alive=state.players[state.human].alive;
      if(state.phase==='night'){
        if(alive&&(role==='wolf'||role==='seer'))await page.locator('[data-action="select"]').first().click();
        if(alive&&role==='witch'&&await page.locator('[data-action="potion"][data-id="heal"]').isEnabled())await page.locator('[data-action="potion"][data-id="heal"]').click();
        await layout('night-'+role,page.viewportSize().width);
        await page.locator('[data-action="night"]').click();
      }else if(state.phase==='day'){
        if(!dayCaptured){
          for(const width of [375,390,430]){
            await page.setViewportSize({width,height:844});await layout('day-'+role+'-'+width,width);
            if(role==='villager'){
              await page.evaluate(()=>scrollTo(0,0));
              await page.screenshot({path:join(root,'qa/game-'+width+'.png'),fullPage:true,animations:'disabled'});
            }
          }
          await page.setViewportSize({width:390,height:844});
          dayCaptured=true;
        }
        if(alive){
          const action=role==='wolf'?'claim':role==='witch'?'support':'accuse';
          await page.locator('[data-action="action-kind"][data-id="'+action+'"]').click();
          await page.locator('[data-action="select"]').first().click();
          if(action==='accuse'&&await page.locator('#evidence option').count()>1)await page.locator('#evidence').selectOption({index:1});
          await page.locator('[data-action="speak"]').click();
        }else await page.locator('[data-action="speak-skip"]').click();
      }else if(state.phase==='vote'){
        if(alive&&await page.locator('[data-action="select"]').count()){
          await page.locator('[data-action="select"]').first().click();
          await page.locator('[data-action="vote"]').click();
        }else await page.locator('[data-action="abstain"]').click();
      }else if(state.phase==='roundEnd')await page.locator('[data-action="next"]').click();
      await assert.doesNotReject(()=>page.locator('#toast').textContent().then(text=>assert.equal(text,'')));
    }
    const final=await page.evaluate(()=>JSON.parse(localStorage.getItem('flower-werewolf-v1')));
    assert.equal(final.phase,'over',role+' game did not end');
    assert.equal(await page.locator('.reveal-player').count(),7);
    report.flows.push({role,seed,steps,day:final.day,winner:final.winner});
    await layout('result-'+role,page.viewportSize().width);
    if(role==='villager')await page.screenshot({path:join(root,'qa/result-390.png'),fullPage:true});
  }
  // Corrupt storage and an external tab update must not expose or overwrite a stale game.
  await page.evaluate(()=>localStorage.setItem('flower-werewolf-v1','{broken'));
  await page.reload();await loaded();
  assert.equal(await page.locator('[data-action="resume"]').count(),0);
  assert.ok((await page.locator('.notice').textContent()).includes('无法恢复'));
  // A normal random start, refresh at night, and gated restore.
  await page.locator('[data-action="new"]').first().click();
  await page.locator('[data-action="reveal"]').click();
  await page.locator('[data-action="begin"]').click();
  const saved=await page.evaluate(()=>localStorage.getItem('flower-werewolf-v1'));
  // Visiting the gallery mid-game must preserve the screen, selections and save.
  const available=await page.locator('[data-action="select"]').count();
  if(available)await page.locator('[data-action="select"]').first().click();
  const selectedBefore=await page.locator('.target.selected').count()?await page.locator('.target.selected').getAttribute('data-id'):null;
  await page.locator('[data-action="gallery"]').click();
  assert.ok(await page.locator('dialog').isVisible());
  assert.equal(await page.locator('.game-screen').count(),1);
  assert.equal(await page.locator('.hero').count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('flower-werewolf-v1')),saved);
  await page.locator('dialog [data-action="character"]').first().click();
  await page.locator('[data-action="quote"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.game-screen').count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('flower-werewolf-v1')),saved);
  const selectedAfter=await page.locator('.target.selected').count()?await page.locator('.target.selected').getAttribute('data-id'):null;
  assert.equal(selectedAfter,selectedBefore);
  assert.equal(await page.locator('[data-action="gallery"]').evaluate(el=>el===document.activeElement),true);
  report.flows.push({gallery:'mid-game modal, nested character, original screen and selections preserved'});
  await page.reload();await loaded();
  await page.locator('[data-action="resume"]').click();
  assert.equal(await page.locator('.private-note').count(),0);
  await page.locator('[data-action="unlock"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('flower-werewolf-v1')),saved);
  await page.locator('[data-action="identity"]').click();
  assert.ok(await page.locator('dialog .role-symbol').isVisible());
  await page.keyboard.press('Escape');
  const other=await context.newPage();await other.goto(url);
  await other.evaluate(()=>localStorage.setItem('flower-werewolf-v1','null'));
  await page.waitForSelector('.stale-screen');
  assert.equal(await page.locator('[data-action="night"]').count(),0);
  await other.close();
  assert.deepEqual(report.consoleErrors,[]);
  assert.deepEqual(report.externalRequests,[]);
  console.log(JSON.stringify(report,null,2));
  await writeFile(join(root,'qa/browser-report.json'),JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
