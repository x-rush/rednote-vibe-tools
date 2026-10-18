const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),fs=require('node:fs');let browser
;(async()=>{
 const tag=process.argv[2]||'before',results=[],content=JSON.parse(fs.readFileSync('src/content/content.json','utf8')),save=JSON.parse(fs.readFileSync('design/release-2026-10-18/native/offspring-proof.json','utf8')).child.nativeSave
 delete save.nursery;save.settings.reducedMotion=false
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const [width,height]of(tag==='before'?[[390,700]]:[[375,700],[390,700],[430,780],[457,692],[844,390]])){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  const manifest=JSON.parse(fs.readFileSync('release-assets/proto-cell-20261018-v6-manifest.json','utf8')),path=require('node:path'),requests=[]
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='proto-cell.offline'){errors.push('External resource: '+url.href);return route.abort()}
  const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(manifest.extractedRoot,'.'+name)
  if(!file.startsWith(manifest.extractedRoot+path.sep)||!fs.existsSync(file)){errors.push('Missing packaged resource: '+name);return route.fulfill({status:404,body:'Missing'})}
  requests.push(name);const extension=path.extname(file),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'}
  return route.fulfill({body:fs.readFileSync(file),contentType:types[extension]||'application/octet-stream',headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'"}})
 })

  await page.goto('http://proto-cell.offline/')
  await page.getByRole('button',{name:content.ui.actions.open_settings,exact:true}).click();await page.getByRole('textbox',{name:content.ui.labels.importedSave,exact:true}).fill(JSON.stringify(save));await page.getByRole('button',{name:content.ui.actions.importSave,exact:true}).click();await page.getByRole('status').filter({hasText:content.ui.screens.importSuccess}).waitFor();await page.getByRole('button',{name:content.ui.actions.backToLab,exact:true}).click();await page.getByRole('button',{name:new RegExp(content.ui.actions.open_nursery)}).click()
  await page.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','44px'))
  const geometry=()=>page.evaluate(()=>{const e=document.querySelector('.nursery-shell'),b=document.querySelector('.nursery-controls .hatchery-start');return{height:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,overflow:getComputedStyle(e).overflowY,button:b&&{top:b.getBoundingClientRect().top,bottom:b.getBoundingClientRect().bottom},viewport:innerHeight}})
  const before=await geometry();await page.mouse.move(width/2,height*.7);await page.mouse.wheel(0,1600);await page.waitForTimeout(180);const wheel=await geometry()
  const record={archive:manifest.archive,sha256:manifest.sha256,width,height,before,wheel,errors};results.push(record);await page.screenshot({path:'design/scroll-2026-10-18/'+tag+'-'+width+'.png'})
  if(wheel.scrollTop<=0||!wheel.button||wheel.button.bottom>height||wheel.button.top<0)throw Error('User scrolling cannot reach hatch action: '+JSON.stringify(record))
  await page.evaluate(()=>document.querySelector('.nursery-shell').scrollTop=0)
  const cdp=await page.context().newCDPSession(page)
  for(let i=0;i<3;i++){
   const x=width-12,start=Math.round(height*.82),end=Math.round(height*.18)
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]})
   for(let n=1;n<=10;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*n/10}]});await page.waitForTimeout(24)}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(120)
  }
  await page.waitForTimeout(100);record.touch=await geometry();if(record.touch.scrollTop<=0||record.touch.button.bottom>height)throw Error('Touch scroll failed: '+JSON.stringify(record))
  await page.getByRole('button',{name:content.ui.actions.hatchCell,exact:true}).click();await page.getByRole('button',{name:content.ui.actions.skipHatch,exact:true}).click();await page.getByRole('button',{name:content.ui.actions.finishHatch,exact:true}).click();if(await page.locator('.lineage-card').count()!==1)throw Error('Hatch incomplete after scrolling')
  await page.getByRole('button',{name:content.ui.actions.backToLab,exact:true}).click();await page.getByRole('button',{name:'再次孵化',exact:true}).click();const game=await page.evaluate(()=>({overflow:getComputedStyle(document.body).overflow,canvas:!!document.querySelector('.game-canvas')}));if(game.overflow!=='hidden'||!game.canvas)throw Error('Combat scroll lock regressed');record.hatchAndStart=true;await page.close()
 }
 fs.writeFileSync('design/scroll-2026-10-18/'+tag+'.json',JSON.stringify(results,null,2));console.log(JSON.stringify({ok:true,cases:results.length,results}));await browser.close()
})().catch(async e=>{fs.writeFileSync('design/scroll-2026-10-18/'+(process.argv[2]||'before')+'-failure.txt',String(e));await browser?.close();console.error(e);process.exitCode=1})
