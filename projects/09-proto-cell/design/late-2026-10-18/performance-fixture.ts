import { createGameEngine } from '../../src/game/engine'
import { createCanvasRenderer } from '../../src/rendering/renderer'
import { createNumberFeed } from '../../src/rendering/numbers'
import content from '../../src/content/content.json'

const stats = (xs: number[]) => {
  const sorted = xs.slice().sort((a,b)=>a-b)
  return { mean: xs.reduce((a,b)=>a+b,0)/xs.length, p50: sorted[Math.floor(sorted.length*.5)], p95: sorted[Math.floor(sorted.length*.95)], max: sorted.at(-1) }
}
;(window as any).runFixture = async ({ tierIndex, dense = false, quality = 'balanced', frames = 180 }: any) => {
  const tier = content.scaleTiers[tierIndex]
  const engine = createGameEngine({ seed: 727, environmentId: tier.environmentId, initialElapsedMs: 18000, initialLifecycle: { tierIndex, evolutionPressure: .65 } })
  engine.setViewport({ width: 390, height: 844 })
  engine.start()
  if (dense) (engine as any).qaPopulate()
  const canvas = document.querySelector('canvas')!
  const renderer = createCanvasRenderer(canvas, { quality, visualSeed: 727 })
  const numbers = createNumberFeed({ aggregateMs: 180, maxVisible: 8 })
  const longTasks: number[] = []
  const observer = new PerformanceObserver(list=>list.getEntries().forEach(x=>longTasks.push(x.duration)))
  const update: number[] = [], render: number[] = [], gaps: number[] = [], counts: number[] = []
  let prev = 0, lastSnapshot: any
  let renderTemplates = engine.renderSnapshot().entities.filter(e=>e.id!=='player')
  // Warm actual source renderer/assets for 30 animation frames, then sample.
  for (let i = -30; i < frames; i++) {
    const now: number = await new Promise(resolve=>requestAnimationFrame(resolve))
    if(i===0) observer.observe({ type: 'longtask', buffered: false })
    const player = engine.renderSnapshot().entities.find(e=>e.id === 'player')!
    // Source fixture protection: avoid death interrupting the fixed measurement budget.
    player.membrane = 1e8
    const start = performance.now()
    engine.advance(1000/60)
    const simulated = performance.now()
    const snapshot = engine.renderSnapshot()
    let drawSnapshot = snapshot
    if (dense) {
      // Deliberately synthetic, all-visible 180 entity render stress. The real
      // engine runs the injected near-cap world population; clones are renderer-only.
      const templates = snapshot.entities.filter(e=>e.id !== 'player')
      if(templates.length) renderTemplates = templates
      const clones = Array.from({ length: 179 }, (_, n) => {
        const original = renderTemplates[n % renderTemplates.length]
        const angle = n * 2.399963
        const spread = (0.6 + Math.sqrt(n / 179) * 3.6) * player.body.radius
        const position = { x: player.position.x + Math.cos(angle)*spread, y: player.position.y + Math.sin(angle)*spread }
        const dx = position.x-original.position.x, dy=position.y-original.position.y
        return { ...original, id: `qa-clone-${n}`, position, body: { ...original.body, center: position, contour: original.body.contour.map(p=>({x:p.x+dx,y:p.y+dy})) } }
      })
      drawSnapshot = { ...snapshot, entities: [snapshot.entities.find(e=>e.id==='player')!, ...clones] }
    }
    const renderStart = performance.now()
    renderer.render(drawSnapshot, numbers)
    const end = performance.now()
    engine.drainEvents()
    if(i>=0) { update.push(simulated-start); render.push(end-renderStart); counts.push(snapshot.entities.length); if(prev)gaps.push(now-prev) }
    prev=now
    lastSnapshot = snapshot
  }
  await new Promise(resolve=>setTimeout(resolve,0))
  observer.disconnect()
  const result = { tierIndex, environmentId: tier.environmentId, quality, dense, frames, viewport: { width:390,height:844,dpr:devicePixelRatio }, updateMs: stats(update), renderMs: stats(render), frameGapMs: stats(gaps), framesOver25ms: gaps.filter(x=>x>25).length, longTasks: { count: longTasks.length, maxMs: Math.max(0,...longTasks) }, engineEntities: { min: Math.min(...counts), max: Math.max(...counts) }, renderedFixtureEntities: dense?180:undefined, lifecycleAtEnd: lastSnapshot.lifecycle, elapsedMs: lastSnapshot.elapsedMs, playerActiveAtEnd: lastSnapshot.entities.some((e:any)=>e.id==='player'&&e.status==='active') }
  renderer.destroy(); engine.destroy()
  return result
}
