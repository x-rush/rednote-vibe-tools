// Opening cards in the furniture library (no pre-selected room) + portrait host clearance.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=resolve('artifacts/budget-audit-20260927');
const serve=(root,inject)=>{const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();let bytes=await readFile(p);if(inject&&p===resolve(root,'src/app.js'))bytes=Buffer.concat([bytes,Buffer.from('\nwindow.__acceptance={get scene(){return scene},get plan(){return plan}};')]);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});return server;};
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
const check=(name,pass,details='')=>{results.push({name,pass});console.log((pass?'PASS':'FAIL')+' '+name+(pass?'':'  '+JSON.stringify(details).slice(0,260)));};
const seed={active:'seedA',plans:[{schemaVersion:1,id:'seedA',name:'入口测试',mode:'beginner',wallHeight:2.65,wallHeightMeasured:true,wallThickness:.14,buildingArea:null,updatedAt:Date.now(),rooms:[{id:'roomA',name:'客厅',x:0,z:0,w:6,d:5,kind:'living',measured:true,floor:'oak',wall:'cream',textureScale:1,textureAngle:0}],items:[],openings:[],prices:{},style:'natural'}],baselines:{}};
for(const [label,root,inject] of [['dist','dist',true],['container','minitool-dist',false]]){
  const server=serve(resolve(root),inject);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  for(const width of [375,390,430]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    await context.addInitScript(([k,v])=>{try{localStorage.setItem(k,v)}catch(e){}},['roomish-project-15-v1',JSON.stringify(seed)]);
    const page=await context.newPage();
    const errs=[];page.on('pageerror',e=>errs.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
    await page.waitForTimeout(inject?600:2200);
    // host overlay: 52px rounded squares at both top corners
    await page.evaluate(()=>{const mk=side=>{const d=document.createElement('div');d.id='host-'+side;d.style.cssText='position:fixed;top:6px;'+side+':6px;width:52px;height:52px;border-radius:14px;background:#0007;z-index:99999';document.body.appendChild(d);};mk('left');mk('right');});
    const overlap=await page.evaluate(()=>{
      const intersect=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
      const hostL=document.getElementById('host-left').getBoundingClientRect(),hostR=document.getElementById('host-right').getBoundingClientRect();
      return [...document.querySelectorAll('.topbar button')].filter(b=>b.offsetParent&&b.getBoundingClientRect().width).map(b=>{const r=b.getBoundingClientRect();return {action:b.dataset.action,rect:{l:r.left|0,r:r.right|0},hitL:intersect(r,hostL),hitR:intersect(r,hostR)};});
    });
    check(`${label}/${width}: topbar buttons clear of host overlay`,overlap.length>0&&overlap.every(o=>!o.hitL&&!o.hitR),overlap);
    if(inject&&width===390){
      // no selection → furniture library → 门窗 category → bay window card → tap north wall
      const noSelection=await page.evaluate(()=>window.__acceptance.scene.selected===null);
      check('dist/390: starts with no selection',noSelection);
      await page.locator('#mobile-launch [data-action="tab-furniture"]:visible').first().tap();
      await page.waitForTimeout(300);
      const cats=await page.evaluate(()=>[...document.querySelectorAll('.categories button')].map(b=>b.textContent));
      check('dist/390: 门窗 category present',cats.includes('门窗'),cats);
      await page.locator('.categories [data-action="category"][data-id="门窗"]:visible').first().tap();
      await page.waitForTimeout(200);
      const cards=await page.evaluate(()=>[...document.querySelectorAll('#furniture-grid .opening-card')].map(c=>({action:c.dataset.action,style:c.dataset.style||'',name:c.querySelector('strong').textContent})));
      check('dist/390: opening cards rendered (door + 4 window types)',cards.length===5&&cards.some(c=>c.action==='add-door')&&['casement','sliding','floor','bay'].every(s=>cards.some(c=>c.style===s)),cards);
      await page.locator('.opening-card[data-action="add-window"][data-style="bay"]:visible').first().tap();
      await page.waitForTimeout(400);
      const placing=await page.evaluate(()=>({hidden:document.querySelector('#placing')?.hidden,bodyPlacing:document.body.classList.contains('placing-door'),drawer:document.body.classList.contains('drawer-open')}));
      const noChips=await page.evaluate(()=>({dockChips:document.querySelectorAll('#mobile-context [data-action="win-style"]').length,placingChips:document.querySelectorAll('#placing [data-action="win-style"]').length}));
      check('dist/390: no style switcher during placement (card picks the type)',noChips.dockChips===0&&noChips.placingChips===0,noChips);
      check('dist/390: bay placement mode opens without room selection',placing.hidden===false&&placing.bodyPlacing===true&&placing.drawer===false,placing);
      const room=await page.evaluate(()=>window.__acceptance.plan.rooms[0]);
      const pt=await page.evaluate(async({x,z,y})=>{const T=await import('./src/vendor/package/build/three.module.js'),{viewportRect}=await import('./src/orientation.js'),s=window.__acceptance.scene,r=viewportRect(s.renderer.domElement),p=new T.Vector3(x,y,z).project(s.camera);return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},{x:room.x+4.8,z:room.z,y:.9});
      await page.touchscreen.tap(pt.x,pt.y);
      await page.waitForTimeout(300);
      const openings=await page.evaluate(()=>window.__acceptance.plan.openings.map(o=>({type:o.type,style:o.style,side:o.side,roomId:o.roomId})));
      check('dist/390: bay window placed on an exterior wall with room auto-resolved',openings.length===1&&openings[0].style==='bay'&&['north','east'].includes(openings[0].side)&&openings[0].roomId==='roomA',openings);
      await page.screenshot({path:out+`/entry-${label}-${width}.png`});
      // legacy entries removed: dock no longer shows add-door for a selected room
      await page.evaluate(()=>window.__acceptance.scene.cb.select({kind:'room',id:'roomA'}));
      await page.waitForTimeout(300);
      const dock=await page.evaluate(()=>document.getElementById('mobile-context').innerHTML);
      check('dist/390: dock no longer duplicates opening entries',!dock.includes('add-door')&&!dock.includes('add-window'));
    }
    if(!inject&&width===390){
      await page.locator('#mobile-launch [data-action="tab-furniture"]:visible').first().tap();
      await page.waitForTimeout(300);
      await page.locator('.categories [data-action="category"][data-id="门窗"]:visible').first().tap();
      await page.waitForTimeout(200);
      const cards=await page.evaluate(()=>[...document.querySelectorAll('#furniture-grid .opening-card')].map(c=>({action:c.dataset.action,style:c.dataset.style||''})));
      check('container/390: opening cards rendered',cards.length===5,cards);
      await page.locator('.opening-card[data-action="add-window"][data-style="bay"]:visible').first().tap();
      await page.waitForTimeout(400);
      const placing=await page.evaluate(()=>({hidden:document.querySelector('#placing')?.hidden,text:document.querySelector('#placing')?.textContent}));
      check('container/390: bay placement mode opens',placing.hidden===false&&placing.text.includes('窗'),placing);
      await page.screenshot({path:out+`/entry-${label}-${width}.png`});
    }
    check(`${label}/${width}: no pageerrors`,errs.length===0,errs.slice(0,2));
    await context.close();
  }
  await server.close();
}
const failed=results.filter(r=>!r.pass);
console.log(failed.length?'FAILURES: '+failed.length:'ALL ENTRY CHECKS PASSED');
await import('node:fs').then(async fs=>{await fs.promises.writeFile(out+'/entry-results.json',JSON.stringify(results,null,1));});
await browser.close();
process.exit(failed.length?1:0);
