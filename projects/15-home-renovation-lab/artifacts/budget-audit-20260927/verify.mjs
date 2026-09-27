// Post-fix verification: wall rules, full-wall toggle, window placement/drag,
// walk entry, container budget behavior, host-button overlay safety.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=resolve('artifacts/budget-audit-20260927');
const serve=(root,inject)=>{const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();let bytes=await readFile(p);if(inject&&p===resolve(root,'src/app.js'))bytes=Buffer.concat([bytes,Buffer.from('\nwindow.__acceptance={get scene(){return scene},get plan(){return plan}};')]);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});return server;};
const catalog=JSON.parse(await readFile(resolve('src/content/content.json'),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
const check=(name,pass,details='')=>{results.push({name,pass,details});console.log((pass?'PASS':'FAIL')+' '+name+(details?'  '+JSON.stringify(details):''));};

function makeBigPlan(){
  const ids=()=>Math.random().toString(36).slice(2,10);const rooms=[],items=[],openings=[];let cursorX=0;
  for(let i=0;i<10;i++){const w=4.2,d=3.8;const room={id:ids(),name:'房间'+(i+1),x:cursorX,z:0,w,d,kind:i%3===0?'living':i%3===1?'bedroom':'study',measured:true,floor:'oak',wall:'cream',textureScale:1,textureAngle:0};rooms.push(room);
    for(const id of ['sofa','bed','wardrobe','desk','chair','plant','rug','lamp','bookcase','cabinet','armchair','nightstand']){const def=catalog.furniture.find(f=>f.id===id);if(!def)continue;items.push({id:ids(),catalogId:id,roomId:room.id,x:Math.round((room.x+.5+(items.length%12)*.3)*10)/10,z:Math.round((.5+(items.length%3)*.9)*10)/10,w:def.w,d:def.d,h:def.h,color:def.color,angle:0});}
    if(i<9)openings.push({id:ids(),roomId:room.id,side:'east',offset:1.9,w:.9,h:2.15,sill:0,type:'door'});
    openings.push({id:ids(),roomId:room.id,side:'north',offset:2.1,w:1.4,h:1.2,sill:.9,type:'window'});
    cursorX+=w;}
  return {schemaVersion:1,id:ids(),name:'压力测试',mode:'beginner',wallHeight:2.65,wallHeightMeasured:true,wallThickness:.14,buildingArea:null,updatedAt:Date.now(),rooms,items,openings,prices:{},style:'natural'};
}
const big=makeBigPlan();
const seed=JSON.stringify({active:big.id,plans:[big],baselines:{}});

// ---------- Part A: container build, big plan ----------
{
  const server=serve(resolve('minitool-dist'),false);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await context.addInitScript(([k,v])=>{try{localStorage.setItem(k,v)}catch(e){}},['roomish-project-15-v1',seed]);
  const page=await context.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  const samples=[];for(let i=0;i<9;i++){await page.waitForTimeout(800);samples.push(await page.evaluate(()=>window.ROOMISH_RENDER_STATS||null));}
  const flat=samples.some(s=>s&&s.renderer==='canvas2d');
  check('container big plan stays 3D',!flat,{samples:samples.map(s=>s&&`t${s.tier}/c${s.calls}`).join(',')});
  await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap({timeout:5000}).catch(()=>{});
  await page.locator('[data-action="inside"]:visible').first().tap({timeout:5000}).catch(()=>{});
  await page.waitForTimeout(800);
  const walk=await page.evaluate(()=>({walking:document.body.classList.contains('walking'),toast:document.querySelector('#toast')?.textContent}));
  check('container big plan walk entry works',walk.walking,{toast:walk.toast});
  await page.screenshot({path:out+'/container-big-walk.png'});
  check('container no pageerrors',errs.length===0,errs.slice(0,2));
  await context.close();await server.close();
}
// ---------- Part B: container build, default template, UI features ----------
{
  const server=serve(resolve('minitool-dist'),false);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.waitForTimeout(2500);
  const stats=await page.evaluate(()=>window.ROOMISH_RENDER_STATS||null);
  check('container default template 3D',stats&&stats.renderer!=='canvas2d',stats);
  // full-wall toggle in view dropdown
  await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap();
  const items=await page.locator('.view-toolbar button:visible').allTextContents();
  check('view dropdown has full-wall item',items.some(t=>t.includes('墙')),items);
  await page.locator('[data-action="full-walls"]:visible').first().tap();
  await page.waitForTimeout(600);
  await page.screenshot({path:out+'/container-fullwalls.png'});
  // add window via dock (select the room first by tapping its center)
  const roomC=await page.evaluate(async()=>{const T=await import('./assets/app.js').catch(()=>null);return null;})||null;
  const centerB=await page.evaluate(async()=>{const s=window.ROOMISH_RENDER_STATS;const r=document.querySelector('#viewport').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.55};});
  await page.touchscreen.tap(centerB.x,centerB.y);await page.waitForTimeout(400);
  await page.locator('#mobile-context [data-action="add-window"]:visible').first().tap({timeout:5000}).catch(async e=>{console.log('add-window dock tap failed: '+e.message.split('\n')[0]);});
  const placing=await page.evaluate(()=>({placingHidden:document.querySelector('#placing')?.hidden,text:document.querySelector('#placing')?.textContent}));
  check('window placement mode opens',placing.placingHidden===false&&placing.text.includes('窗'),placing);
  await page.screenshot({path:out+'/container-window-mode.png'});
  await context.close();await server.close();
}
// ---------- Part C1: dist module build, default full-wall preview + toggle ----------
{
  const server=serve(resolve('dist'),true);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();const errs=[];
  page.on('pageerror',e=>{errs.push(e.message+' :: '+(e.stack||'').split('\n').slice(0,4).join(' | '));console.log('[pageerror]',e.message);});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__acceptance?.scene?.plan);await page.waitForTimeout(400);
  const data1=await page.evaluate(()=>{const s=window.__acceptance.scene;return{camY:+s.camera.position.y.toFixed(1),walls:s.wallGroups.map(w=>({rooms:w.wall.rooms.length,y:+w.g.scale.y.toFixed(3)})),active:document.querySelector('[data-action="full-walls"]')?.classList.contains('active'),label:document.querySelector('[data-action="full-walls"] span')?.textContent};});
  check('boot defaults to full-wall mode (window design ready)',data1.walls.every(w=>w.y===1)&&data1.active===true&&data1.label==='整墙预览',data1);
  // toggle to cutaway preview
  await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap();
  await page.locator('[data-action="full-walls"]:visible').first().tap();
  await page.waitForTimeout(500);
  const data2=await page.evaluate(()=>{const s=window.__acceptance.scene;return{walls:s.wallGroups.map(w=>({rooms:w.wall.rooms.length,y:+w.g.scale.y.toFixed(3)})),label:document.querySelector('[data-action="full-walls"] span')?.textContent,toast:document.querySelector('#toast')?.textContent};});
  check('toggle switches to cutaway (interior walls low, exterior near-side cut)',data2.walls.some(w=>w.rooms===2&&w.y===.23)&&data2.label==='透视矮墙'&&data2.toast==='透视矮墙',data2);
  await page.screenshot({path:out+'/dist-cutaway.png'});
  // toggle back to full walls
  await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap().catch(()=>{});
  await page.locator('[data-action="full-walls"]:visible').first().tap();
  await page.waitForTimeout(400);
  const data3=await page.evaluate(()=>{const s=window.__acceptance.scene;return{walls:s.wallGroups.every(w=>+w.g.scale.y.toFixed(3)===1),label:document.querySelector('[data-action="full-walls"] span')?.textContent};});
  check('toggle restores full-wall mode',data3.walls===true&&data3.label==='整墙预览',data3);
  // zoom out along view direction → polar unchanged → walls must NOT flatten
  await page.evaluate(()=>{const s=window.__acceptance.scene;s.camera.position.multiplyScalar(2.2);s.controls.update();s.dirty=true;});
  await page.waitForTimeout(400);
  const data4=await page.evaluate(()=>{const s=window.__acceptance.scene;return{camY:+s.camera.position.y.toFixed(1),walls:s.wallGroups.map(w=>+w.g.scale.y.toFixed(3))};});
  check('zoomed-out overview keeps 3D walls (was y>30 flatten)',data4.camY>30&&!data4.walls.every(v=>v===.04),data4);
  await page.screenshot({path:out+'/dist-zoomed-overview.png'});
  // top view flattens
  await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap();
  await page.locator('[data-action="top"]:visible').first().tap();
  await page.waitForTimeout(600);
  const data5=await page.evaluate(()=>{const s=window.__acceptance.scene;return{camY:+s.camera.position.y.toFixed(1),walls:s.wallGroups.map(w=>+w.g.scale.y.toFixed(3))};});
  check('top view flattens walls',data5.walls.every(v=>v===.04),data5);
  check('C1 no pageerrors',errs.length===0,errs.slice(0,2));
  await page.screenshot({path:out+'/dist-topview.png'});
  await context.close();await server.close();
}
// ---------- Part C2: dist module build, window types + drag + walk + host overlay ----------
{
  const server=serve(resolve('dist'),true);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await context.addInitScript(([k,v])=>{try{localStorage.setItem(k,v)}catch(e){}},['roomish-project-15-v1',JSON.stringify({active:'seedA',plans:[{schemaVersion:1,id:'seedA',name:'窗型测试',mode:'beginner',wallHeight:2.65,wallHeightMeasured:true,wallThickness:.14,buildingArea:null,updatedAt:Date.now(),rooms:[{id:'roomA',name:'客厅',x:0,z:0,w:6,d:5,kind:'living',measured:true,floor:'oak',wall:'cream',textureScale:1,textureAngle:0},{id:'roomB',name:'卧室',x:6,z:0,w:4,d:5,kind:'bedroom',measured:true,floor:'oak',wall:'cream',textureScale:1,textureAngle:0}],items:[],openings:[],prices:{},style:'natural'}],baselines:{}})]);
  const page=await context.newPage();const errs=[];
  page.on('pageerror',e=>{errs.push(e.message);console.log('[pageerror]',e.message);});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__acceptance?.scene?.plan);await page.waitForTimeout(400);
  const room=await page.evaluate(()=>window.__acceptance.plan.rooms.find(r=>r.id==='roomA'));
  const project=async(x,z,y)=>page.evaluate(async({x,z,y})=>{const T=await import('./src/vendor/package/build/three.module.js'),{viewportRect}=await import('./src/orientation.js'),s=window.__acceptance.scene,r=viewportRect(s.renderer.domElement),p=new T.Vector3(x,y,z).project(s.camera);return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},{x,z,y});
  await page.evaluate(id=>window.__acceptance.scene.cb.select({kind:'room',id}),room.id);
  await page.waitForTimeout(300);
  const placeWindow=async(style,px,pz)=>{
    await page.locator('#mobile-context [data-action="add-window"]:visible').first().tap({timeout:5000});
    await page.waitForTimeout(500);
    if(style!=='casement')await page.locator(`#mobile-context [data-action="win-style"][data-style="${style}"]:visible`).first().tap({timeout:5000});
    const pt=await project(px,pz,0.35);
    await page.touchscreen.tap(pt.x,pt.y);
    await page.waitForTimeout(300);
  };
  await placeWindow('casement',room.x+room.w,1.5);
  await placeWindow('sliding',4.4,room.z);
  await placeWindow('floor',2,room.z);
  await placeWindow('bay',3,room.z+room.d);
  const openings1=await page.evaluate(()=>window.__acceptance.plan.openings.map(o=>({side:o.side,style:o.style,w:o.w,h:Math.round(o.h*100)/100,sill:o.sill})));
  check('all four window types placed with style defaults',openings1.length===4&&openings1.some(o=>o.style==='casement'&&o.w===1.4&&o.sill===.9)&&openings1.some(o=>o.style==='sliding'&&o.w===1.6)&&openings1.some(o=>o.style==='floor'&&o.sill===0&&o.h===2.45)&&openings1.some(o=>o.style==='bay'&&o.w===1.8&&o.sill===.5),openings1);
  // bay window must be rejected on the shared (interior) wall
  await placeWindow('bay',room.x+room.w,.6);
  await page.waitForTimeout(200);
  const bayState=await page.evaluate(()=>({count:window.__acceptance.plan.openings.length,toast:document.querySelector('#toast')?.textContent,placing:document.querySelector('#placing')?.hidden===false}));
  check('bay window rejected on interior wall',bayState.count===4&&bayState.placing===true,bayState);
  await page.locator('#mobile-context [data-action="cancel-door"]:visible').first().tap({timeout:5000});
  await page.waitForTimeout(200);
  await page.screenshot({path:out+'/dist-window-types.png'});
  // drag the floor window along the north wall
  const winBefore=await page.evaluate(()=>window.__acceptance.plan.openings.find(o=>o.style==='floor')?.offset);
  const startP=await project(winBefore,room.z,0.35);
  await page.touchscreen.tap(startP.x,startP.y);
  await page.waitForTimeout(300);
  const preSelected=await page.evaluate(()=>window.__acceptance.scene.selected?.openingId!==null);
  await page.mouse.move(startP.x,startP.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const engaged=await page.evaluate(()=>document.body.classList.contains('dragging-door'));
  await page.evaluate(()=>{const s=window.__acceptance.scene;if(!s.__origPreview){s.__origPreview=s.previewOpening;s.previewOpening=(o,valid)=>{if(valid)window.__lastValid=o.offset;return s.__origPreview(o,valid);};}window.__lastValid=null;});
  let cur=winBefore,lastPt=startP,bias=0;
  for(let i=1;i<=14;i++){
    const desired=Math.min(winBefore+0.28*i,4.9);
    const pz=desired+bias;
    const pt=await project(pz,room.z,0.35);
    await page.evaluate(({x,y})=>{document.getElementById('viewport').dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x,clientY:y,buttons:1,isPrimary:true,bubbles:true}));},{x:pt.x,y:pt.y});
    const lastValid=await page.evaluate(()=>window.__lastValid??null);
    if(lastValid!==null&&lastValid>cur){cur=lastValid;lastPt=pt;}
    const probe=await page.evaluate(async({x,y})=>{const T=await import('./src/vendor/package/build/three.module.js'),{viewportRect}=await import('./src/orientation.js'),s=window.__acceptance.scene,r=viewportRect(s.renderer.domElement);s.mouse.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);s.ray.setFromCamera(s.mouse,s.camera);const h=s.ray.intersectObjects(s.root.children,true).find(o=>o.object.userData.kind&&o.object.visible);return h&&h.point?{x:h.point.x,z:h.point.z}:null;},{x:pt.x,y:pt.y});
    if(probe&&Math.abs(probe.z-room.z)<0.25)bias=pz-probe.x;
    if(cur>=3.2)break;
  }
  await page.mouse.move(lastPt.x,lastPt.y,{steps:1});
  await page.mouse.up();
  await page.waitForTimeout(400);
  const afterDrag=await page.evaluate(()=>window.__acceptance.plan.openings.find(o=>o.style==='floor')?.offset);
  console.log('[drag-instrument] engaged:',engaged,'reached:',cur);
  check('floor window drags along wall',afterDrag!==null&&winBefore!==null&&Math.abs(afterDrag-winBefore)>=.15,{before:winBefore,after:afterDrag});
  // styles survive the save/load validation round-trip
  await page.waitForTimeout(300);
  const persisted=await page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('roomish-project-15-v1'));return db.plans.find(p=>p.id==='seedA').openings.map(o=>({style:o.style||null,side:o.side}));});
  check('window styles persist to local storage',persisted.filter(o=>o.style).length===4,persisted);
  // walk entry + exit
  await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap({timeout:5000}).catch(e=>console.log('toggle fail:',e.message.split('\n')[0]));
  await page.locator('[data-action="inside"]:visible').first().tap({timeout:5000}).catch(e=>console.log('inside fail:',e.message.split('\n')[0]));
  await page.waitForTimeout(700);
  const walking=await page.evaluate(()=>({walking:document.body.classList.contains('walking'),toast:document.querySelector('#toast')?.textContent,viewsOpen:document.body.classList.contains('views-open')}));
  check('module walk entry works',walking.walking,walking);
  await page.screenshot({path:out+'/dist-walk.png'});
  // host overlay safety: exit walk via the real UI, then simulate XHS host buttons
  await page.locator('[data-action="exit-walk"]:visible').first().tap({timeout:5000}).catch(e=>console.log('exit-walk fail:',e.message.split('\n')[0]));
  await page.waitForTimeout(600);
  await page.evaluate(()=>{const mk=(side)=>{const d=document.createElement('div');d.id='host-sim';d.style.cssText='position:fixed;top:6px;'+side+':6px;width:52px;height:52px;border-radius:14px;background:#0008;z-index:9999;pointer-events:auto';document.body.appendChild(d);};mk('left');mk('right');});
  const reach=await page.evaluate(()=>{
    const hit=el=>{const r=el.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;const top=document.elementFromPoint(cx,cy);return el===top||el.contains(top)||top?.contains(el);};
    const toggle=document.querySelector('.mobile-view-access [data-action="toggle-views"]');
    return {toggle:toggle?hit(toggle):false,rect:toggle?toggle.getBoundingClientRect().toJSON():null};
  });
  check('toggle-views clear of simulated host button',reach.toggle,reach.rect);
  await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap().catch(()=>{});
  const dropdown=await page.evaluate(()=>{
    const hit=el=>{const r=el.getBoundingClientRect();if(!r.width)return false;const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return el===top||el.contains(top);};
    return [...document.querySelectorAll('.view-toolbar button')].filter(b=>b.offsetParent).map(b=>({action:b.dataset.action,ok:hit(b)}));
  });
  check('dropdown items clear of host overlay',dropdown.length===4&&dropdown.every(d=>d.ok),dropdown);
  check('module no pageerrors',errs.length===0,errs.slice(0,2));
  await context.close();await server.close();
}
await writeFile(out+'/verify-results.json',JSON.stringify(results,null,1));
const failed=results.filter(r=>!r.pass);
console.log(failed.length?`FAILURES: ${failed.length}`:'ALL CHECKS PASSED');
await browser.close();
process.exit(failed.length?1:0);
