import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();const bytes=await readFile(p);res.writeHead(200,{'Content-Type':types[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
await page.waitForTimeout(800);
await page.evaluate(()=>{document.querySelector('#mobile-launch [data-action="tab-furniture"]').click();});
await page.waitForTimeout(400);
await page.evaluate(()=>{document.querySelector('.categories [data-action="category"][data-id="门窗"]').click();});
await page.waitForTimeout(500);
await page.screenshot({path:resolve('artifacts/budget-audit-20260927/opening-cards-full.png')});
const stats=await page.evaluate(async()=>await Promise.all([...document.querySelectorAll('#furniture-grid .opening-card')].map(async c=>{
  const img=c.querySelector('img');const row={name:c.querySelector('strong').textContent,w:img?img.naturalWidth:0};
  if(img&&img.naturalWidth){const cc=document.createElement('canvas');cc.width=img.naturalWidth;cc.height=img.naturalHeight;const x=cc.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,cc.width,cc.height).data;let opaque=0,buckets=new Set();for(let i=0;i<d.length;i+=4){if(d[i+3]>40){opaque++;buckets.add((d[i]>>5)+','+(d[i+1]>>5)+','+(d[i+2]>>5));}}row.fillPct=Math.round(opaque/(d.length/4)*100);row.buckets=buckets.size;}
  return row;
})));
console.log(JSON.stringify(stats));
await browser.close();server.close();process.exit(0);
