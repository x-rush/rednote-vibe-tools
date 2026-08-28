import { useEffect, useRef } from 'react'
import type { GameEvent } from '../game/interactions'
import type { ProtoCellEngine } from '../game/engine'
import { createCanvasRenderer } from '../rendering/renderer'
import { createNumberFeed } from '../rendering/numbers'
import type { SaveSettings } from '../storage/codec'

export function clearPointerSession(
  input: ProtoCellEngine['input'],
  activePointer: { current: number | null },
  pointerId?: number,
): boolean {
  if (pointerId !== undefined && activePointer.current !== pointerId) return false
  activePointer.current = null
  input.cancel()
  return true
}

export function GameCanvas({
  engine,
  label,
  settings,
  onEvents,
  onCanvasError,
}: {
  engine: ProtoCellEngine
  label: string
  settings: SaveSettings
  onEvents?: (events: readonly GameEvent[]) => void
  onCanvasError?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ReturnType<typeof createCanvasRenderer> | null>(null)
  const activePointerId = useRef<number | null>(null)
  const onEventsRef = useRef(onEvents)
  const onCanvasErrorRef = useRef(onCanvasError)
  onEventsRef.current = onEvents
  onCanvasErrorRef.current = onCanvasError

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: ReturnType<typeof createCanvasRenderer>
    try {
      renderer = createCanvasRenderer(canvas, {
        quality: settings.graphics,
        lowParticles: settings.lowParticles,
        visualSeed: 727,
        reducedMotion: settings.reducedMotion,
        reducedFlash: settings.reducedFlash,
      })
      rendererRef.current = renderer
    } catch {
      onCanvasErrorRef.current?.()
      return
    }
    const numbers = createNumberFeed({ aggregateMs: 180, maxVisible: 8 })
    let frameId = 0
    let failed = false
    let previousTime = performance.now()
    const clearMovement = () => clearPointerSession(engine.input, activePointerId)
    const failCanvas = () => {
      if (failed) return
      failed = true
      cancelAnimationFrame(frameId)
      clearMovement()
      onCanvasErrorRef.current?.()
    }
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      failCanvas()
    }

    const frame = (now: number) => {
      try {
        const elapsed = Math.min(250, Math.max(0, now - previousTime))
        previousTime = now
        engine.advance(elapsed)
        const events = engine.drainEvents()
        const bossId = engine.worldSnapshot().boss?.id
        for (const event of events) {
          if (event.type === 'engulfed' && event.predatorId === 'player') {
            numbers.push({ kind: 'biomass', amount: event.biomass, entityId: 'player', atMs: event.atMs })
          } else if (event.type === 'damaged' && event.targetId === 'player') {
            numbers.push({ kind: 'damage', amount: event.amount, entityId: 'player', atMs: event.atMs })
          } else if (event.type === 'damaged' && event.targetId === bossId) {
            numbers.push({ kind: 'damage', amount: event.amount, entityId: event.targetId, atMs: event.atMs })
          } else if (event.type === 'blocked' && event.targetId === 'player') {
            numbers.push({ kind: 'block', amount: event.amount, entityId: 'player', atMs: event.atMs })
          }
        }
        if (events.length > 0) onEventsRef.current?.(events)
        renderer.render(engine.renderSnapshot(), numbers)
        frameId = requestAnimationFrame(frame)
      } catch {
        failCanvas()
      }
    }

    frameId = requestAnimationFrame(frame)
    window.addEventListener('resize', clearMovement)
    canvas.addEventListener('contextlost', handleContextLost)
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', clearMovement)
      canvas.removeEventListener('contextlost', handleContextLost)
      clearMovement()
      renderer.destroy()
      if (rendererRef.current === renderer) rendererRef.current = null
    }
  }, [engine, settings.graphics, settings.lowParticles, settings.reducedFlash, settings.reducedMotion])

  const playerScreenPosition = () => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const rendered = rendererRef.current?.playerScreenPosition()
    if (rect && rendered) return { x: rect.left + rendered.x, y: rect.top + rendered.y }
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
        clearPointerSession(engine.input, activePointerId, event.pointerId)
      }}
      onLostPointerCapture={(event) => clearPointerSession(engine.input, activePointerId, event.pointerId)}
    />
  )
}
