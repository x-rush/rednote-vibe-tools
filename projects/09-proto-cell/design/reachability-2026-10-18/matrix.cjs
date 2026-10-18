const fs=require('node:fs'),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),createDriver=require('./driver.cjs');let browser
;(async()=>{
 const {build}=await import('vite'),out='design/reachability-2026-10-18',tag=process.argv[2]||'before',content=JSON.parse(fs.readFileSync('src/content/content.json','utf8')),records=[],failures=[]
 const built=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':'"production"'},build:{write:false,minify:true,lib:{entry:out+'/overlays.tsx',name:'ReachQA',formats:['iife']}}}),overlayCode=(Array.isArray(built)?built[0]:built).output.find(o=>o.type==='chunk').code
 const save=JSON.parse(fs.readFileSync('design/release-2026-10-18/native/offspring-proof.json','utf8')).child.nativeSave
 const source=save.nursery.seeds[0];save.nursery.lineages=Array.from({length:12},(_,n)=>({id:'lineage-'+(n+1).toString(16).padStart(16,'0'),seedId:'seed-'+(n+1).toString(16).padStart(16,'0'),name:'验收第'+(n+1)+'代长名称细胞',generation:2,archetypeId:content.lineage.archetypes[n%3].id,bornAtRun:n+1}))
 save.nursery.hatchedSeedIds=save.nursery.lineages.map(l=>l.seedId);save.nursery.selectedLineageId=save.nursery.lineages[0].id;save.nursery.completedRuns=13
 save.nursery.seeds=[{...source,id:'seed-ffffffffffffffff',archiveKey:'ffffffffffffffff',generation:2,earnedAtRun:13}];save.nursery.seenArchiveKeys=[...new Set([...save.nursery.seenArchiveKeys,'ffffffffffffffff'])]
 save.progression.genePoints=500;for(const item of [...content.creatures,...content.nutrients,...content.events,...content.bosses])save.codex[item.id]='complete'
 const views=process.argv.includes('--short')?[[390,520]]:process.argv.includes('--quick')?[[844,390]]:[[375,667],[390,700],[430,780],[844,390],[390,520]],modes=process.argv.includes('--touch')?['touch']:process.argv.includes('--wheel')||process.argv.includes('--quick')?['wheel']:['touch','wheel']
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const [width,height]of views)for(const mode of modes){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true}),errors=[],driver=createDriver(page,mode),a=content.ui.actions
  page.on('pageerror',e=>errors.push(e.message))
  if(process.argv.includes('--package')){
const manifest=JSON.parse(fs.readFileSync('release-assets/proto-cell-20261018-v7-manifest.json','utf8')),path=require('node:path'),requests=[]
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='proto-cell.offline'){errors.push('External resource: '+url.href);return route.abort()}
  const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(manifest.extractedRoot,'.'+name)
  if(!file.startsWith(manifest.extractedRoot+path.sep)||!fs.existsSync(file)){errors.push('Missing packaged resource: '+name);return route.fulfill({status:404,body:'Missing'})}
  requests.push(name);const extension=path.extname(file),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'}
  return route.fulfill({body:fs.readFileSync(file),contentType:types[extension]||'application/octet-stream',headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'"}})
 })

