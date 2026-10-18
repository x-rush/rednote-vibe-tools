const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const content = JSON.parse(fs.readFileSync('src/content/content.json', 'utf8'))
const save = fs.readFileSync('design/lineage-2026-10-18/actual-flow/actual-save.json', 'utf8')
const out = 'design/lineage-2026-10-18/actual-flow'
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4110/')
  await page.getByRole('button', { name: content.ui.actions.open_settings, exact: true }).click()
  await page.getByRole('textbox', { name: content.ui.labels.importedSave, exact: true }).fill(save)
  await page.getByRole('button', { name: content.ui.actions.importSave, exact: true }).click()
  await page.getByRole('status').filter({ hasText: content.ui.screens.importSuccess }).waitFor()
  await page.getByRole('button', { name: content.ui.actions.backToLab, exact: true }).click()
  await page.getByRole('button', { name: content.ui.actions.restartAfterLife, exact: true }).click()
  await page.evaluate(() => {
    const canvas = document.querySelector('.game-canvas')
    let fiber = canvas[Object.keys(canvas).find((key) => key.startsWith('__reactFiber$'))]
    while (fiber && !fiber.memoizedProps?.engine) fiber = fiber.return
    window.__flow = fiber.memoizedProps
  })
  let status
  for (let turn = 0; turn < 600; turn++) {
    if (await page.locator('.result-overlay').count()) break
    if (await page.locator('.evolution-overlay').count()) {
      await page.getByRole('radio').first().click()
      await page.locator('.evolution-overlay__confirm').click()
    }
    status = await page.evaluate(() => {
      const { engine, onEvents } = window.__flow
      const events = []
      for (let step = 0; step < 6; step++) {
        const world = engine.renderSnapshot()
        const player = world.entities.find((entity) => entity.id === world.playerId)
        if (!player) break
        const target = world.entities.filter((entity) => entity.faction === 'hostile' && entity.body.radius > player.body.radius * 1.2).sort((a, b) => Math.hypot(a.position.x - player.position.x, a.position.y - player.position.y) - Math.hypot(b.position.x - player.position.x, b.position.y - player.position.y))[0]
        engine.input.start({ x: 0, y: 0 })
        if (target) {
          const x = target.position.x - player.position.x, y = target.position.y - player.position.y
          const distance = Math.max(1, Math.hypot(x, y))
          engine.input.move({ x: x / distance * 120, y: y / distance * 120 })
        }
        engine.advance(1000 / 12)
        const batch = engine.drainEvents()
        events.push(...batch)
        if (batch.some((event) => ['player-died', 'mutation-ready', 'form-transition-ready'].includes(event.type))) break
      }
      if (events.length) { onEvents(events); if (events.some(event => event.type === 'player-died')) window.__lastTerminalEvents = events }
      return engine.snapshot()
    })
    if (status.elapsedMs > 180000) break
  }
  if (!await page.locator('.result-overlay').count()) throw Error('Direction-only death scenario did not reach a terminal result: ' + JSON.stringify(status.ecosystem))
  await page.evaluate(() => window.__flow.onEvents(window.__lastTerminalEvents));
  await page.screenshot({ path: `${out}/bloom-death.png` })
  await page.getByRole('button', { name: content.ui.hud.resultBackDish, exact: true }).click()
  await page.getByRole('button', { name: content.ui.actions.open_settings, exact: true }).click()
  await page.getByRole('button', { name: content.ui.actions.exportSave, exact: true }).click()
  const exported = JSON.parse(await page.locator('textarea[readonly]').inputValue())
  if (exported.nursery.completedRuns !== 3 || exported.lifeArchives.length !== 3) throw Error('Repeated terminal delivery duplicated rewards/sources: '+JSON.stringify({runs:exported.nursery.completedRuns,archives:exported.lifeArchives.length}));
  const latest = exported.lifeArchives.at(-1)
  if (!latest.deathTemplateId || latest.finalVisualRecipeId !== 'visual-lineage-bloom') throw Error('Death archive lost family: ' + JSON.stringify(latest))
  await page.getByRole('button', { name: content.ui.actions.backToLab, exact: true }).click()
  await page.reload()
  await page.locator('.lab-recent').click()
  await page.screenshot({ path: `${out}/bloom-death-archive-reloaded.png` })
  const proof = { policy: 'Actual offspring launched from actual exported save; deliberately steered toward larger hostile entities using direction input, no stat changes', elapsedMs: latest.survivalMs, deathTemplateId: latest.deathTemplateId, finalVisualRecipeId: latest.finalVisualRecipeId, completedRuns: exported.nursery.completedRuns, newSeed: exported.nursery.seeds.at(-1), errors }
  fs.writeFileSync(`${out}/death-proof.json`, JSON.stringify(proof, null, 2))
  console.log(JSON.stringify(proof, null, 2))
  await browser.close()
})().catch((error) => { console.error(error); process.exit(1) })
