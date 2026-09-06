import { useEffect, useRef } from 'react'
import type { GameEvent } from '../game/interactions'
import type { ProtoCellEngine } from '../game/engine'
import { createCanvasRenderer } from '../rendering/renderer'
import { createNumberFeed } from '../rendering/numbers'
import type { SaveSettings } from '../storage/codec'
import { getContent } from '../content'
import { resolveFloatingJoystick } from './joystick'

export type CanvasFailurePhase = 'initialization' | 'frame' | 'context-lost'
export type CanvasFailure = { phase: CanvasFailurePhase; message: string }

export function canvasFailureFrom(error: unknown, phase: CanvasFailurePhase): CanvasFailure {
  const fallback = phase === 'context-lost' ? 'Canvas context lost' : 'Unknown canvas failure'
  return {
    phase,
    message: error instanceof Error && error.message ? error.message : fallback,
  }
}

const namedEngulfables = (() => {
  const content = getContent()
  return new Map<string, string>(
    [...content.nutrients, ...content.creatures, ...content.bosses]
      .map((definition) => [definition.id, definition.name]),
  )
})()

export function engulfPreyName(preyDefinitionId?: string): string | undefined {
  return preyDefinitionId ? namedEngulfables.get(preyDefinitionId) : undefined
}

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

function paintFloatingJoystick(element: HTMLDivElement | null, origin: { x: number; y: number }, pointer = origin) {
  if (!element) return
  const visual = resolveFloatingJoystick(origin, pointer)
  element.style.setProperty('--joystick-x', `${visual.origin.x}px`)
  element.style.setProperty('--joystick-y', `${visual.origin.y}px`)
  element.style.setProperty('--joystick-knob-x', `${visual.knobOffset.x}px`)
  element.style.setProperty('--joystick-knob-y', `${visual.knobOffset.y}px`)
  element.dataset.active = 'true'
}

function hideFloatingJoystick(element: HTMLDivElement | null) {
  if (!element) return
  element.dataset.active = 'false'
  element.style.setProperty('--joystick-knob-x', '0px')
  element.style.setProperty('--joystick-knob-y', '0px')
}

export function canvasViewport(canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight'>): { width: number; height: number } {
  return {
    width: canvas.clientWidth > 0 ? canvas.clientWidth : 390,
    height: canvas.clientHeight > 0 ? canvas.clientHeight : 844,
  }
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
  onCanvasError?: (failure: CanvasFailure) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ReturnType<typeof createCanvasRenderer> | null>(null)
  const activePointerId = useRef<number | null>(null)
  const joystickOrigin = useRef<{ x: number; y: number } | null>(null)
  const joystickRef = useRef<HTMLDivElement>(null)
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
    } catch (error) {
      const failure = canvasFailureFrom(error, 'initialization')
      console.error('[proto-cell] canvas initialization failed', error)
      onCanvasErrorRef.current?.(failure)
      return
    }
    const numbers = createNumberFeed({ aggregateMs: 180, maxVisible: 8, chainWindowMs: 1400 })
    let frameId = 0
    let failed = false
    let previousTime = performance.now()
    const clearMovement = () => {
      clearPointerSession(engine.input, activePointerId)
      joystickOrigin.current = null
      hideFloatingJoystick(joystickRef.current)
    }
    const syncViewport = () => engine.setViewport(canvasViewport(canvas))
    const failCanvas = (failure: CanvasFailure, error?: unknown) => {
      if (failed) return
      failed = true
      cancelAnimationFrame(frameId)
      clearMovement()
      console.error(`[proto-cell] canvas ${failure.phase} failed`, error ?? failure.message)
      onCanvasErrorRef.current?.(failure)
    }
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      failCanvas(canvasFailureFrom(undefined, 'context-lost'))
    }

    const frame = (now: number) => {
      try {
        syncViewport()
        const elapsed = Math.min(250, Math.max(0, now - previousTime))
        previousTime = now
        engine.advance(elapsed)
        const events = engine.drainEvents()
        const bossId = engine.worldSnapshot().boss?.id
        for (const event of events) {
          if (event.type === 'engulfed' && event.predatorId === 'player') {
            numbers.push({
              kind: 'biomass',
              amount: event.biomass,
              entityId: 'player',
              label: engulfPreyName(event.preyDefinitionId),
              atMs: event.atMs,
              chain: event.chain,
            })
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
      } catch (error) {
        failCanvas(canvasFailureFrom(error, 'frame'), error)
      }
    }

    frameId = requestAnimationFrame(frame)
    window.addEventListener('resize', clearMovement)
    window.addEventListener('resize', syncViewport)
    canvas.addEventListener('contextlost', handleContextLost)
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', clearMovement)
      window.removeEventListener('resize', syncViewport)
      canvas.removeEventListener('contextlost', handleContextLost)
      clearMovement()
      renderer.destroy()
      if (rendererRef.current === renderer) rendererRef.current = null
    }
  }, [engine, settings.graphics, settings.lowParticles, settings.reducedFlash, settings.reducedMotion])

  const clearGesture = (pointerId?: number) => {
    const cleared = clearPointerSession(engine.input, activePointerId, pointerId)
    if (cleared) {
      joystickOrigin.current = null
      hideFloatingJoystick(joystickRef.current)
    }
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label={label}
        onPointerDown={(event) => {
          if (activePointerId.current !== null) return
          const pointer = { x: event.clientX, y: event.clientY }
          activePointerId.current = event.pointerId
          joystickOrigin.current = pointer
          event.currentTarget.setPointerCapture(event.pointerId)
          engine.input.start(pointer)
          paintFloatingJoystick(joystickRef.current, pointer)
        }}
        onPointerMove={(event) => {
          if (activePointerId.current !== event.pointerId || !joystickOrigin.current) return
          const pointer = { x: event.clientX, y: event.clientY }
          engine.input.move(pointer)
          paintFloatingJoystick(joystickRef.current, joystickOrigin.current, pointer)
        }}
        onPointerUp={(event) => clearGesture(event.pointerId)}
        onPointerCancel={(event) => clearGesture(event.pointerId)}
        onLostPointerCapture={(event) => clearGesture(event.pointerId)}
      />
      <div ref={joystickRef} className="floating-joystick" data-active="false" aria-hidden="true">
        <span><i /></span>
      </div>
    </>
  )
}
