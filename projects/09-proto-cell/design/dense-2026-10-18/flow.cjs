const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const rootOut='design/dense-2026-10-18',comfort=process.argv.includes('--comfort'),out=rootOut+(comfort?'/comfort':'');fs.mkdirSync(out,{recursive:true})
;(async()=>{
 const {build}=await import('vite')
 const built=await build({configFile:false,logLevel:'silent',build:{write:false,minify:true,lib:{entry:rootOut+'/policy.ts',name:'LateQA',formats:['iife']}}})
 const code=(Array.isArray(built)?built[0]:built).output.find(x=>x.type==='chunk').code
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:4110/?v=dense-20261018')
 const productionEntry=await page.locator('script[src]').first().getAttribute('src')
 if(comfort){await page.getByRole('button',{name:'设置与存档',exact:true}).click();for(const name of ['减少动态','减少闪烁','减少震动'])await page.getByRole('checkbox',{name,exact:true}).check();await page.getByRole('button',{name:'返回培养舱',exact:true}).click()}
 await page.evaluate(()=>{Date.now=()=>727;document.documentElement.style.setProperty('--safe-area-inset-top','44px')})
 await page.getByRole('button',{name:'开始孵化',exact:true}).click()
 await page.evaluate(code+';window.__latePolicy=LateQA')
 await page.evaluate(()=>{
  const canvas=document.querySelector('.game-canvas');let fiber=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))]
  while(fiber&&!fiber.memoizedProps?.engine)fiber=fiber.return
  window.__late=fiber.memoizedProps;window.__events=[];window.__phases=[];window.__stages=[];window.__finale=[]
  window.__advanceTimes=[];window.__eventTimes=[]
  const engine=window.__late.engine,drain=engine.drainEvents.bind(engine),advance=engine.advance.bind(engine)
  engine.drainEvents=()=>{const e=drain();window.__events.push(...e);window.__eventTimes.push(...e.map(event=>({event,now:performance.now()})));return e}
  engine.advance=d=>{window.__advanceTimes.push(performance.now());advance(d)}
 })
 const captures=new Set(),layouts=[]
 const snap=async(name)=>{await page.evaluate(()=>window.__late.engine.pause('user'));await page.waitForTimeout(50);await page.screenshot({path:out+'/'+name+'.png'});await page.evaluate(()=>window.__late.engine.resume('user'))}
 const matrix=async(state)=>{
  await page.evaluate(()=>window.__late.engine.pause('user'))
  for(const [width,height]of [[375,812],[390,844],[430,932],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(60)
   const proof=await page.evaluate(()=>{
    const covers=[{x:8,y:48,w:56,h:56},{x:innerWidth-64,y:48,w:56,h:56}]
    const visible=[...document.querySelectorAll('button')].filter(e=>!e.closest('[inert]')&&e.getBoundingClientRect().width)
    const collisions=visible.filter(e=>{const r=e.getBoundingClientRect();return covers.some(c=>r.left<c.x+c.w&&r.right>c.x&&r.top<c.y+c.h&&r.bottom>c.y)}).map(e=>e.getAttribute('aria-label')||e.textContent)
    const a=document.querySelector('.game-hud__panel')?.getBoundingClientRect(),b=document.querySelector('.ecosystem-objective')?.getBoundingClientRect()
    return{overflow:document.documentElement.scrollWidth>innerWidth,collisions,hudOverlap:a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,objectiveBottom:b?.bottom,screenHeight:innerHeight}
   })
   if(proof.overflow||proof.collisions.length||proof.hudOverlap)throw Error(JSON.stringify({state,width,...proof}))
   await page.evaluate(()=>{for(const side of ['left','right']){const e=document.createElement('div');e.dataset.hostFixture='true';Object.assign(e.style,{position:'fixed',top:'48px',[side]:'8px',width:'56px',height:'56px',background:'#ff2753bb',borderRadius:'50%',zIndex:9999,pointerEvents:'none'});document.body.append(e)}})
   await page.screenshot({path:out+'/'+state+'-'+width+'.png'})
   await page.evaluate(()=>document.querySelectorAll('[data-host-fixture]').forEach(e=>e.remove()))
   layouts.push({state,width,height,safeAreaTop:44,...proof})
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__late.engine.resume('user'))
 }
 const content=JSON.parse(fs.readFileSync('src/content/content.json','utf8'))
 let last,choices=0
 for(let batch=0;batch<3000;batch++){
  if(await page.locator('.result-overlay').count())break
  if(await page.locator('.evolution-overlay').count()){
   const radios=page.getByRole('radio'),texts=await radios.allTextContents()
   const ranked=content.organelles.filter(o=>['metabolism','move','feed'].includes(o.category)).sort((a,b)=>['metabolism','move','feed'].indexOf(a.category)-['metabolism','move','feed'].indexOf(b.category))
   const index=ranked.map(o=>texts.findIndex(t=>t.includes(o.name))).find(i=>i>=0)??0
   await radios.nth(index).click();await page.locator('.evolution-overlay__confirm').click();choices++
  }
  if(await page.locator('.form-transition-overlay').count()){
   await page.waitForTimeout(150);await page.screenshot({path:out+'/evolution-'+captures.size+'.png'})
   await page.getByRole('button',{name:'完成跃迁，进入新生态',exact:true}).click();await page.waitForTimeout(100)
  }
  last=await page.evaluate(()=>{
   const {engine,onEvents}=window.__late,all=[]
   for(let n=0;n<6;n++){
    const w=engine.renderSnapshot(),p=w.entities.find(e=>e.id==='player');if(!p)break
    const phase=engine.snapshot().ecosystem?.leviathanPhase,boss=w.entities.find(e=>e.id==='encounter-2')
    if(phase&&!window.__phases.some(e=>e.phase===phase))window.__phases.push({phase,atMs:w.elapsedMs,playerRadius:p.body.radius,bossRadius:boss?.body.radius,bossState:boss?.behaviorState})
    if(!window.__stages.some(e=>e.tier===w.lifecycle.tierIndex))window.__stages.push({tier:w.lifecycle.tierIndex,atMs:w.elapsedMs,width:w.width,height:w.height,territory:w.territory})
    if(w.finaleStartedAtMs!==undefined){window.__finale.push({atMs:w.elapsedMs,startedAtMs:w.finaleStartedAtMs,membrane:p.membrane,position:p.position});break}
    if(w.lifecycle.tierIndex===2&&p.body.radius>=144&&!window.__wallDone){
     if(!window.__wallTask){
      const options=w.environmentField.obstacles.flatMap(o=>window.__latePolicy.fiberSections(o).map(s=>{const x=Math.max(s.from.x+20,Math.min(s.to.x-20,p.position.x)),y=s.from.y,side=Math.sign(p.position.y-y)||1;return{x,y,side,id:o.id,distance:Math.hypot(x-p.position.x,y-p.position.y)}})).sort((a,b)=>a.distance-b.distance)
      window.__wallTask=options[0]
     }
     const task=window.__wallTask,wall=w.environmentField.obstacles.find(o=>o.id===task.id)
     const target={x:task.x,y:wall.from.y-task.side*(p.body.radius+40)},dx=target.x-p.position.x,dy=target.y-p.position.y,d=Math.hypot(dx,dy)||1
     engine.input.start({x:0,y:0});engine.input.move({x:dx/d*120,y:dy/d*120})
    }else window.__latePolicy.setPolicyIntent(engine,w.elapsedMs,'balanced')
    engine.advance(1000/12)
    const e=engine.drainEvents();all.push(...e)
    if(e.some(x=>x.type==='terrain-broken'&&x.obstacleId.startsWith('chamber-')))window.__wallDone=true
    if(e.some(x=>['mutation-ready','player-died','form-transition-ready','ending-reached'].includes(x.type)||x.finisher))break
   }
   if(all.length)onEvents(all)
   const w=engine.renderSnapshot()
   return{hud:engine.snapshot(),boss:w.entities.find(e=>e.id==='encounter-2'),wallDone:window.__wallDone,events:all,phases:window.__phases,stages:window.__stages,wallTask:window.__wallTask}
  })
  const tier=last.hud.tierIndex,phase=last.hud.ecosystem?.leviathanPhase
  if(tier>0&&!captures.has('tier-'+tier)){captures.add('tier-'+tier);await matrix('tier-'+tier)}
  if(last.wallDone&&!captures.has('breach')){captures.add('breach');await snap('chamber-breach')}
  if(phase&&phase!=='consumed'&&!captures.has(phase)){captures.add(phase);await snap('leviathan-'+phase);if(phase==='exposed')await matrix('exposed')}
  if(last.events.some(e=>e.finisher)){
   await page.waitForTimeout(90);if(await page.locator('.evolution-overlay').count())throw Error('Evolution overlay interrupted terminal engulf');await page.screenshot({path:out+'/terminal-intake.png'})
   await page.waitForTimeout(300);await page.screenshot({path:out+'/terminal-assimilation.png'})
   await page.waitForTimeout(1400)
  }
  if(last.hud.finaleStartedAtMs!==undefined&&!captures.has('finale')){captures.add('finale');await page.getByRole('button',{name:'暂停',exact:true}).click();const before=await page.evaluate(()=>window.__late.engine.snapshot().elapsedMs);await page.waitForTimeout(180);const after=await page.evaluate(()=>window.__late.engine.snapshot().elapsedMs);if(before!==after)throw Error('Finale clock advanced while paused');await page.getByRole('button',{name:'继续游动',exact:true}).click();await page.waitForTimeout(150);await page.screenshot({path:out+'/domain-claim.png'});await page.waitForTimeout(1450)}
  if(batch%100===0)console.log(JSON.stringify({batch,time:last.hud.elapsedMs,tier,phase,wallDone:last.wallDone}))
 }
 await page.waitForTimeout(100)
 const proof=await page.evaluate(()=>({events:window.__events,stages:window.__stages,phases:window.__phases,finale:window.__finale,hud:window.__late.engine.snapshot(),wallDone:window.__wallDone,eventTimes:window.__eventTimes,advanceTimes:window.__advanceTimes}))
 fs.writeFileSync(out+'/flow-proof.json',JSON.stringify({productionEntry,method:'Actual production App UI; normal fresh seed727; direction input and fixed-step acceleration only. No entity/stat edits. 44px system inset and simulated host controls.',proof,layouts,choices,comfort,errors},null,2))
 await page.screenshot({path:out+'/ending.png'})
 if(choices!==6||errors.length||!proof.wallDone||proof.stages.length!==3||!proof.events.some(e=>e.type==='ending-reached')||!proof.events.some(e=>e.finisher)||!proof.phases.some(e=>e.phase==='exposed'))throw Error(JSON.stringify({errors,wallDone:proof.wallDone,stages:proof.stages,phases:proof.phases,last}))
 console.log(JSON.stringify({ok:true,events:proof.events.length,stages:proof.stages,phases:proof.phases,layouts:layouts.length,errors}));await browser.close()
})().catch(e=>{console.error(e);process.exit(1)})
