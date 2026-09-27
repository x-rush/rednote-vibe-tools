// Minimal drag protocol bisect: down → synthetic moves → real catch-up → up.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const serve=(root)=>{const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();let bytes=await readFile(p);if(p===resolve(root,'src/app.js'))bytes=Buffer.concat([bytes,Buffer.from('\nwindow.__acceptance={get scene(){return scene},get plan(){return plan}};')]);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});return server;};
const server=serve(resolve('dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>console.log('[pageerror]',e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__acceptance?.scene?.plan);await page.waitForTimeout(500);
const room=await page.evaluate(()=>window.__acceptance.plan.rooms[0]);
const project=async(x,z,y)=>page.evaluate(async({x,z,y})=>{const T=await import('./src/vendor/package/build/three.module.js'),{viewportRect}=await import('./src/orientation.js'),s=window.__acceptance.scene,r=viewportRect(s.renderer.domElement),p=new T.Vector3(x,y,z).project(s.camera);return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},{x,z,y});
await page.evaluate(id=>window.__acceptance.scene.cb.select({kind:'room',id}),room.id);
await page.waitForTimeout(300);
await page.locator('#mobile-context [data-action="add-window"]:visible').first().tap({timeout:5000});
const east=await project(room.x+room.w,room.z+1.2,0.35);
await page.touchscreen.tap(east.x,east.y);
await page.waitForTimeout(300);
const off=await page.evaluate(()=>window.__acceptance.plan.openings.filter(o=>o.type==='window'&&o.side==='east')[0].offset);
const startP=await project(room.x+room.w,room.z+off,0.35);
console.log('placed offset:',off,'start:',startP);
// minimal verify-style protocol
await page.mouse.move(startP.x,startP.y);
await page.mouse.down();
await page.waitForTimeout(120);
console.log('engaged:',await page.evaluate(()=>document.body.classList.contains('dragging-door')));
await page.evaluate(()=>{
  window.__dbg=[];
  window.__ptr=new Set();
  const vp=document.getElementById('viewport');
  vp.addEventListener('pointerdown',e=>window.__ptr.add(e.pointerId),true);
  vp.addEventListener('pointerup',e=>window.__ptr.delete(e.pointerId),true);
  vp.addEventListener('pointercancel',e=>window.__ptr.delete(e.pointerId),true);
  const s=window.__acceptance.scene;
  if(!s.__origHit){s.__origHit=s.hit;s.hit=function(e){let h;try{h=s.__origHit(e);}catch(err){window.__dbg.push(['hit THREW',String(err)]);throw err;}window.__dbg.push(['hit',h&&h.object?(h.object.userData.kind||h.object.userData.id):'null',h&&h.point?{x:+h.point.x.toFixed(2),y:+h.point.y.toFixed(2),z:+h.point.z.toFixed(2)}:null]);return h;};}
  if(!s.__origPreview){s.__origPreview=s.previewOpening;s.previewOpening=(o,valid)=>{if(valid)window.__lastValid=o.offset;window.__dbg.push(['preview',o.side,o.offset,valid]);return s.__origPreview(o,valid);};}
});
// closed-loop drag with projection-bias correction: dispatch, read actual hit z, adapt
let cur=off,lastPt=startP,bias=0;
for(let i=1;i<=16;i++){
  const desired=Math.min(off+0.28*i,2.05); // stay clear of the door exclusion zone (~2.17); first step ≥8px from the down anchor
  const pz=desired+bias;
  const pt=await project(room.x+room.w,room.z+pz,0.35);
  await page.evaluate(({x,y})=>{document.getElementById('viewport').dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x,clientY:y,buttons:1,isPrimary:true,bubbles:true}));},{x:pt.x,y:pt.y});
  const last=await page.evaluate(()=>window.__dbg[window.__dbg.length-1]);
  if(last&&last[0]==='hit'&&last[2]&&Math.abs(last[2].x-room.x-room.w)<0.25)bias=pz-last[2].z;
  const lastValid=await page.evaluate(()=>window.__lastValid??null);
  console.log(`  step${i}: pz=${pz.toFixed(2)} hitZ=${last&&last[2]?last[2].z:'n/a'} hitKind=${last?last[1]:'-'} lastValid=${lastValid}`);
  if(lastValid!==null&&lastValid>cur){cur=lastValid;lastPt=pt;}
  if(cur>=1.7)break;
}
console.log('ptr mirror size:',await page.evaluate(()=>window.__ptr.size));
console.log('closed-loop reached offset:',cur);
await page.mouse.move(lastPt.x,lastPt.y,{steps:1});
await page.mouse.up();
await page.waitForTimeout(400);
console.log('offset after:',await page.evaluate(()=>window.__acceptance.plan.openings.filter(o=>o.type==='window'&&o.side==='east')[0].offset));
await browser.close();await server.close();
