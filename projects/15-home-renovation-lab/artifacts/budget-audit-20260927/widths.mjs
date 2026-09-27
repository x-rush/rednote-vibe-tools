// Multi-width sanity: 375/390/430 — view dropdown with the new item, window dock buttons, host overlay.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=resolve('artifacts/budget-audit-20260927');
const serve=(root,inject)=>{const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();let bytes=await readFile(p);if(inject&&p===resolve(root,'src/app.js'))bytes=Buffer.concat([bytes,Buffer.from('\nwindow.__acceptance={get scene(){return scene},get plan(){return plan}};')]);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});return server;};
const browser=await chromium.launch({channel:'chrome',headless:true});
const catalog=JSON.parse(await readFile(resolve('src/content/content.json'),'utf8'));
let ok=true;
for(const width of [375,390,430]){
  for(const [label,root,inject] of [['dist','dist',true],['container','minitool-dist',false]]){
    const server=serve(resolve(root),inject);await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const page=await context.newPage();
    const errs=[];page.on('pageerror',e=>errs.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
    await page.waitForTimeout(inject?600:2200);
    // host buttons overlay
    await page.evaluate(()=>{const mk=side=>{const d=document.createElement('div');d.style.cssText='position:fixed;top:6px;'+side+':6px;width:52px;height:52px;background:#0008;z-index:9999';document.body.appendChild(d);};mk('left');mk('right');});
    await page.locator('.mobile-view-access [data-action="toggle-views"]:visible').first().tap({timeout:5000}).catch(()=>ok=false);
    await page.waitForTimeout(250);
    const dropdown=await page.evaluate(()=>{
      const hit=el=>{const r=el.getBoundingClientRect();if(!r.width)return false;const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return el===top||el.contains(top);};
      return [...document.querySelectorAll('.view-toolbar button')].filter(b=>b.offsetParent).map(b=>({a:b.dataset.action,ok:hit(b)}));
    });
    const ddOk=dropdown.length===4&&dropdown.every(d=>d.ok);
    const noScroll=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth);
    if(!ddOk||!noScroll||errs.length)ok=false;
    console.log(`${width}/${label}: dropdown=${JSON.stringify(dropdown)} noHScroll=${noScroll} errors=${errs.length}`);
    await page.screenshot({path:`${out}/widths-${width}-${label}.png`});
    await context.close();await server.close();
  }
}
console.log(ok?'WIDTH CHECKS PASSED':'WIDTH CHECKS FAILED');
await browser.close();
process.exit(ok?0:1);
