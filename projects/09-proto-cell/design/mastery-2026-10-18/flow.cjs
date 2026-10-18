const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs')
const out = 'design/mastery-2026-10-18'
const comfort = process.argv.includes('--comfort')
;(async () => {
  const { build } = await import('vite')
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: true, lib: { entry: 'design/mastery-2026-10-18/policy.ts', name: 'QAPolicy', formats: ['iife'] } } })
  const code = (Array.isArray(result) ? result[0] : result).output.find((item) => item.type === 'chunk').code
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4110/')
  if (comfort) {
    await page.getByRole('button', { name: '设置与存档', exact: true }).click()
    for (const name of ['减少动态', '减少闪烁', '减少震动']) await page.getByRole('checkbox', { name, exact: true }).check()
    await page.getByRole('button', { name: '返回培养舱', exact: true }).click()
    await page.evaluate(() => { window.__comfort = true })
  }
  await page.evaluate(() => { Date.now = () => 727; document.documentElement.style.setProperty('--safe-area-inset-top', '44px') })
  await page.getByRole('button', { name: '开始孵化', exact: true }).click()
  await page.evaluate(code + ';window.__setPolicyIntent=QAPolicy.setPolicyIntent')
  await page.evaluate(() => {
    const canvas = document.querySelector('.game-canvas')
    let fiber = canvas[Object.keys(canvas).find((key) => key.startsWith('__reactFiber$'))]
    while (fiber && !fiber.memoizedProps?.engine) fiber = fiber.return
    window.__terrain = fiber.memoizedProps
    window.__trace = []
    window.__masteryEvents = []
    window.__eventRealTimes = []
    window.__advanceTimes = []
    const engine = window.__terrain.engine
    const drain = engine.drainEvents.bind(engine)
    engine.drainEvents = () => { const events = drain(); window.__masteryEvents.push(...events); window.__eventRealTimes.push(...events.map((event) => ({ event, now: performance.now() }))); return events }
    const advance = engine.advance.bind(engine)
    engine.advance = (delta) => { window.__advanceTimes.push(performance.now()); advance(delta) }
  })
  let contact = false
  let crossed = false
  let last
  let broken = false
  let reversalAfterBreak = false
  let leapCount = 0
  let coverCaptured = false
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
    if (await page.locator('.form-transition-overlay').count()) {
      if (comfort) {
        const proof = await page.locator('.form-transition-overlay').evaluate((element) => ({ reducedMotion: element.dataset.reducedMotion, reducedFlash: element.dataset.reducedFlash, animations: [...element.querySelectorAll('.specimen-canvas')].map((canvas) => getComputedStyle(canvas).animationName), aura: getComputedStyle(element.querySelector('.form-transition-specimens'), '::before').animationName }))
        if (proof.reducedMotion !== 'true' || proof.reducedFlash !== 'true' || proof.animations.some((name) => name !== 'none') || proof.aura !== 'none') throw Error(JSON.stringify(proof))
        await page.screenshot({ path: out + '/comfort-evolution.png' })
        const layouts = []
        for (const [width, height] of [[375, 812], [390, 844], [430, 932], [844, 390]]) {
          await page.setViewportSize({ width, height })
          const confirm = page.getByRole('button', { name: '完成跃迁，进入新生态', exact: true })
          await confirm.scrollIntoViewIfNeeded()
          const geometry = await confirm.evaluate((button) => {
            const rect = button.getBoundingClientRect()
            const corners = [{ x: 8, y: 48 }, { x: innerWidth - 64, y: 48 }]
            return { overflow: document.documentElement.scrollWidth > innerWidth, visible: rect.top >= 0 && rect.bottom <= innerHeight, hostCollision: corners.some((corner) => rect.left < corner.x + 56 && rect.right > corner.x && rect.top < corner.y + 56 && rect.bottom > corner.y) }
          })
          if (geometry.overflow || !geometry.visible || geometry.hostCollision) throw Error(JSON.stringify({ width, ...geometry }))
          await page.screenshot({ path: out + '/evolution-' + width + '.png' })
          layouts.push({ width, height, safeAreaTop: 44, ...geometry })
        }
        fs.writeFileSync(out + '/comfort.json', JSON.stringify({ settingsChangedThroughActualUi: true, proof, layouts, errors }, null, 2))
        console.log(JSON.stringify(proof)); await browser.close(); return
      }
      await page.waitForTimeout(400)
      await page.screenshot({ path: out + '/evolution-' + leapCount + '.png' })
      await page.getByRole('button', { name: '完成跃迁，进入新生态', exact: true }).click()
      await page.waitForTimeout(120)
      await page.screenshot({ path: out + '/world-unfold-' + leapCount + '.png' })
      leapCount += 1
    }
    last = await page.evaluate(() => {
      const { engine, onEvents } = window.__terrain
      const events = []
      for (let step = 0; step < 6; step += 1) {
        const world = engine.renderSnapshot()
        const player = world.entities.find((entity) => entity.id === world.playerId)
        if (!player) break
        const hunter = world.entities.find((entity) => entity.id === `encounter-${world.lifecycle.tierIndex}`)
        if (!window.__comfort && !window.__coverTask && hunter && player.body.radius < hunter.body.radius * 0.9) {
          const points = world.environmentField.obstacles.filter((obstacle) => obstacle.kind === 'fiber').map((fiber) => {
            const dx = fiber.to.x - fiber.from.x, dy = fiber.to.y - fiber.from.y, length = Math.hypot(dx, dy)
            const t = Math.max(0.2, Math.min(0.8, ((player.position.x - fiber.from.x) * dx + (player.position.y - fiber.from.y) * dy) / (length * length)))
            const center = { x: fiber.from.x + dx * t, y: fiber.from.y + dy * t }, normal = { x: -dy / length, y: dx / length }
            const side = Math.sign((hunter.position.x - center.x) * normal.x + (hunter.position.y - center.y) * normal.y) || 1
            const target = { x: center.x - normal.x * side * 25, y: center.y - normal.y * side * 25 }
            return { target, distance: Math.hypot(player.position.x - target.x, player.position.y - target.y), phase: 'approach', atMs: world.elapsedMs, tier: world.lifecycle.tierIndex }
          }).sort((a, b) => a.distance - b.distance)
          window.__coverTask = points[0]
        }
        const cover = window.__coverTask
        if (cover && cover.phase !== 'done') {
          if (!hunter || player.body.radius >= hunter.body.radius * 0.9 || cover.tier !== world.lifecycle.tierIndex) { window.__coverTask = undefined; continue }
          engine.input.start({ x: 0, y: 0 })
          const dx = cover.target.x - player.position.x, dy = cover.target.y - player.position.y, length = Math.hypot(dx, dy) || 1
          engine.input.move({ x: dx / length * 120, y: dy / length * 120 })
          if (engine.snapshot().territory?.concealed) {
            cover.phase = 'done'; cover.proof = { atMs: world.elapsedMs, radius: player.body.radius, territory: engine.snapshot().territory, hunterState: hunter?.behaviorState }; break
          }
          if (world.elapsedMs - cover.atMs > 60000) throw Error('Cover steering timed out: ' + JSON.stringify({ cover, player: { position: player.position, radius: player.body.radius }, hunter: hunter && { position: hunter.position, radius: hunter.body.radius, state: hunter.behaviorState }, territory: engine.snapshot().territory }))
          engine.advance(1000 / 12)
          const next = engine.drainEvents(); events.push(...next)
          if (next.some((event) => ['mutation-ready', 'player-died', 'form-transition-ready', 'ending-reached'].includes(event.type))) break
          continue
        }
        if (!window.__crossing && world.lifecycle.tierIndex === 1 && player.body.radius >= 60) {
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
        if (crossing?.phase === 'done') { window.__setPolicyIntent(engine, world.elapsedMs, 'balanced'); break }
        if (crossing && crossing.phase !== 'done') {
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
      return { cover: window.__coverTask, crossing: window.__crossing, hud: engine.snapshot(), recent: window.__trace.at(-1), breaks: window.__masteryEvents.filter((event) => event.type === 'terrain-broken'), reversals: window.__masteryEvents.filter((event) => event.type === 'engulfed' && event.reversal) }
    })
    if (last.crossing?.phase === 'done') await page.waitForTimeout(100)
    if (!coverCaptured && last.cover?.phase === 'done') {
      await page.evaluate(() => window.__terrain.engine.input.cancel())
      await page.waitForTimeout(400)
      const settled = await page.evaluate(() => {
        const engine = window.__terrain.engine, world = engine.renderSnapshot()
        const hunter = world.entities.find((entity) => entity.id === `encounter-${world.lifecycle.tierIndex}`)
        const proof = { atMs: world.elapsedMs, territory: engine.snapshot().territory, hunterState: hunter?.behaviorState }
        window.__coverTask.settled = proof
        return proof
      })
      // An already released, committed strike may still continue while concealed.
      // The isolated production-engine regression separately proves reacquisition/search.
      if (!settled.territory.concealed) throw Error('Real cover was not retained: ' + JSON.stringify(settled))
      await page.evaluate(() => window.__terrain.engine.pause('user'))
      await page.waitForTimeout(100)
      await page.screenshot({ path: out + '/juvenile-cover.png' })
      await page.evaluate(() => window.__terrain.engine.resume('user'))
      coverCaptured = true
    }
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
          return { overflow: document.documentElement.scrollWidth > innerWidth, collisions, hudOverlap: objective.left < panel.right && objective.right > panel.left && objective.top < panel.bottom && objective.bottom > panel.top, terrainHint: document.querySelector('.ecosystem-objective__terrain')?.textContent, territoryHint: document.querySelector('.ecosystem-objective__territory')?.textContent }
        })
        if (geometry.overflow || geometry.collisions.length || geometry.hudOverlap || !(geometry.terrainHint || geometry.territoryHint)) throw Error(JSON.stringify({ width, ...geometry }))
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
    if (!broken && last.breaks.length) { broken = true; await page.waitForTimeout(80); await page.screenshot({ path: out + '/fiber-broken.png' }) }
    if (last.crossing?.phase === 'done') crossed = true
    if (broken && last.reversals.some((event) => event.atMs > last.breaks[0].atMs)) {
      reversalAfterBreak = true
      await page.waitForTimeout(80)
      await page.screenshot({ path: out + '/reversal-after-break.png' })
      break
    }
  }
  if (!coverCaptured || !crossed || !contact || !broken || !reversalAfterBreak || errors.length) throw Error(JSON.stringify({ coverCaptured, crossed, contact, broken, reversalAfterBreak, last, errors }))
  await page.screenshot({ path: out + '/fiber-crossed.png' })
  const proof = await page.evaluate(() => {
    const lastReversal = window.__eventRealTimes.filter((record) => record.event.type === 'engulfed' && record.event.reversal).at(-1)
    const nextAdvanceAt = lastReversal ? window.__advanceTimes.find((now) => now > lastReversal.now + 1) : undefined
    return { cover: window.__coverTask, crossing: window.__crossing, trace: window.__trace, events: window.__masteryEvents, hud: window.__terrain.engine.snapshot(), actualFrameImpactGapMs: nextAdvanceAt === undefined ? undefined : nextAdvanceAt - lastReversal.now }
  })
  if (!(proof.actualFrameImpactGapMs >= 50 && proof.actualFrameImpactGapMs < 200)) throw Error('Real RAF impact hold was not observed: ' + JSON.stringify(proof.actualFrameImpactGapMs))
  fs.writeFileSync(out + '/proof.json', JSON.stringify({ method: 'Production App, normal first-layer hunt and evolution; mature second-layer body steered across a real fiber interior. Direction inputs and fixed-step acceleration only; no entity or stat edits.', contact, crossed, ...proof, errors }, null, 2))
  fs.writeFileSync(out + '/mobile.json', JSON.stringify(layouts, null, 2))
  console.log(JSON.stringify({ crossed, contact, broken, reversalAfterBreak, crossing: proof.crossing, traceCount: proof.trace.length, errors }))
  await browser.close()
})().catch((error) => { console.error(error); process.exit(1) })
