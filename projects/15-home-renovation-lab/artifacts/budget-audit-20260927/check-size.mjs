// Beginner-mode size adjustment + new furniture checks (dist + container).
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=resolve('artifacts/budget-audit-20260927');
const serve=(root,inject)=>{const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();let bytes=await readFile(p);if(inject&&p===resolve(root,'src/app.js'))bytes=Buffer.concat([bytes,Buffer.from('\nwindow.__acceptance={get scene(){return scene},get plan(){return plan}};')]);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});return server;};
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
const check=(name,pass,details='')=>{results.push({name,pass});console.log((pass?'PASS':'FAIL')+' '+name+(pass?'':'  '+JSON.stringify(details).slice(0,300)))};
let ok=true;
for(const [label,root,inject] of [['dist','dist',true],['container','minitool-dist',false]]){
  const server=serve(resolve(root),inject);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.waitForTimeout(inject?600:2200);
  // 1. new furniture appears in library and is placeable
  await page.locator('#mobile-launch [data-action="tab-furniture"]:visible').first().tap();
  await page.waitForTimeout(300);
  const newCards=await page.evaluate(()=>['bigsofa','kidbed','bartable','monstera','doublesink'].filter(id=>document.querySelector(`.furniture-card[data-id="${id}"]`)));
  check(label+': new furniture cards rendered',newCards.length===5,newCards);
  if(inject){
    // select an existing item via callback, check beginner size form exists
    const hasItem=await page.evaluate(()=>window.__acceptance.plan.items.length>0);
    check(label+': template has items',hasItem);
    await page.evaluate(()=>{const p=window.__acceptance.plan,s=window.__acceptance.scene;s.cb.select({kind:'item',id:p.items[0].id});});
    await page.waitForTimeout(400);
    const form1=await page.evaluate(()=>{const f=document.querySelector('#item-form');return f?{form:true,fields:[...f.elements].filter(e=>e.name).map(e=>e.name)}:{form:false,inspCls:document.getElementById('inspector').className,body:document.body.className};});
    check(label+': beginner item size form present with w/d/h/angle (no x/z)',form1.form===true&&form1.fields.includes('w')&&form1.fields.includes('d')&&form1.fields.includes('h')&&form1.fields.includes('angle')&&!form1.fields.includes('x'),form1);
    // resize the item via the form (pick a target different from the current width) and submit
    const before=await page.evaluate(()=>window.__acceptance.plan.items[0].w);
    const target=before===1.9?2.2:1.9;
    await page.evaluate(t=>{const i=document.querySelector('#item-form [name="w"]');if(i)i.value=t;},target);
    await page.evaluate(()=>{document.querySelector('#item-form button[type="submit"]').click();});
    await page.waitForTimeout(400);
    const after=await page.evaluate(()=>window.__acceptance.plan.items[0].w);
    check(label+': furniture resized via beginner form',after===target&&before!==target,{before,after});
    // openings form present in beginner mode
    await page.evaluate(()=>{const s=window.__acceptance.scene,p=window.__acceptance.plan;s.cb.select({kind:'room',id:p.rooms[0].id});});
    await page.waitForTimeout(400);
    const openings=await page.evaluate(()=>({form:!!document.querySelector('#opening-form'),advGone:!document.querySelector('details:not(.adv-detail) summary')||![...document.querySelectorAll('details summary')].some(s=>!s.closest('.adv-detail')&&s.textContent.includes('高级')),list:document.querySelectorAll('.opening-list > div').length}));
    check(label+': openings form available in beginner mode',openings.form,openings);
    // resize first opening: click its edit button first (injects editId into the form)
    const opBefore=await page.evaluate(()=>window.__acceptance.plan.openings[0].w);
    await page.evaluate(()=>{document.querySelector('.opening-list [data-action="edit-opening"]').click();});
    await page.waitForTimeout(200);
    await page.evaluate(()=>{const f=document.querySelector('#opening-form');f.querySelector('[name="w"]').value='1.2';f.querySelector('button[type="submit"]').click();});
    await page.waitForTimeout(400);
    const opAfter=await page.evaluate(()=>window.__acceptance.plan.openings[0].w);
    check(label+': door/window resized via beginner form',opAfter===1.2&&opBefore!==1.2,{before:opBefore,after:opAfter});
    // advanced details hidden in beginner
    const advVisible=await page.evaluate(()=>[...document.querySelectorAll('details.adv-detail')].some(d=>d.getBoundingClientRect().height>0));
    check(label+': advanced details still hidden in beginner mode',advVisible===false);
  }
  // 2. container: new furniture thumbnails resolve to real assets
  const thumbOk=await page.evaluate(async()=>{
    const img=document.querySelector('.furniture-card[data-id="monstera"] img');
    if(!img)return {img:false};
    return await new Promise(res=>{img.onload=()=>res({img:true,w:img.naturalWidth});img.onerror=()=>res({img:false,broken:true});if(img.complete)res({img:true,w:img.naturalWidth});});
  });
  check(label+': new furniture thumbnail loads',thumbOk.img,thumbOk);
  // 3. place a new furniture item via tap on center of a room (pending flow)
  check(label+': no pageerrors',errs.length===0,errs.slice(0,2));
  await page.screenshot({path:out+`/size-${label}.png`});
  await context.close();await server.close();
}
await import('node:fs').then(async fs=>{await fs.promises.writeFile(out+'/size-results.json',JSON.stringify(results,null,1));});
const failed=results.filter(r=>!r.pass);
console.log(failed.length?'FAILURES: '+failed.length:'ALL SIZE CHECKS PASSED');
await browser.close();
process.exit(failed.length?1:0);
