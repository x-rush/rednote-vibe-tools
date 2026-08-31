import { useCallback, useEffect, useRef, useState } from 'react'
import content from './content/content.json'
import { createFish, createLeaves, seededRandom, stepFish } from './simulation.ts'
import type { Bounds, Fish, Leaf, Point } from './simulation.ts'

type Ripple = Point & { born: number }

const FISH_COUNTS = [12, 22, 34]
const LEAF_COUNTS = [18, 28, 38]
const SPEEDS = [0.7, 1, 1.3]

function drawLeaf(ctx: CanvasRenderingContext2D, leaf: Leaf, time: number) {
  const bob = Math.sin(time * 0.0007 + leaf.x) * 1.1
  ctx.save()
  ctx.translate(leaf.x, leaf.y + bob)
  ctx.rotate(leaf.rotation)
  const gradient = ctx.createRadialGradient(-leaf.radius * 0.2, -leaf.radius * 0.24, 1, 0, 0, leaf.radius)
  gradient.addColorStop(0, '#5bb96e')
  gradient.addColorStop(0.58, '#218f54')
  gradient.addColorStop(1, '#0b6d43')
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, leaf.radius, leaf.notch, Math.PI * 2 - leaf.notch)
  ctx.closePath()
  ctx.fillStyle = 'rgba(8, 66, 46, .13)'
  ctx.translate(0, 2.5)
  ctx.fill()
  ctx.translate(0, -2.5)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.strokeStyle = 'rgba(202, 239, 176, .5)'
  ctx.lineWidth = 0.7
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-leaf.radius * 0.8, 0)
  ctx.moveTo(-leaf.radius * 0.08, 0)
  ctx.lineTo(-leaf.radius * 0.58, -leaf.radius * 0.48)
  ctx.moveTo(-leaf.radius * 0.08, 0)
  ctx.lineTo(-leaf.radius * 0.58, leaf.radius * 0.48)
  ctx.strokeStyle = 'rgba(209, 242, 184, .3)'
  ctx.stroke()
  if (leaf.flower) drawFlower(ctx, leaf.radius)
  ctx.restore()
}

function drawFlower(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.save()
  ctx.rotate(-0.35)
  for (let index = 0; index < 9; index += 1) {
    ctx.rotate((Math.PI * 2) / 9)
    ctx.beginPath()
    ctx.ellipse(0, -radius * 0.2, radius * 0.13, radius * 0.33, 0, 0, Math.PI * 2)
    ctx.fillStyle = index % 2 ? '#f6b6bf' : '#ffd5d1'
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = '#f0c858'
  ctx.fill()
  ctx.restore()
}

function drawFish(ctx: CanvasRenderingContext2D, fish: Fish, time: number) {
  const angle = Math.atan2(fish.vy, fish.vx)
  const wag = Math.sin(fish.phase + time * 0.003) * 0.28
  const palettes = [
    ['#df3b2f', '#f5a45a'], ['#ef5b34', '#f6c17a'], ['#c92f29', '#f7d8a8'],
    ['#e84b3c', '#f39b67'], ['#b82c32', '#f8c679'],
  ]
  const palette = palettes[fish.tone % palettes.length]
  ctx.save()
  ctx.translate(fish.x, fish.y)
  ctx.rotate(angle)
  ctx.globalAlpha = 0.94
  ctx.save()
  ctx.translate(-fish.size * 1.05, 0)
  ctx.rotate(wag)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-fish.size * 1.2, -fish.size * 0.7, -fish.size * 1.55, -fish.size * 0.92)
  ctx.quadraticCurveTo(-fish.size * 1.35, 0, -fish.size * 1.55, fish.size * 0.92)
  ctx.quadraticCurveTo(-fish.size * 1.1, fish.size * 0.58, 0, 0)
  ctx.fillStyle = palette[0]
  ctx.fill()
  ctx.restore()
  const gradient = ctx.createLinearGradient(-fish.size, 0, fish.size * 1.15, 0)
  gradient.addColorStop(0, palette[0])
  gradient.addColorStop(0.72, palette[1])
  gradient.addColorStop(1, '#fff0c8')
  ctx.beginPath()
  ctx.ellipse(0, 0, fish.size * 1.25, fish.size * 0.52, 0, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-fish.size * 0.25, -fish.size * 0.2)
  ctx.quadraticCurveTo(-fish.size * 0.15, -fish.size, fish.size * 0.35, -fish.size * 0.35)
  ctx.fillStyle = 'rgba(180, 35, 34, .62)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(fish.size * 0.72, -fish.size * 0.12, Math.max(0.8, fish.size * 0.075), 0, Math.PI * 2)
  ctx.fillStyle = '#26372d'
  ctx.fill()
  ctx.restore()
}

function drawWater(ctx: CanvasRenderingContext2D, bounds: Bounds, time: number) {
  const background = ctx.createLinearGradient(0, 0, bounds.width, bounds.height)
  background.addColorStop(0, '#eef0e8')
  background.addColorStop(0.5, '#dbe8dc')
  background.addColorStop(1, '#e8e1d5')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, bounds.width, bounds.height)
  ctx.lineWidth = 0.7
  for (let index = 0; index < 14; index += 1) {
    const y = ((index * 83 + time * 0.006) % (bounds.height + 80)) - 40
    ctx.beginPath()
    for (let x = -20; x < bounds.width + 20; x += 10) {
      const waveY = y + Math.sin(x * 0.026 + time * 0.0006 + index) * 5
      if (x === -20) ctx.moveTo(x, waveY)
      else ctx.lineTo(x, waveY)
    }
    ctx.strokeStyle = index % 2 ? 'rgba(255,255,255,.18)' : 'rgba(66,121,103,.08)'
    ctx.stroke()
  }
}

