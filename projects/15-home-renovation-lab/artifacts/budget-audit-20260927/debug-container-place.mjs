import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve('minitool-dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();res.writeHead(200,{'Content-Type':types[extname(p)]||'application/octet-stream'});res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>console.log('[pageerror]',e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
await page.waitForTimeout(2400);
await page.locator('#mobile-launch [data-action="tab-furniture"]:visible').first().tap();
await page.waitForTimeout(400);
await page.locator('.categories [data-action="category"][data-id="门窗"]:visible').first().tap();
await page.waitForTimeout(300);
await page.locator('.opening-card[data-action="add-window"][data-style="floor"]:visible').first().tap();
await page.waitForTimeout(500);
console.log('placing:',await page.evaluate(()=>({placing:document.body.classList.contains('placing-door'),toast:document.querySelector('#toast')?.textContent})));
// try several wall taps across the scene height
for(const fy of [.35,.45,.55]){
  const t=await page.evaluate(f=>{const r=document.querySelector('#viewport').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height*f};},fy);
  await page.touchscreen.tap(t.x,t.y);
  await page.waitForTimeout(400);
  console.log('tap@'+fy,await page.evaluate(()=>({placing:document.body.classList.contains('placing-door'),toast:document.querySelector('#toast')?.textContent,ctx:document.getElementById('mobile-context').textContent.slice(0,30)})));
}
await browser.close();server.close();process.exit(0);
