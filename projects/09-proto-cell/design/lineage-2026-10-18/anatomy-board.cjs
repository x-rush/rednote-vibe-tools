// Actual drawSpecimen/drawCell fixture; this is anatomy evidence, not gameplay proof.
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
;(async () => {
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  const page = await browser.newPage({viewport:{width:1260,height:1040},deviceScaleFactor:1})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://127.0.0.1:4109/')
  await page.evaluate(async()=>{
    const { drawSpecimen }=await import('/src/ui/SpecimenCanvas.tsx')
    const { createBuildState }=await import('/src/evolution/build.ts')
    const { getContent }=await import('/src/content/index.ts')
    const content=getContent()
    const lineages=content.lineage.archetypes
    const tiers=content.scaleTiers
    document.body.innerHTML='<main id="fixture"><header><small>PROTO CELL / ACTUAL SHARED RENDERER FIXTURE</small><h1>三条血统 · 三阶段连续体</h1><p>同一套实际膜几何与器官绘制；每格含原始骨架及携带电囊、包裹口的小尺寸参考</p></header><section id="board"></section><footer>静态解剖夹具，非实际游戏截图；不作为成长、平衡或通关证据。膜形与吞噬判定共用 membraneContour。</footer></main>'
    const style=document.createElement('style')
    style.textContent='html,body{margin:0!important;padding:0!important;background:#071725!important;color:#dff9f3!important;overflow:hidden!important;font-family:Segoe UI,Microsoft YaHei,sans-serif!important}*{box-sizing:border-box}#fixture{width:1260px;height:1040px;padding:28px 36px;background:radial-gradient(ellipse at 50% 30%,#12394b,#071725 70%)}#fixture header small{font-size:11px;letter-spacing:2px;color:#8caeb3}#fixture h1{font-size:29px;margin:10px 0}#fixture header p{font-size:13px;color:#acc5cc;margin:8px 0 19px}#board{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}#fixture article{height:265px;border:1px solid #32505e;background:#0a2433;border-radius:15px;position:relative;overflow:hidden}#fixture h2{font-size:17px;font-weight:600;margin:15px 17px 2px}#fixture .stage{color:#8ba8b5;font-size:11px;margin-left:17px}#fixture article>canvas{display:block;margin:-14px auto;width:220px;height:220px}#fixture .small{position:absolute;right:8px;bottom:5px;display:flex;align-items:center;color:#8caab1;font-size:10px}#fixture .small canvas{width:90px;height:90px}#fixture footer{font-size:11px;color:#91abb8;margin-top:18px}'
    document.head.append(style)
    const board=document.getElementById('board')
    for (const tier of tiers) for (const lineage of lineages){
      const article=document.createElement('article')
      article.innerHTML=`<h2>${lineage.name}</h2><div class="stage">${tier.name} · ${lineage.route}</div><canvas width="220" height="220"></canvas><div class="small"><span>携带器官</span><canvas width="90" height="90"></canvas></div>`
      board.append(article)
      const [main,small]=article.querySelectorAll('canvas')
      drawSpecimen(main.getContext('2d'),createBuildState(),tier.formId,220,{visualRecipeId:lineage.visualRecipeId,elapsedMs:1200})
      drawSpecimen(small.getContext('2d'),createBuildState({traitIds:['organelle-electric-sac','organelle-wide-mouth']}),tier.formId,90,{visualRecipeId:lineage.visualRecipeId,elapsedMs:1200})
    }
  })
  await page.screenshot({path:'design/lineage-2026-10-18/anatomy-board.png'})
  console.log(JSON.stringify({artifact:'design/lineage-2026-10-18/anatomy-board.png',type:'shared-renderer-fixture-not-gameplay',pageErrors:errors}))
  await browser.close()
})().catch(error=>{console.error(error);process.exitCode=1})
