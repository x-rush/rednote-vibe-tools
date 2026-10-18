const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const out = 'design/terrain-2026-10-18'
;(async () => {
  const { build } = await import('vite')
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: true, lib: { entry: 'design/lineage-2026-10-18/policy.ts', name: 'QAPolicy', formats: ['iife'] } } })
  const code = (Array.isArray(result) ? result[0] : result).output.find((item) => item.type === 'chunk').code
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4110/')
  await page.evaluate(() => { Date.now = () => 727; document.documentElement.style.setProperty('--safe-area-inset-top', '44px') })
  await page.getByRole('button', { name: '开始孵化', exact: true }).click()
  await page.evaluate(code + ';window.__setPolicyIntent=QAPolicy.setPolicyIntent')
  await page.evaluate(() => {
    const canvas = document.querySelector('.game-canvas')
    let fiber = canvas[Object.keys(canvas).find((key) => key.startsWith('__reactFiber$'))]
    while (fiber && !fiber.memoizedProps?.engine) fiber = fiber.return
    window.__terrain = fiber.memoizedProps
    window.__trace = []
  })
  let contact = false
  let crossed = false
  let last
  const layouts = []
  for (let batch = 0; batch < 2500; batch += 1) {
    if (await page.locator('.result-overlay').count()) throw Error('Normal run ended before terrain proof')
    if (await page.locator('.evolution-overlay').count()) {
      const radios = page.getByRole('radio')
      const content = JSON.parse(fs.readFileSync('src/content/content.json', 'utf8'))
      const texts = await radios.allTextContents()
      const ranked = content.organelles.filter((organ) => ['metabolism', 'move', 'feed'].includes(organ.category)).sort((a, b) => ['metabolism', 'move', 'feed'].indexOf(a.category) - ['metabolism', 'move', 'feed'].indexOf(b.category))
      const index = ranked.map((organ) => texts.findIndex((text) => text.includes(organ.name))).find((value) => value >= 0) ?? 0
      await radios.nth(index).click()
      await page.locator('.evolution-overlay__confirm').click()
    }
    if (await page.locator('.form-transition-overlay').count()) await page.getByRole('button', { name: '完成跃迁，进入新生态', exact: true }).click()
    last = await page.evaluate(() => {
      const { engine, onEvents } = window.__terrain
      const events = []
      for (let step = 0; step < 6; step += 1) {
        const world = engine.renderSnapshot()
        const player = world.entities.find((entity) => entity.id === world.playerId)
        if (!player) break
        if (!window.__crossing && world.lifecycle.tierIndex === 1 && player.body.radius >= 58) {
          const candidates = world.environmentField.obstacles.filter((obstacle) => obstacle.kind === 'fiber').map((fiber) => {
            const dx = fiber.to.x - fiber.from.x, dy = fiber.to.y - fiber.from.y
            const length = Math.hypot(dx, dy)
            const t = Math.max(0.2, Math.min(0.8, ((player.position.x - fiber.from.x) * dx + (player.position.y - fiber.from.y) * dy) / (length * length)))
            const center = { x: fiber.from.x + dx * t, y: fiber.from.y + dy * t }
            const normal = { x: -dy / length, y: dx / length }
            const side = Math.sign((player.position.x - center.x) * normal.x + (player.position.y - center.y) * normal.y) || 1
            const gap = player.body.radius + 30
            return { id: fiber.id, center, normal, side, from: { x: center.x + normal.x * gap * side, y: center.y + normal.y * gap * side }, to: { x: center.x - normal.x * gap * side, y: center.y - normal.y * gap * side }, distance: Math.hypot(player.position.x - center.x, player.position.y - center.y), phase: 'approach', startedAtMs: world.elapsedMs, radius: player.body.radius }
          }).sort((a, b) => a.distance - b.distance)
          window.__crossing = candidates[0]
        }
        engine.input.start({ x: 0, y: 0 })
        const crossing = window.__crossing
        if (crossing) {
          if (crossing.phase === 'approach' && Math.hypot(player.position.x - crossing.from.x, player.position.y - crossing.from.y) < 10) crossing.phase = 'cross'
          const target = crossing.phase === 'approach' ? crossing.from : crossing.to
          const dx = target.x - player.position.x, dy = target.y - player.position.y, length = Math.hypot(dx, dy) || 1
          engine.input.move({ x: dx / length * 120, y: dy / length * 120 })
          const signed = ((player.position.x - crossing.center.x) * crossing.normal.x + (player.position.y - crossing.center.y) * crossing.normal.y) * crossing.side
          window.__trace.push({ atMs: world.elapsedMs, phase: crossing.phase, signed, fiberControl: engine.snapshot().fiberControl })
          if (crossing.phase === 'cross' && signed < -player.body.radius - 5) { crossing.phase = 'done'; break }
        } else window.__setPolicyIntent(engine, world.elapsedMs, 'balanced')
        engine.advance(1000 / 12)
        const next = engine.drainEvents()
        events.push(...next)
        if (next.some((event) => ['mutation-ready', 'player-died', 'form-transition-ready', 'ending-reached'].includes(event.type))) break
      }
      if (events.length) onEvents(events)
      return { crossing: window.__crossing, hud: engine.snapshot(), recent: window.__trace.at(-1) }
    })
    if (!contact && last.crossing?.phase === 'cross' && Math.abs(last.recent?.signed) < last.crossing.radius * 0.9) {
      await page.waitForTimeout(100)
      await page.screenshot({ path: out + '/fiber-contact.png' })
      await page.evaluate(() => window.__terrain.engine.pause('user'))
      for (const [width, height] of [[375, 812], [390, 844], [430, 932], [844, 390]]) {
        await page.setViewportSize({ width, height })
        await page.waitForTimeout(100)
        const geometry = await page.evaluate(() => {
          const corners = [{ x: 8, y: 48, width: 56, height: 56 }, { x: innerWidth - 64, y: 48, width: 56, height: 56 }]
          const collisions = [...document.querySelectorAll('button')].filter((element) => !element.closest('[inert]')).flatMap((element) => {
            const rect = element.getBoundingClientRect()
            return rect.width && rect.height && corners.some((corner) => rect.left < corner.x + corner.width && rect.right > corner.x && rect.top < corner.y + corner.height && rect.bottom > corner.y) ? [element.getAttribute('aria-label') || element.textContent] : []
          })
          const panel = document.querySelector('.game-hud__panel').getBoundingClientRect()
          const objective = document.querySelector('.ecosystem-objective').getBoundingClientRect()
          return { overflow: document.documentElement.scrollWidth > innerWidth, collisions, hudOverlap: objective.left < panel.right && objective.right > panel.left && objective.top < panel.bottom && objective.bottom > panel.top, terrainHint: document.querySelector('.ecosystem-objective__terrain')?.textContent }
        })
        if (geometry.overflow || geometry.collisions.length || geometry.hudOverlap || !geometry.terrainHint) throw Error(JSON.stringify({ width, ...geometry }))
        await page.evaluate(() => {
          for (const side of ['left', 'right']) {
            const overlay = document.createElement('div')
            overlay.dataset.hostFixture = 'true'
            Object.assign(overlay.style, { position: 'fixed', top: '48px', [side]: '8px', width: '56px', height: '56px', background: '#ff2753bb', borderRadius: '50%', zIndex: 9999, pointerEvents: 'none' })
            document.body.append(overlay)
          }
        })
        await page.screenshot({ path: out + '/contact-' + width + '.png' })
        await page.evaluate(() => document.querySelectorAll('[data-host-fixture]').forEach((element) => element.remove()))
        layouts.push({ width, height, safeAreaTop: 44, ...geometry })
      }
      await page.setViewportSize({ width: 390, height: 844 })
      await page.evaluate(() => window.__terrain.engine.resume('user'))
      contact = true
    }
    if (last.crossing?.phase === 'done') { crossed = true; break }
  }
  if (!crossed || !contact || errors.length) throw Error(JSON.stringify({ crossed, contact, last, errors }))
  await page.screenshot({ path: out + '/fiber-crossed.png' })
  const proof = await page.evaluate(() => ({ crossing: window.__crossing, trace: window.__trace, hud: window.__terrain.engine.snapshot() }))
  fs.writeFileSync(out + '/proof.json', JSON.stringify({ method: 'Production App, normal first-layer hunt and evolution; mature second-layer body steered across a real fiber interior. Direction inputs and fixed-step acceleration only; no entity or stat edits.', contact, crossed, ...proof, errors }, null, 2))
  fs.writeFileSync(out + '/mobile.json', JSON.stringify(layouts, null, 2))
  console.log(JSON.stringify({ crossed, contact, crossing: proof.crossing, traceCount: proof.trace.length, errors }))
  await browser.close()
})().catch((error) => { console.error(error); process.exit(1) })
