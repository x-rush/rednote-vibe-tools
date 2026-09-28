// Delete-room discoverability + flow; opening size panel presence.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const seed={active:'seedA',plans:[{schemaVersion:1,id:'seedA',name:'删除测试',mode:'beginner',wallHeight:2.65,wallHeightMeasured:true,wallThickness:.14,buildingArea:null,updatedAt:Date.now(),rooms:[{id:'roomA',name:'客厅',x:0,z:0,w:6,d:5,kind:'living',measured:true,floor:'oak',wall:'cream',textureScale:1,textureAngle:0},{id:'roomB',name:'卧室',x:6,z:0,w:4,d:5,kind:'bedroom',measured:true,floor:'oak',wall:'cream',textureScale:1,textureAngle:0}],items:[],openings:[],prices:{},style:'natural'}],baselines:{}};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const results=[];const check=(name,pass,detail='')=>{results.push(pass);console.log((pass?'PASS':'FAIL')+' '+name+(pass?'':'  '+JSON.stringify(detail).slice(0,200)));};
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const [label,root] of [['dist','dist'],['container','minitool-dist']]){
  const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(resolve(root)))throw Error();let bytes=await readFile(p);if(label==='dist'&&p===resolve(root,'src/app.js'))bytes=Buffer.concat([bytes,Buffer.from('\nwindow.__acceptance={get scene(){return scene},get plan(){return plan}};')]);res.writeHead(200,{'Content-Type':types[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await context.addInitScript(([k,v])=>{try{localStorage.setItem(k,v)}catch(e){}},['roomish-project-15-v1',JSON.stringify(seed)]);
  const page=await context.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.waitForTimeout(label==='dist'?800:2400);
  // select room A via canvas-independent path: tap room name chip is hidden on mobile; use scene callback only in dist; container: tap room center
  // open properties: tap the room center to select it (both builds render rooms)
  const center=await page.evaluate(()=>{const r=document.querySelector('#viewport').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height*.45};});
  await page.touchscreen.tap(center.x,center.y);await page.waitForTimeout(300);
  await page.locator('#mobile-context [data-action="room-properties"]:visible').first().tap({timeout:5000});
  await page.waitForTimeout(400);
  const layout=await page.evaluate(()=>{
    const del=document.querySelector('.inspector [data-action="delete-room"]'),form=document.querySelector('#room-form'),openings=document.querySelector('#opening-form');
    return {hasDelete:!!del,deleteAboveForm:!!del&&!!form&&del.getBoundingClientRect().top<form.getBoundingClientRect().top,disabled:del?.disabled,hasOpeningForm:!!openings};
  });
  check(label+': delete-room visible above the form in properties',layout.hasDelete&&layout.deleteAboveForm,layout);
  check(label+': opening size form present (same panel)',layout.hasOpeningForm,layout);
  // delete the room (confirm auto-accepted)
  const before=await page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('roomish-project-15-v1'));return db.plans.find(p=>p.id===db.active).rooms.length;});
  await page.locator('.inspector [data-action="delete-room"]:visible').first().tap({timeout:5000});
  await page.waitForTimeout(500);
  const after=await page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('roomish-project-15-v1'));return db.plans.find(p=>p.id===db.active).rooms.length;});
  check(label+': delete-room removes the room after confirm',after===before-1,{before,after});
  // last remaining room: button disabled
  if(label==='dist'){
    await page.evaluate(()=>{const s=window.__acceptance.scene,p=window.__acceptance.plan;s.cb.select({kind:'room',id:p.rooms[0].id});});
    await page.waitForTimeout(400);
    await page.locator('#mobile-context [data-action="room-properties"]:visible').first().tap({timeout:5000});
    await page.waitForTimeout(400);
    const disabled=await page.evaluate(()=>({open:document.body.classList.contains('mobile-properties'),disabled:document.querySelector('.inspector [data-action="delete-room"]')?.disabled}));
    check(label+': delete disabled for the last room',disabled.open===true&&disabled.disabled===true,disabled);
  }
  check(label+': no pageerrors',errs.length===0,errs.slice(0,2));
  await page.screenshot({path:resolve(`artifacts/budget-audit-20260927/delete-${label}.png`)});
  await context.close();await server.close();
}
console.log(results.every(Boolean)?'ALL DELETE-ROOM CHECKS PASSED':'FAILURES');
await browser.close();process.exit(results.every(Boolean)?0:1);