await page.goto('http://proto-cell.offline/')
}else await page.goto('http://127.0.0.1:4110/?v=reach-'+tag)
  await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','44px');for(const side of ['left','right']){const e=document.createElement('div');e.dataset.hostFixture='true';Object.assign(e.style,{position:'fixed',top:'48px',[side]:'8px',width:'56px',height:'56px',background:'#e51b4aaa',borderRadius:'50%',zIndex:99999});document.body.append(e)}})
  const button=name=>page.getByRole('button',{name,exact:true}),home=async()=>{if(await page.locator('#reachability-fixture').count())await page.evaluate(()=>window.mountReachability('none'));if(await page.locator('.lab-detail').count())await driver.tap(button(a.backToLab),'.lab-detail');if(await page.locator('.nursery-shell').count())await driver.tap(button(a.backToLab),'.nursery-shell');if(await page.locator('.archive-panel').count())await driver.tap(button(a.backToLab),'.archive-panel')}
  await driver.tap(button(a.open_settings),'.lab-shell');await driver.tap(page.getByRole('textbox',{name:content.ui.labels.importedSave,exact:true}),'.lab-detail');await page.keyboard.insertText(JSON.stringify(save));await driver.tap(button(a.importSave),'.lab-detail');await page.getByRole('status').filter({hasText:content.ui.screens.importSuccess}).waitFor();await home()
  async function scenario(name,fn){try{await fn();if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({width,height,mode,name,ok:true}))}catch(e){failures.push({width,height,mode,name,message:String(e)});await page.screenshot({path:out+'/'+tag+'-'+width+'-'+mode+'-'+name+'-failed.png'});console.log(JSON.stringify(failures.at(-1)))}finally{try{await home()}catch{}fs.writeFileSync(out+'/'+tag+'-progress.json',JSON.stringify({records,failures},null,2))}}
  async function audit(root,name){const r=await driver.audit(root,name);records.push({width,height,...r});await page.screenshot({path:out+'/'+tag+'-'+width+'-'+mode+'-'+name+'.png'})}
  await scenario('home',async()=>{await audit('.lab-shell','home');await driver.tap(page.locator('.lab-challenges summary'),'.lab-shell');await audit('.lab-shell','home-expanded')})
  await scenario('library',async()=>{
   await driver.tap(page.getByRole('button',{name:new RegExp(a.open_nursery)}),'.lab-shell');await driver.tap(page.locator('.nursery-tabs button').nth(1),'.nursery-shell');if(await page.locator('.lineage-card').count()!==12)throw Error('QA library not full');await audit('.nursery-shell','library-full')
   const last=page.locator('.lineage-card').last();if(await last.locator('.lineage-select').isDisabled())await driver.tap(page.locator('.lineage-card').nth(10).locator('.lineage-select'),'.nursery-shell');await driver.tap(last.locator('.lineage-select'),'.nursery-shell');if(await last.getAttribute('data-selected')!=='true')throw Error('Last lineage cannot be selected');await driver.tap(last.locator('.lineage-release'),'.nursery-shell');await driver.reach(button(a.confirmRetire),'.nursery-shell');await driver.reach(button(a.cancelRetire),'.nursery-shell');records.push({width,height,mode,name:'retire-confirm',controls:2,reachable:2,disabled:0});await driver.tap(button(a.cancelRetire),'.nursery-shell');await driver.tap(last.locator('.lineage-release'),'.nursery-shell');await driver.tap(button(a.confirmRetire),'.nursery-shell');if(await page.locator('.lineage-card').count()!==11)throw Error('Cannot retire last lineage')
   await driver.tap(page.locator('.nursery-tabs button').nth(0),'.nursery-shell');await audit('.nursery-shell','seed-bank');await driver.tap(button(a.hatchCell),'.nursery-shell');await audit('.nursery-incubation','hatch-dialog');await driver.tap(page.getByRole('button',{name:content.ui.labels.hatchReturn,exact:true}),'.nursery-incubation');await driver.tap(button(a.hatchCell),'.nursery-shell');await page.waitForFunction(()=>{const b=document.querySelector('.nursery-incubation .hatchery-start');return b&&!b.disabled});await audit('.nursery-incubation','hatch-ready');await driver.tap(button(a.finishHatch),'.nursery-incubation');if(await page.locator('.lineage-card').count()!==12)throw Error('Hatch completion after scrolling failed')
  })
  await scenario('codex',async()=>{await driver.tap(button(a.open_codex),'.lab-shell');await audit('.lab-detail','codex');const last=page.locator('.codex-grid article').last();await driver.reach(last,'.lab-detail')})
  await scenario('genes',async()=>{await driver.tap(button(a.open_gene),'.lab-shell');await audit('.lab-detail','genes');const enabled=page.locator('.gene-node button:not(:disabled)').last();if(await enabled.count()){const before=await enabled.textContent();await driver.tap(enabled,'.lab-detail');if(await enabled.textContent()===before)throw Error('Gene action did not fire')}})
  await scenario('archive',async()=>{await driver.tap(page.locator('.lab-recent'),'.lab-shell');await audit('.archive-panel','archive')})
  if(process.argv.includes('--package')){await page.route('http://proto-cell.offline/__qa-overlays.js',r=>r.fulfill({contentType:'application/javascript',body:overlayCode}));await page.addScriptTag({url:'http://proto-cell.offline/__qa-overlays.js'})}else await page.addScriptTag({content:overlayCode})
  await scenario('evolution',async()=>{
   await page.evaluate(()=>window.mountReachability('evolution'));await page.locator('.evolution-choices').waitFor();await audit('.evolution-choices','evolution-choices')
   for(let n=0;n<3;n++){const choice=page.locator('.evolution-choice').nth(n);await driver.tap(choice,'.evolution-choices');if(await choice.getAttribute('aria-checked')!=='true')throw Error('Choice did not select')}
   await driver.tap(page.locator('.evolution-overlay__confirm'),'.evolution-choices');if((await page.evaluate(()=>window.__reachActions)).length!==1)throw Error('Evolution confirm did not fire')
  })
  await scenario('result',async()=>{
   await page.evaluate(()=>window.mountReachability('result'));await page.locator('.result-overlay').waitFor();await audit('.result-overlay','result');await driver.tap(page.locator('.result-overlay summary'),'.result-overlay');await audit('.result-overlay','result-expanded')
   for(const target of await page.locator('.result-overlay button').all())await driver.tap(target,'.result-overlay')
   if((await page.evaluate(()=>window.__reachActions)).length!==4)throw Error('Missing result action')
  })
  await scenario('settings',async()=>{
   await driver.tap(button(a.open_settings),'.lab-shell');await audit('.lab-detail','settings');for(const checkbox of await page.locator('.settings-panel input[type=checkbox]').all()){const old=await checkbox.isChecked();await driver.tap(checkbox,'.lab-detail');if(await checkbox.isChecked()===old)throw Error('Checkbox did not toggle')}
   await driver.tap(button(a.exportSave),'.lab-detail');await audit('.lab-detail','settings-exported');await driver.tap(button(a.clearSave),'.lab-detail');await audit('.lab-detail','settings-clear-confirm');await driver.tap(button(a.cancel),'.lab-detail');await driver.tap(button(a.clearSave),'.lab-detail');await driver.tap(button(a.confirmClear),'.lab-detail');await page.locator('.lab-shell').waitFor()
  })
  await scenario('pause-and-error',async()=>{
   await driver.tap(button(a.start),'.lab-shell');await page.locator('.game-canvas').waitFor();await page.waitForTimeout(80);await driver.tap(button(a.pause),'.game-shell');await audit('.game-overlay','pause');await driver.tap(button(a.resume),'.game-overlay')
   for(let n=0;n<2;n++){await page.locator('.game-canvas').evaluate(e=>e.dispatchEvent(new Event('contextlost',{cancelable:true})));await page.waitForTimeout(100)}
   await page.locator('.error-panel').waitFor();await audit('main.hatchery-shell','canvas-error');await driver.tap(button(a.retry),'main.hatchery-shell');await page.locator('.game-canvas').waitFor()
  })
  fs.writeFileSync(out+'/'+tag+'-'+width+'-'+mode+'-trace.json',JSON.stringify(driver.trace,null,2));await page.close()
 }
 await browser.close();fs.writeFileSync(out+'/'+tag+'.json',JSON.stringify({records,failures,method:'Actual production App for lab/settings/library/codex/genes/archive; production overlay components mounted for evolution/result using actual App CSS. Explicit touch and wheel gestures, coordinate taps and elementFromPoint hit tests; no locator.click or scrollIntoView.'},null,2));console.log(JSON.stringify({cases:records.length,failures}));if(failures.length)process.exitCode=1
})().catch(async e=>{await browser?.close();console.error(e);process.exitCode=1})
