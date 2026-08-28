import { useEffect, useRef } from 'react'
import type { GameEvent } from '../game/interactions'
import type { ProtoCellEngine } from '../game/engine'
import { createCanvasRenderer } from '../rendering/renderer'
import { createNumberFeed } from '../rendering/numbers'

export function GameCanvas({
  engine,
  label,
  onEvents,
}: {
  engine: ProtoCellEngine
  label: string
  onEvents?: (events: readonly GameEvent[]) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activePointerId = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = createCanvasRenderer(canvas, { quality: 'balanced', visualSeed: 727 })
    const numbers = createNumberFeed({ aggregateMs: 180, maxVisible: 8 })
    let frameId = 0
    let previousTime = performance.now()

    const frame = (now: number) => {
      const elapsed = Math.min(250, Math.max(0, now - previousTime))
      previousTime = now
      engine.advance(elapsed)
      const events = engine.drainEvents()
      for (const event of events) {
        if (event.type === 'engulfed' && event.predatorId === 'player') {
          numbers.push({ kind: 'biomass', amount: event.biomass, entityId: 'player', atMs: event.atMs })
        } else if (event.type === 'damaged' && event.targetId === 'player') {
          numbers.push({ kind: 'damage', amount: event.amount, entityId: 'player', atMs: event.atMs })
        } else if (event.type === 'blocked' && event.targetId === 'player') {
          numbers.push({ kind: 'block', amount: event.amount, entityId: 'player', atMs: event.atMs })
        }
      }
      if (events.length > 0) onEvents?.(events)
      renderer.render(engine.renderSnapshot(), numbers)
      frameId = requestAnimationFrame(frame)
    }

    frameId = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(frameId)
      renderer.destroy()
    }
  }, [engine, onEvents])

  const playerScreenPosition = () => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: 0, y: 0 }
  }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      aria-label={label}
      onPointerDown={(event) => {
        activePointerId.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        engine.input.start({ x: event.clientX, y: event.clientY }, playerScreenPosition())
      }}
      onPointerMove={(event) => {
        if (activePointerId.current !== event.pointerId) return
        engine.input.move({ x: event.clientX, y: event.clientY }, playerScreenPosition())
      }}
      onPointerUp={(event) => {
        if (activePointerId.current !== event.pointerId) return
        activePointerId.current = null
        engine.input.end()
      }}
      onPointerCancel={(event) => {
        if (activePointerId.current !== event.pointerId) return
        activePointerId.current = null
        engine.input.cancel()
      }}
    />
  )
}
