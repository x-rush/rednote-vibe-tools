// Reproducible shared-renderer fixture. This is not gameplay or balance evidence.
const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const context = await browser.newContext({ viewport: { width: 1180, height: 780 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4109/')
  await page.evaluate(async () => {
    const { drawSpecimen } = await import('/src/ui/SpecimenCanvas.tsx')
    const { createBuildState } = await import('/src/evolution/build.ts')
    const build = createBuildState({ traitIds: ['organelle-electric-sac', 'organelle-wide-mouth'] })
    const forms = [
      ['form-primal-cell', '原始单细胞', '柔软单膜 · 单核心'],
      ['form-colony-body', '聚合多细胞体', '三叶共享膜 · 三核心'],
      ['form-ciliate-composite', '纤毛复合体', '长轴体 · 双核 · 定向口沟'],
    ]
    document.title = '共享形态渲染夹具 — 非游戏验收'
    document.body.innerHTML = `<main class="anatomy-fixture"><header><p>PROTO CELL / SHARED RENDERER FIXTURE</p><h1>同一构筑，三种生命骨架</h1><div>电囊 + 包裹口 · 相同物理半径 · 同一 drawCell 绘制链</div></header><section>${forms.map(([id, name, detail]) => `<article><div class="fixture-id">${id}</div><canvas width="330" height="330" data-form="${id}"></canvas><h2>${name}</h2><p>${detail}</p><div class="fixture-mobile"><span>局内小尺寸参考</span><canvas width="110" height="110" data-form="${id}"></canvas></div></article>`).join('')}</section><footer>这是共享渲染器的静态夹具截图，用于检查形态与器官的一致性。<br>不是实际游戏场景，不作为玩法、成长进度、难度或通关证明。</footer></main>`
    const style = document.createElement('style')
    style.textContent = `html,body{margin:0!important;padding:0!important;width:1180px!important;height:780px!important;min-width:0!important;background:#071725!important;color:#daf5f2!important;overflow:hidden!important;font-family:"Segoe UI","Microsoft YaHei",sans-serif!important}*{box-sizing:border-box}.anatomy-fixture{padding:34px 40px;margin:0;width:1180px;height:780px;background:radial-gradient(ellipse at 50% 30%,#0c2b40,#071725 65%)}.anatomy-fixture header p{font-size:11px;color:#a4bebe;letter-spacing:2px;margin:0 0 10px}.anatomy-fixture h1{font-size:30px;line-height:1.25;margin:0 0 10px;letter-spacing:1px}.anatomy-fixture header div{font-size:14px;color:#adc8cd}.anatomy-fixture section{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:26px}.anatomy-fixture article{position:relative;height:482px;border:1px solid #31515d;border-radius:16px;background:#0a2231;overflow:hidden;text-align:center;padding:16px 8px}.fixture-id{font:11px monospace;color:#789da8;letter-spacing:.5px}.anatomy-fixture article>canvas{display:block;width:330px;height:280px;object-fit:contain;margin:-5px auto -4px}.anatomy-fixture h2{font-size:21px;font-weight:600;margin:0 0 8px}.anatomy-fixture article p{font-size:13px;color:#b3cfd2;margin:0}.fixture-mobile{display:flex;align-items:center;justify-content:center;border-top:1px solid #25424f;margin:16px 12px 0;gap:12px;height:94px}.fixture-mobile span{font-size:11px;color:#829fa9}.fixture-mobile canvas{width:100px;height:100px}.anatomy-fixture footer{margin-top:22px;font-size:12px;color:#adc5cb;line-height:1.7}`
    document.head.appendChild(style)
    for (const canvas of document.querySelectorAll('.anatomy-fixture canvas')) {
      drawSpecimen(canvas.getContext('2d'), build, canvas.dataset.form, canvas.width)
    }
  })
  await page.screenshot({ path: 'design/implementation-2026-10-18/anatomy-board.png' })
  console.log(JSON.stringify({ file: 'design/implementation-2026-10-18/anatomy-board.png', type: 'shared-renderer-fixture-not-gameplay', pageErrors: errors }))
  await context.close()
  await browser.close()
})().catch((error) => { console.error(error); process.exitCode = 1 })
