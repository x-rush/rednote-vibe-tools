// Probe: does the container build (BudgetScene) fall back to FlatScene for default templates?
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve('minitool-dist');
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();const bytes=await readFile(p);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  for(const vp of [{width:390,height:844},{width:1280,height:800}]){
    const context=await browser.newContext({viewport:vp,isMobile:vp.width<800,hasTouch:vp.width<800,deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
    const samples=[];
    for(let i=0;i<10;i++){
      await page.waitForTimeout(700);
      samples.push(await page.evaluate(()=>JSON.parse(JSON.stringify(window.ROOMISH_RENDER_STATS||null))));
    }
    // try entering the experience via the view menu
    let walkResult=null;
    try{
      await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap({timeout:4000});
      await page.locator('[data-action="inside"]:visible').first().tap({timeout:4000});
      await page.waitForTimeout(800);
      walkResult=await page.evaluate(()=>({stats:window.ROOMISH_RENDER_STATS||null,walkingClass:document.body.classList.contains('walking'),toast:document.querySelector('#toast')?.textContent}));
    }catch(e){walkResult={error:String(e).split('\n')[0],stats:await page.evaluate(()=>window.ROOMISH_RENDER_STATS||null)};}
    console.log('VIEWPORT',JSON.stringify(vp));
    console.log('samples:',samples.map(s=>s&&`${s.renderer||'3d'}/t${s.tier}/c${s.calls}/tri${s.triangles}`).join(' | '));
    console.log('walkResult:',JSON.stringify(walkResult));
    if(errors.length)console.log('pageerrors:',errors.slice(0,3));
    await context.close();
  }
}catch(e){console.error('HARNESS FAIL',e);}
finally{await browser.close();server.close();}
