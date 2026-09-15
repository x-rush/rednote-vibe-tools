import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createGame,transition} from '../src/engine.mjs';
import {serve,publicContent,root} from '../tools.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(join(process.env.FLOWER_TOOL_MODULES,'playwright'));
const server=await serve(0),url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();page.setDefaultTimeout(5000);
const c=await publicContent(),ids=c.characters.map(x=>x.id),key='flower-werewolf-v1';
const report={checks:[],actions:{},errors:[],safeAreas:[],sourceLinks:[]};
page.on('pageerror',e=>report.errors.push(e.message));
await page.exposeFunction('auditAction',action=>{report.actions[action]=(report.actions[action]||0)+1;});
await page.addInitScript(()=>document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(b&&!b.disabled)window.auditAction(b.dataset.action);
},true));
const click=(action,suffix='')=>page.locator('[data-action="'+action+'"]'+suffix).first().click();
const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
function fixture(role='villager',phase='day'){
  let s=createGame(41,ids,c.roleDeck);s.human=s.players.find(p=>p.role===role).id;
  if(phase==='night')return transition(s,{type:'begin'});
  s.phase=phase;s.day=1;return s;
}
async function mount(s){
  await page.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s});
  await page.reload();await page.waitForSelector('.hero');
  await page.evaluate(()=>{
    document.documentElement.style.setProperty('--safe-area-inset-top','24px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom','20px');
  });
  await click('resume');await click('unlock');
}
try{
  await page.goto(url);await page.waitForSelector('.hero');
  await click('rules');await click('close');
  for(const ch of c.characters){
    await click('character','[data-id="'+ch.id+'"]');
    assert.equal(await page.locator('#character-quote').textContent(),c.verifiedQuotes[ch.id].text);
    await click('quote');assert.ok(await page.locator('#quote-source').isVisible());
    const a=page.locator('#quote-source a');
    assert.equal(await a.getAttribute('href'),c.verifiedQuotes[ch.id].url);
    assert.equal(await a.getAttribute('rel'),'noopener noreferrer');
    report.sourceLinks.push({guest:ch.id,url:await a.getAttribute('href')});
    await click('quote');assert.equal(await page.locator('#quote-source').isVisible(),false);
    await click('close');
  }
  report.checks.push('All seven excerpts and expandable source controls match their verified records');
  await mount(fixture());
  const saved=JSON.stringify(await state());
  await click('player');await click('close');
  await click('rules');await click('close');
  await click('new');await click('close');assert.equal(JSON.stringify(await state()),saved);
  await click('home');assert.ok(await page.locator('.hero').isVisible());
  await click('resume');await click('unlock');assert.equal(JSON.stringify(await state()),saved);
  await click('new');await click('confirm-new');assert.equal((await state()).phase,'deal');
  await click('reveal');await click('begin');assert.equal((await state()).phase,'night');
  report.checks.push('Home/resume and cancellation preserve save; confirmed restart deals a new game');

  for(const kind of ['accuse','support','defend','claim','skip']){
    const s=fixture();await mount(s);await click('jump-control');
    await click('action-kind','[data-id="'+kind+'"]');
    if(['accuse','support','claim'].includes(kind)){
      assert.equal(await page.locator('[data-action="speak"]').isDisabled(),true);
      await click('select');
    }
    if(kind==='claim'){
      await click('claim-result','[data-id="wolf"]');
      await click('claim-result','[data-id="good"]');
    }
    await click('speak');const next=await state();assert.equal(next.phase,'vote');
    const e=next.events.find(x=>x.actor===s.human&&x.kind===kind);assert.ok(e);
    if(kind==='claim')assert.equal(e.result,'good');
    await click('abstain');assert.ok(['vote','roundEnd','over'].includes((await state()).phase));
  }
  report.checks.push('All five speech modes commit correctly; both claim selectors and abstention work');
  const evidenceState=fixture();
  const other=evidenceState.players.filter(p=>p.id!==evidenceState.human);
  evidenceState.events=[{id:'e1',day:1,kind:'support',actor:other[0].id,target:other[1].id},{id:'e2',day:1,kind:'ballot',actor:other[0].id,target:other[1].id}];
  await mount(evidenceState);await click('jump-control');
  await click('select','[data-id="'+other[0].id+'"]');
  await page.locator('#evidence').selectOption({index:1});await click('speak');
  assert.ok((await state()).events.find(e=>e.actor===evidenceState.human&&e.kind==='accuse').evidence);
  assert.ok((await page.locator('.messages').textContent()).includes('变票'));
  await click('select');await click('vote');
  report.checks.push('Evidence selection is committed and the accused responds to the actual flip record');

  for(const action of ['skip','heal','poison']){
    const s=fixture('witch','night');await mount(s);await click('jump-control');
    await click('potion','[data-id="'+action+'"]');
    if(action==='poison'){
      assert.ok(await page.locator('[data-action="night"]').isDisabled());await click('select');
    }
    await click('night');const next=await state();
    assert.notEqual(next.phase,'night');
    assert.equal(next.players[s.human].heal,action==='heal'?0:1);
    assert.equal(next.players[s.human].poison,action==='poison'?0:1);
  }
  await mount(fixture('seer','night'));await click('night');
  assert.equal((await state()).players[(await state()).human].checks.length,0);
  const checked=fixture('seer');checked.players[checked.human].checks=[{day:1,target:other[0].id,wolf:false}];
  await mount(checked);await click('jump-control');
  assert.ok(await page.locator('.check-ready').isVisible());
  await page.locator('.check-ready [data-action="identity"]').click();
  assert.ok(await page.locator('dialog .private-note').isVisible());await click('close');
  report.checks.push('Witch skip/heal/poison and seer skipped check/private-result control work');

  const tie=fixture('villager','vote');tie.runoff=tie.players.filter(p=>p.id!==tie.human).slice(0,2).map(p=>p.id);
  await mount(tie);assert.equal(await page.locator('[data-action="select"]').count(),2);
  await click('select');await click('vote');assert.equal((await state()).runoff,null);
  const dead=fixture();dead.players[dead.human].alive=false;
  await mount(dead);await click('speak-skip');assert.equal((await state()).phase,'vote');
  await click('abstain');
  await mount(dead);await click('fast');assert.equal((await state()).phase,'over');
  const round=fixture('villager','roundEnd');await mount(round);await click('next');assert.equal((await state()).phase,'night');
  report.checks.push('Runoff restricts candidates, clears after vote; eliminated player can spectate/fast-forward');

  const history=fixture();history.day=2;
  history.events=Array.from({length:15},(_,i)=>({id:'e'+(i+1),day:i<3?1:2,kind:'skip',actor:other[i%other.length].id}));
  await mount(history);await click('expand');assert.equal(await page.locator('.message').count(),12);
  await click('history');assert.equal(await page.locator('.message').count(),15);
  await click('history');assert.equal(await page.locator('.message').count(),12);
  for(const width of [375,390,430]){
    await page.setViewportSize({width,height:844});
    for(const action of ['jump-feed','jump-control']){
      await click(action);
      const metrics=await page.evaluate(action=>{
        const target=document.querySelector(action==='jump-feed'?'.feed-column':'#control');
        const bar=document.querySelector('.mobile-game-nav'),header=document.querySelector('.masthead');
        return {width:innerWidth,scroll:document.documentElement.scrollWidth,targetTop:target.getBoundingClientRect().top,headerBottom:header.getBoundingClientRect().bottom,barBottom:bar.getBoundingClientRect().bottom,buttons:[...bar.querySelectorAll('button')].map(x=>({height:x.getBoundingClientRect().height,bottom:x.getBoundingClientRect().bottom}))};
      },action);
      assert.ok(metrics.scroll<=width);assert.ok(metrics.targetTop>=metrics.headerBottom);
      assert.ok(metrics.buttons.every(b=>b.height>=44 && b.bottom<=824));
      report.safeAreas.push({action,...metrics});
    }
    await page.screenshot({path:join(root,'qa/audit-action-'+width+'.png'),animations:'disabled'});
  }
  report.checks.push('History/expand and mobile jumps work at 375/390/430 with 24px top and 20px bottom safe areas');
  const otherPage=await context.newPage();await otherPage.goto(url);
  await otherPage.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s:fixture()});
  await page.waitForSelector('.stale-screen');await click('reload-save');
  assert.ok(await page.locator('.hero').isVisible());await otherPage.close();
  report.checks.push('External-tab save change blocks stale actions and reload control recovers latest save');
  assert.deepEqual(report.errors,[]);
  await writeFile(join(root,'qa/all-controls-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
