import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {makePlan,clone} from '../../src/core.js';
const {chromium}=createRequire(import.meta.url)('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve('dist'),out=resolve('artifacts/interaction-audit-20260917'),results=[],catalog=JSON.parse(await readFile('src/content/content.json','utf8'));
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+'/')&&!p.startsWith(root+'\\'))throw Error();let bytes=await readFile(p);if(p===resolve(root,'src/app.js'))bytes=Buffer.concat([bytes,Buffer.from('\nwindow.__audit={get scene(){return scene},get plan(){return plan}};')]);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(p)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`,browser=await chromium.launch({channel:'chrome',headless:true});

function stable(v){return Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v}
function fingerprint(p){const q=clone(p),ids=new Map(q.rooms.map((r,i)=>[r.id,i]));delete q.id;delete q.updatedAt;for(const r of q.rooms)delete r.id;for(const key of ['items','openings']){for(const o of q[key]){delete o.id;o.roomId=ids.get(o.roomId)}q[key]=q[key].map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}return JSON.stringify(stable(q))}
async function fixture(p,baseline,expected,label,screen=false){const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await context.addInitScript(({p,baseline})=>localStorage.setItem('roomish-project-15-v1',JSON.stringify({active:p.id,plans:[p],baselines:{[p.id]:baseline}})),{p,baseline});const page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.__audit?.scene);const actual=await page.evaluate(()=>window.__audit.plan);const passed=fingerprint(actual)===fingerprint(expected)&&actual.id===p.id;if(screen)await page.screenshot({path:out+'/template-'+label+'.png'});results.push({fixture:label,passed,expectedItems:expected.items.length,actualItems:actual.items.length});await context.close();}
try{
 const {inventory}=await import('../../src/core.js');
 const old=makePlan(catalog.templates[0],catalog,true),baseline=clone(old),key=inventory(old,catalog).furniture[0].key;
 old.prices[key]=100;await fixture(old,baseline,old,'custom-valid-price');
}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(out+'/valid-price-report.json',JSON.stringify({results,notes:['Price key comes from the actual inventory; the arbitrary custom key in the earlier test is not a valid saved-plan fixture.']},null,2));console.log(JSON.stringify(results,null,2));}
