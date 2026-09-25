import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const content=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8'));
const engine=require('../src/engine.js')(content);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[],errors=[];
const click=async(page,action)=>{const selector='[data-action="'+action+'"]:visible',inSheet=page.locator('#modal-root '+selector),target=(await inSheet.count()?inSheet:page.locator(selector)).first();await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));await target.click();};
const host=()=>{document.documentElement.style.setProperty('--safe-area-inset-top','24px');document.documentElement.style.setProperty('--safe-area-inset-bottom','16px');for(const side of ['left','right']){const d=document.createElement('div');d.className='qa-host';d.style.cssText='position:fixed;top:24px;'+side+':8px;width:64px;height:44px;z-index:9999;background:#29362eaa';document.body.appendChild(d);}};
async function inspect(page,label){
  const issues=await page.evaluate(()=>{
    const found=[],sheet=document.querySelector('.sheet'),hosts=[...document.querySelectorAll('.qa-host')].map(x=>x.getBoundingClientRect());
    if(document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1)found.push('page overflow');
    if(document.body.innerText.includes('undefined'))found.push('undefined copy');
    if(sheet){const r=sheet.getBoundingClientRect();if(r.top<70||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1)found.push('sheet bounds');}
    for(const sprite of document.querySelectorAll(sheet?'.sheet .sprite':'.selection .sprite,.placed .sprite')){const r=sprite.getBoundingClientRect(),style=getComputedStyle(sprite),plant=sprite.matches('svg.plant-sprite');if(!r.width||!r.height||(!plant&&style.backgroundImage==='none')||(plant&&!sprite.querySelector('image[href="./assets/plants.webp"]')))found.push('missing sprite');}
    const selectors=sheet?'.sheet button':'.dock button,.camera-bar button,.canvas-tools button,.journey-bar button,.goal-preview button,.selection button,.placement-bar button,.plan-panel button,.ground-toolbar button,.blueprint-bar button';
    for(const b of document.querySelectorAll(selectors)){
      if(b.disabled||getComputedStyle(b).visibility==='hidden'||getComputedStyle(b).display==='none')continue;
      const r=b.getBoundingClientRect(),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;
      if(r.width<1||r.height<1||cx<0||cx>innerWidth||cy<0||cy>innerHeight)continue;
      const parent=b.closest('.sheet-content');if(parent){const p=parent.getBoundingClientRect();if(r.top<p.top+2||r.bottom>p.bottom-2)continue;}
      const top=document.elementFromPoint(cx,cy);if(top!==b&&!b.contains(top))found.push('blocked '+b.dataset.action+' by '+(top?.className||top?.tagName));
      if(hosts.some(h=>r.left<h.right&&r.right>h.left&&r.top<h.bottom&&r.bottom>h.top))found.push('host '+b.dataset.action);
    }
    return [...new Set(found)];
  });
  assert.deepEqual(issues,[],label);results.push(label);
}
try{
  for(const [width,height] of [[375,844],[390,844],[430,844],[844,390],[1280,800]]){
    const seed=engine.fresh(Date.now());seed.coins=100000;seed.xp=5000;seed.expansion=7;
    for(const [item,x,y] of [['bamboo',25,40],['pavilion',65,75],['orchid',45,80]])assert.ok(engine.act(seed,{type:'buy',item,area:0,x,y},seed.last).ok);
    const context=await browser.newContext({viewport:{width,height}});
    await context.addInitScript(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key:content.storageKey,seed});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',request=>errors.push(request.url()));
    await page.goto('http://127.0.0.1:4327/');await page.evaluate(host);
    await inspect(page,width+' garden');
    for(const action of ['shop','objects','maps','quests','blueprints','ground','waypoints','expand','plans','warehouse','stories','journal','album','guide']){
      if(['shop','maps'].includes(action))await click(page,action);
      else if(['quests','stories'].includes(action)){await click(page,'moments');await click(page,action);}
      else{await click(page,'manage');await page.locator('.growth-more summary:visible').click();await click(page,action);}
      await inspect(page,width+' '+action);
      if(action==='shop'||action==='album'){
        const scroller=page.locator('.sheet-content');
        const before=await scroller.evaluate(e=>({top:e.scrollTop,range:e.scrollHeight-e.clientHeight}));
        if(before.range>30){const r=await scroller.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,160);await page.waitForTimeout(120);const after=await scroller.evaluate(e=>e.scrollTop);assert.ok(after>before.top,width+' '+action+' wheel scroll: '+JSON.stringify({before,after}));results.push(width+' '+action+' wheel scroll');}
      }
      await click(page,'drawerSize');await inspect(page,width+' '+action+' expanded');await click(page,'close');
    }
    await click(page,'atmosphere');await inspect(page,width+' atmosphere');await page.locator('[data-action="atmosphereChoice"][data-atmosphere="dusk"]').click();assert.ok((await page.locator('.app-shell').getAttribute('class')).includes('atmo-dusk'));results.push(width+' atmosphere applied');
    await click(page,'photo');await page.locator('.photo-preview img').waitFor();await inspect(page,width+' photo');await click(page,'close');
    const current=await page.locator('.camera-bar [data-action="orientation"]').innerText();await click(page,'orientation');assert.notEqual(await page.locator('.camera-bar [data-action="orientation"]').innerText(),current);await inspect(page,width+' orientation');await click(page,'orientation');
    await click(page,'panelToggle');assert.equal(await page.locator('.camera-bar').isVisible(),false);await inspect(page,width+' panels collapsed');await click(page,'panelToggle');assert.equal(await page.locator('.camera-bar').isVisible(),true);results.push(width+' panels restored');
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(new URL('./ui-audit-v2.json',import.meta.url),JSON.stringify({passed:results.length,results,errors},null,2));
  console.log(JSON.stringify({passed:results.length,errors}));
}finally{await browser.close();}
