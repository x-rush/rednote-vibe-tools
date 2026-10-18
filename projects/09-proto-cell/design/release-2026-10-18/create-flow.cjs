const fs=require('node:fs');let s=fs.readFileSync('design/tail-2026-10-18/flow.cjs','utf8');s=s.replace("const rootOut='design/tail-2026-10-18',comfort=process.argv.includes('--comfort'),out=rootOut+(comfort?'/comfort':'');", "const rootOut='design/release-2026-10-18',comfort=process.argv.includes('--comfort'),native=process.argv.includes('--native'),out=rootOut+(native?'/native':'/legacy');")
s=s.replace("await page.goto('http://127.0.0.1:4110/?v=tail-20261018')",`const manifest=JSON.parse(fs.readFileSync('release-assets/proto-cell-20261018-v5-manifest.json','utf8')),path=require('node:path'),requests=[]
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='proto-cell.offline'){errors.push('External resource: '+url.href);return route.abort()}
  const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(manifest.extractedRoot,'.'+name)
  if(!file.startsWith(manifest.extractedRoot+path.sep)||!fs.existsSync(file)){errors.push('Missing packaged resource: '+name);return route.fulfill({status:404,body:'Missing'})}
  requests.push(name);const extension=path.extname(file),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'}
  return route.fulfill({body:fs.readFileSync(file),contentType:types[extension]||'application/octet-stream',headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'"}})
 })
 await page.addInitScript(({native})=>{
  Array.prototype.at=undefined;Array.prototype.flatMap=undefined;Array.prototype.flat=undefined;Object.fromEntries=undefined;window.structuredClone=undefined;
  window.fetch=()=>{throw Error('No runtime fetch')};window.XMLHttpRequest=function(){throw Error('No runtime XHR')};
  if(native){
   const load=()=>JSON.parse(localStorage.getItem('qa-native')||'{}'),save=data=>localStorage.setItem('qa-native',JSON.stringify(data));
   window.xhs={launchOptions:{miniToolEnv:{buildVersion:9460000}},miniTool:{getStorageInfo:async()=>({keys:Object.keys(load())}),getStorage:async({key})=>({data:load()[key]??null}),setStorage:async({key,data})=>{const all=load();all[key]=data;save(all)},removeStorage:async({key})=>{const all=load();delete all[key];save(all)}}};
   Object.defineProperty(window,'indexedDB',{get(){throw Error('Legacy IndexedDB disabled for native proof')}})
  }
 },{native})
 await page.goto('http://proto-cell.offline/')`)
s=s.replace("page.locator('script[src]').first()", "page.locator('script[defer][src]').first()")
s=s.replace('method:\'Actual production App UI;', "archive:manifest.archive,sha256:manifest.sha256,requests,nativeStorageMock:native,oldApiFallbackSimulation:true,method:'Extracted final ZIP under restrictive CSP, every request served from package; runtime fetch/XHR blocked; actual production App UI;")
s=s.replace("console.log(JSON.stringify({ok:true,events:proof.events.length", () => `if(native){
  await page.getByRole('button',{name:/培育下一代/}).click();const select=page.locator('.nursery-controls select'),options=await select.locator('option').evaluateAll(xs=>xs.map(x=>x.value));if(options.length<2)throw Error('Missing inherited organ');await select.selectOption(options[1]);await page.getByRole('textbox',{name:'为新细胞命名'}).fill('交付验收一代');await page.getByRole('button',{name:'开始培育',exact:true}).click();await page.getByRole('button',{name:'完成孵化',exact:true}).click();await page.getByRole('button',{name:'返回培养舱',exact:true}).click();await page.waitForTimeout(150);await page.reload();await page.getByRole('button',{name:'再次孵化',exact:true}).waitFor();const lineage=await page.locator('.lab-specimen').getAttribute('data-lineage-id');if(!lineage)throw Error('Native selected lineage lost after reload');await page.getByRole('button',{name:'再次孵化',exact:true}).click();const child=await page.evaluate(()=>{const c=document.querySelector('.game-canvas');let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.engine)f=f.return;const w=f.memoizedProps.engine.renderSnapshot(),p=w.entities.find(e=>e.id===w.playerId);return{tier:w.lifecycle.tierIndex,recipe:p.visualRecipeId,traits:w.playerBuild.traitIds,nativeSave:JSON.parse(JSON.parse(localStorage.getItem('qa-native'))['proto-cell:save:current'])}});if(child.tier!==0||child.traits.length!==1||child.nativeSave.nursery.lineages.length!==1)throw Error('Native offspring mismatch');fs.writeFileSync(out+'/offspring-proof.json',JSON.stringify({lineage,child},null,2));await page.screenshot({path:out+'/offspring-start.png'})
 }
 console.log(JSON.stringify({ok:true,events:proof.events.length`)
fs.writeFileSync('design/release-2026-10-18/flow.cjs',s)
