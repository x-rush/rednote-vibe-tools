// Stress: big plan in container build + wall-flatten behavior in module build.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const KEY='roomish-project-15-v1';

function makeBigPlan(catalog){
  // 10-room plan cloned from 'family' template footprint, furniture-dense.
  const fam=catalog.templates.find(t=>t.id==='family');
  const rooms=[],items=[],openings=[];let cursorX=0;
  const ids=()=>Math.random().toString(36).slice(2,10);
  for(let i=0;i<10;i++){
    const w=4.2,d=3.8;
    const room={id:ids(),name:'房间'+(i+1),x:cursorX,z:0,w,d,kind:i%3===0?'living':i%3===1?'bedroom':'study',measured:true,floor:'oak',wall:'cream',textureScale:1,textureAngle:0};
    rooms.push(room);
    const defs=['sofa','bed','wardrobe','desk','chair','plant','rug','lamp','bookcase','cabinet','armchair','nightstand'];
    defs.forEach((id,k)=>{
      const def=catalog.furniture.find(f=>f.id===id);if(!def)return;
      const x=room.x+.5+k*.3,z=room.z+.5+(k%3)*.9;
      items.push({id:ids(),catalogId:id,roomId:room.id,x:Math.round((x)*10)/10,z:Math.round(z*10)/10,w:def.w,d:def.d,h:def.h,color:def.color,angle:0});
    });
    if(i<9)openings.push({id:ids(),roomId:room.id,side:'east',offset:1.9,w:.9,h:2.15,sill:0,type:'door'});
    openings.push({id:ids(),roomId:room.id,side:'north',offset:2.1,w:1.4,h:1.2,sill:.9,type:'window'});
    cursorX+=w;
  }
  return {schemaVersion:1,id:ids(),name:'压力测试',mode:'beginner',wallHeight:2.65,wallHeightMeasured:true,wallThickness:.14,buildingArea:null,updatedAt:Date.now(),rooms,items,openings,prices:{},style:'natural'};
}

const serve=(root)=>{const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(p)]||'application/octet-stream'});res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});return server;};

const catalog=JSON.parse(await readFile(resolve('src/content/content.json'),'utf8'));
const big=makeBigPlan(catalog);
const seed=JSON.stringify({active:big.id,plans:[big],baselines:{}});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  for(const [label,root] of [['container','minitool-dist'],['module','dist']]){
    const server=serve(resolve(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    await context.addInitScript(([k,v])=>{try{localStorage.setItem(k,v)}catch(e){}},[KEY,seed]);
    const page=await context.newPage();
    const errs=[];page.on('pageerror',e=>errs.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
    await page.waitForTimeout(2500);
    const stats1=await page.evaluate(()=>window.ROOMISH_RENDER_STATS||null);
    const scene1=await page.evaluate(()=>{const s=window.__acceptance?.scene;return s?{isFlat:!!s.ctx&&!!s.canvas&&!!s.draw,renderer:s.renderer?'webgl':'flat?'}:null;}).catch(()=>null);
    // module build: expose scene via same hook as acceptance
    const wallInfo=await page.evaluate(()=>{
      const s=window.__acceptance?.scene;if(!s||!s.wallGroups)return null;
      return {cameraY:s.camera.position.y,viewType:s.viewType,walls:s.wallGroups.map(w=>+w.g.scale.y.toFixed(3)).slice(0,8)};
    }).catch(()=>null);
    console.log(`[${label}] stats after load:`,JSON.stringify(stats1),'scene:',JSON.stringify(scene1),'walls:',JSON.stringify(wallInfo),'errors:',errs.slice(0,2));
    // switch to top view
    await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap({timeout:4000}).catch(()=>{});
    await page.locator('[data-action="top"]:visible').first().tap({timeout:4000}).catch(()=>{});
    await page.waitForTimeout(1200);
    const afterTop=await page.evaluate(()=>{const s=window.__acceptance?.scene;if(!s)return null;return {cameraY:+s.camera.position.y.toFixed(1),stats:window.ROOMISH_RENDER_STATS||null,walls:s.wallGroups?s.wallGroups.map(w=>+w.g.scale.y.toFixed(3)).slice(0,8):null};}).catch(()=>null);
    console.log(`[${label}] after top view:`,JSON.stringify(afterTop));
    // walk attempt
    await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap({timeout:4000}).catch(()=>{});
    await page.locator('[data-action="inside"]:visible').first().tap({timeout:4000}).catch(()=>{});
    await page.waitForTimeout(900);
    const walk=await page.evaluate(()=>({walking:document.body.classList.contains('walking'),toast:document.querySelector('#toast')?.textContent,stats:window.ROOMISH_RENDER_STATS||null}));
    console.log(`[${label}] walk attempt:`,JSON.stringify(walk));
    await page.screenshot({path:resolve(`artifacts/budget-audit-20260927/stress-${label}.png`)});
    await context.close();await server.close();
  }
}catch(e){console.error('HARNESS FAIL',e);}
finally{await browser.close();}