function Pond({ leafLevel, fishLevel, speedLevel, resetKey, onFollowing }: {
  leafLevel: number; fishLevel: number; speedLevel: number; resetKey: number; onFollowing: (value: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fishRef = useRef<Fish[]>([])
  const leavesRef = useRef<Leaf[]>([])
  const pointerRef = useRef<Point | null>(null)
  const ripplesRef = useRef<Ripple[]>([])
  const frameRef = useRef(0)
  const lastRef = useRef(0)

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const bounds = { width: rect.width, height: rect.height }
    const random = seededRandom(9182 + resetKey * 37)
    leavesRef.current = createLeaves(LEAF_COUNTS[leafLevel], bounds, random)
    fishRef.current = createFish(FISH_COUNTS[fishLevel], bounds, random)
  }, [fishLevel, leafLevel, resetKey])

  useEffect(() => {
    resize()
    const observer = new ResizeObserver(resize)
    if (canvasRef.current) observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [resize])

  useEffect(() => {
    const render = (time: number) => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const dt = Math.min(0.032, Math.max(0.001, (time - (lastRef.current || time)) / 1000))
      lastRef.current = time
      const bounds = { width: rect.width, height: rect.height }
      fishRef.current = stepFish(fishRef.current, leavesRef.current, bounds, pointerRef.current, dt, SPEEDS[speedLevel])
      drawWater(context, bounds, time)
      for (const ripple of ripplesRef.current) {
        const age = (time - ripple.born) / 1000
        context.beginPath()
        context.arc(ripple.x, ripple.y, 12 + age * 50, 0, Math.PI * 2)
        context.strokeStyle = `rgba(67, 117, 103, ${Math.max(0, 0.3 - age * 0.2)})`
        context.lineWidth = 1
        context.stroke()
      }
      ripplesRef.current = ripplesRef.current.filter((ripple) => time - ripple.born < 1400)
      for (const fish of fishRef.current) drawFish(context, fish, time)
      for (const leaf of leavesRef.current) drawLeaf(context, leaf, time)
      frameRef.current = requestAnimationFrame(render)
    }
    frameRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frameRef.current)
  }, [speedLevel])

  const readPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = readPointer(event)
    pointerRef.current = point
    ripplesRef.current.push({ ...point, born: performance.now() })
    onFollowing(true)
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const point = readPointer(event)
    pointerRef.current = point
    if (ripplesRef.current.length === 0 || performance.now() - ripplesRef.current.at(-1)!.born > 180) {
      ripplesRef.current.push({ ...point, born: performance.now() })
    }
  }
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    pointerRef.current = null
    onFollowing(false)
  }

  return <canvas ref={canvasRef} className="pond" aria-label="可触摸互动的莲池画布" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
}

function SegmentedControl({ label, value, onChange, names }: { label: string; value: number; onChange: (value: number) => void; names?: string[] }) {
  return (
    <fieldset className="control">
      <legend>{label}</legend>
      <div className="segments">
        {[0, 1, 2].map((option) => (
          <button type="button" key={option} className={value === option ? 'active' : ''} onClick={() => onChange(option)} aria-pressed={value === option}>
            {names?.[option] ?? ['少', '中', '多'][option]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function App() {
  const [leafLevel, setLeafLevel] = useState(1)
  const [fishLevel, setFishLevel] = useState(1)
  const [speedLevel, setSpeedLevel] = useState(1)
  const [resetKey, setResetKey] = useState(0)
  const [following, setFollowing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <main className="app-shell">
      <Pond leafLevel={leafLevel} fishLevel={fishLevel} speedLevel={speedLevel} resetKey={resetKey} onFollowing={setFollowing} />
      <header className="masthead">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="subtitle">{content.subtitle}</p>
      </header>
      <div className={`touch-hint ${following ? 'following' : ''}`} aria-live="polite">
        <span className="ripple-icon" />
        {following ? content.hintActive : content.hintIdle}
      </div>
      <section className={`settings ${panelOpen ? 'open' : 'closed'}`} aria-label="池塘设置">
        <button className="panel-toggle" type="button" onClick={() => setPanelOpen((value) => !value)} aria-expanded={panelOpen}>
          <span>{panelOpen ? content.hideLabel : content.showLabel}</span><b>{panelOpen ? '↓' : '↑'}</b>
        </button>
        <div className="settings-body">
          <div className="settings-title"><span>水 景 调 律</span><i /></div>
          <div className="control-grid">
            <SegmentedControl label={content.lotusLabel} value={leafLevel} onChange={setLeafLevel} />
            <SegmentedControl label={content.fishLabel} value={fishLevel} onChange={setFishLevel} />
            <SegmentedControl label={content.speedLabel} value={speedLevel} onChange={setSpeedLevel} names={content.speedNames} />
          </div>
          <button className="reset" type="button" onClick={() => setResetKey((value) => value + 1)}>{content.resetLabel}<span>↻</span></button>
        </div>
      </section>
    </main>
  )
}

export default App
