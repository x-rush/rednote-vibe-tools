// Opening panel: selecting a door/window edits it directly, like furniture.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const seed={active:'seedA',plans:[{schemaVersion:1,id:'seedA',name:'面板测试',mode:'beginner',wallHeight:2.65,wallHeightMeasured:true,wallThickness:.14,buildingArea:null,updatedAt:Date.now(),rooms:[{id:'roomA',name:'客厅',x:0,z:0,w:6,d:5,kind:'living',measured:true,floor:'oak',wall:'cream',textureScale:1,textureAngle:0}],items:[],openings:[{id:'win1',roomId:'roomA',side:'north',offset:3,w:1.4,h:1.3,sill:.9,type:'window',style:'bay'}],prices:{},style:'natural'}],baselines:{}};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const results=[];const check=(name,pass,detail='')=>{results.push(pass);console.log((pass?'PASS':'FAIL')+' '+name+(pass?'':'  '+JSON.stringify(detail).slice(0,260)));};
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const [label,root,inject] of [['dist','dist',true],['container','minitool-dist',false]]){
  const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(resolve(root)))throw Error();let bytes=await readFile(p);if(inject&&p===resolve(root,'src/app.js'))bytes=Buffer.concat([bytes,Buffer.from('\nwindow.__acceptance={get scene(){return scene},get plan(){return plan}};')]);res.writeHead(200,{'Content-Type':types[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await context.addInitScript(([k,v])=>{try{localStorage.setItem(k,v)}catch(e){}},['roomish-project-15-v1',JSON.stringify(seed)]);
  const page=await context.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.waitForTimeout(inject?800:2400);
  if(inject){
    // select the existing bay window via the app's own selector
    await page.evaluate(()=>window.__acceptance.scene.cb.select({kind:'room',id:'roomA',openingId:'win1'}));
    await page.waitForTimeout(400);
    await page.locator('#mobile-context [data-action="opening-size"]:visible').first().tap({timeout:5000});
    await page.waitForTimeout(400);
    const panel=await page.evaluate(()=>{
      const f=document.querySelector('#opening-form');
      return {hasOpeningForm:!!f,roomFormGone:!document.querySelector('#room-form'),title:document.querySelector('#inspector h3')?.textContent,editId:f?.dataset.editId,w:f?.elements.w?.value,style:f?.elements.style?.value,backBtn:!!document.querySelector('[data-action="back-to-room"]')};
    });
    check(label+': selecting the window opens its own panel (not room settings)',panel.hasOpeningForm&&panel.roomFormGone&&panel.title==='飘窗'&&panel.editId==='win1'&&panel.w==='1.4'&&panel.style==='bay'&&panel.backBtn,panel);
    // resize via the panel and submit
    await page.evaluate(()=>{const f=document.querySelector('#opening-form');f.elements.w.value='2';f.querySelector('button[type="submit"]').click();});
    await page.waitForTimeout(500);
    const saved=await page.evaluate(()=>window.__acceptance.plan.openings[0].w);
    check(label+': width edit applies to the window',saved===2,saved);
    // back to room settings
    await page.locator('.inspector [data-action="back-to-room"]').first().tap({timeout:5000});
    await page.waitForTimeout(400);
    const roomPanel=await page.evaluate(()=>({roomForm:!!document.querySelector('#room-form'),editIdCleared:!document.querySelector('#opening-form[data-edit-id]'),title:document.querySelector('#inspector h3')?.textContent}));
    check(label+': back-to-room returns to room settings',roomPanel.roomForm&&roomPanel.editIdCleared&&roomPanel.title==='客厅',roomPanel);
    // list edit button jumps to the opening panel
    await page.evaluate(()=>{document.querySelector('.opening-list [data-action="edit-opening"]').click();});
    await page.waitForTimeout(400);
    const backToOpening=await page.evaluate(()=>({openingForm:!!document.querySelector('#opening-form'),editId:document.querySelector('#opening-form')?.dataset.editId}));
    check(label+': list edit button opens the opening panel',backToOpening.openingForm&&backToOpening.editId==='win1',backToOpening);
    // delete from the opening panel
    await page.evaluate(()=>{document.querySelector('.inspector [data-action="delete-opening"]').click();});
    await page.waitForTimeout(500);
    const afterDelete=await page.evaluate(()=>({openings:window.__acceptance.plan.openings.length,roomForm:!!document.querySelector('#room-form')}));
    check(label+': delete from opening panel removes it and falls back to room',afterDelete.openings===0&&afterDelete.roomForm,afterDelete);
  }else{
    // container: place a window from the library, panel should show the opening form right after
    await page.locator('#mobile-launch [data-action="tab-furniture"]:visible').first().tap({timeout:5000});
    await page.waitForTimeout(400);
    await page.locator('.categories [data-action="category"][data-id="门窗"]:visible').first().tap({timeout:5000});
    await page.waitForTimeout(300);
    await page.locator('.opening-card[data-action="add-window"][data-style="floor"]:visible').first().tap({timeout:5000});
    await page.waitForTimeout(400);
    const wallTap=await page.evaluate(()=>{const r=document.querySelector('#viewport').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height*.5};});
    await page.touchscreen.tap(wallTap.x,wallTap.y);
    await page.waitForTimeout(500);
    await page.locator('#mobile-context [data-action="opening-size"]:visible').first().tap({timeout:5000});
    await page.waitForTimeout(400);
    const panel=await page.evaluate(()=>{const f=document.querySelector('#opening-form');return{openingForm:!!f,roomFormGone:!document.querySelector('#room-form'),title:document.querySelector('#inspector h3')?.textContent};});
    check(label+': after placing, panel shows the opening editor',panel.openingForm&&panel.roomFormGone,panel);
  }
  check(label+': no pageerrors',errs.length===0,errs.slice(0,2));
  await page.screenshot({path:resolve(`artifacts/budget-audit-20260927/opening-panel-${label}.png`)});
  await context.close();await server.close();
}
console.log(results.every(Boolean)?'ALL OPENING-PANEL CHECKS PASSED':'FAILURES');
await browser.close();process.exit(results.every(Boolean)?0:1);
