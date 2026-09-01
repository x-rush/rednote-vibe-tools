import { useCallback, useEffect, useRef, useState } from 'react'
import { createFish, createLeaves, getLeafCollisionRadius, seededRandom, stepFish, stepLeaves } from '../simulation.ts'
import type { Bounds, Fish, Leaf, Point, PointerState } from '../simulation.ts'
import { SpatialGrid } from '../spatial-grid.ts'
import { drawFish, drawLeaf, drawRipple, drawTrail, drawWater } from './draw.ts'
import type { PosterBackground } from './draw.ts'
import { ParticleField } from './particles.ts'

const FISH_COUNTS = [28, 44, 64]
const LEAF_COUNTS = [58, 112, 188]
const SPEEDS = [0.72, 1, 1.26]

type PondProps = {
  leafLevel: number
  fishLevel: number
  speedLevel: number
  resetKey: number
  ariaLabel: string
  keyboardHint: string
  background: PosterBackground | null
}

export function Pond({ leafLevel, fishLevel, speedLevel, resetKey, ariaLabel, keyboardHint, background }: PondProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fishRef = useRef<Fish[]>([])
  const leavesRef = useRef<Leaf[]>([])
  const leafGridRef = useRef(new SpatialGrid<Leaf>(64))
  const maxLeafCollisionRadiusRef = useRef(0)
  const pointerRef = useRef<PointerState | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const particlesRef = useRef(new ParticleField())
  const boundsRef = useRef<Bounds>({ width: 390, height: 844 })
  const frameRef = useRef(0)
  const resizeFrameRef = useRef(0)
  const lastRef = useRef(0)
  const rippleTimeRef = useRef(0)
  const leafAccumulatorRef = useRef(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  const rebuildScene = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    boundsRef.current = { width: rect.width, height: rect.height }
    const areaScale = Math.max(1, Math.min(1.08, (rect.width * rect.height) / (390 * 844)))
    const random = seededRandom(9182 + resetKey * 37)
    leavesRef.current = createLeaves(Math.round(LEAF_COUNTS[leafLevel] * areaScale), boundsRef.current, random)
    fishRef.current = createFish(FISH_COUNTS[fishLevel], boundsRef.current, random)
    maxLeafCollisionRadiusRef.current = leavesRef.current.reduce(
      (maximum, leaf) => Math.max(maximum, getLeafCollisionRadius(leaf)),
      0,
    )
    leafGridRef.current.clear()
    leafGridRef.current.insertAll(leavesRef.current)
    const pointer = pointerRef.current
    if (pointer) {
      pointer.x = Math.max(0, Math.min(rect.width, pointer.x))
      pointer.y = Math.max(0, Math.min(rect.height, pointer.y))
    }
    particlesRef.current.clear()
    leafAccumulatorRef.current = 0
  }, [fishLevel, leafLevel, resetKey])

  useEffect(() => {
    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = requestAnimationFrame(rebuildScene)
    }
    scheduleResize()
    const observer = new ResizeObserver(scheduleResize)
    const canvas = canvasRef.current
    if (canvas) observer.observe(canvas)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(resizeFrameRef.current)
    }
  }, [rebuildScene])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const readPreference = () => setReducedMotion(query.matches)
    readPreference()
    query.addEventListener('change', readPreference)
    return () => query.removeEventListener('change', readPreference)
  }, [])

  useEffect(() => {
    let disposed = false
    const render = (time: number) => {
      frameRef.current = 0
      if (disposed || document.hidden) return
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return
      if (reducedMotion && lastRef.current && time - lastRef.current < 30) {
        frameRef.current = requestAnimationFrame(render)
        return
      }
      const bounds = boundsRef.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const dt = Math.min(0.05, Math.max(0.001, (time - (lastRef.current || time)) / 1000))
      lastRef.current = time

      const pointer = pointerRef.current
      if (pointer && !pointer.active) {
        pointer.strength = Math.max(0, pointer.strength - dt * 0.9)
        if (pointer.strength === 0) pointerRef.current = null
      }
      fishRef.current = stepFish(
        fishRef.current,
        leavesRef.current,
        bounds,
        pointerRef.current,
        dt,
        SPEEDS[speedLevel] * (reducedMotion ? 0.72 : 1),
        {
          leafGrid: leafGridRef.current,
          maxLeafCollisionRadius: maxLeafCollisionRadiusRef.current,
        },
      )
      leafAccumulatorRef.current += dt
      if (leafAccumulatorRef.current >= 1 / 30) {
        leavesRef.current = stepLeaves(
          leavesRef.current,
          fishRef.current,
          bounds,
          Math.min(leafAccumulatorRef.current, 1 / 15),
        )
        leafAccumulatorRef.current = 0
        leafGridRef.current.clear()
        leafGridRef.current.insertAll(leavesRef.current)
      }
      if (!reducedMotion) particlesRef.current.emitTrails(fishRef.current, (pointerRef.current?.strength ?? 0) > 0.2, false)
      particlesRef.current.update(dt)

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawWater(context, bounds, time, reducedMotion, background)
      for (const trail of particlesRef.current.trails) drawTrail(context, trail, reducedMotion)
      for (const fish of fishRef.current) drawFish(context, fish)
      for (const leaf of leavesRef.current) drawLeaf(context, leaf, time, reducedMotion)
      for (const ripple of particlesRef.current.ripples) drawRipple(context, ripple)
      frameRef.current = requestAnimationFrame(render)
    }
    const resume = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
        return
      }
      lastRef.current = 0
      if (!frameRef.current) frameRef.current = requestAnimationFrame(render)
    }
    frameRef.current = requestAnimationFrame(render)
    document.addEventListener('visibilitychange', resume)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', resume)
      cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [background, reducedMotion, speedLevel])

  const readPointer = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null) return
    activePointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = readPointer(event)
    pointerRef.current = { ...point, active: true, strength: 1, trail: [point] }
    particlesRef.current.addRipple(point, 1)
    rippleTimeRef.current = performance.now()
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const point = readPointer(event)
    const pointer = pointerRef.current
    if (!pointer) return
    pointer.x = point.x
    pointer.y = point.y
    const last = pointer.trail.at(-1)
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 6) {
      pointer.trail.push(point)
      if (pointer.trail.length > 18) pointer.trail.shift()
    }
    const now = performance.now()
    if (now - rippleTimeRef.current > 150) {
      particlesRef.current.addRipple(point, 0.7)
      rippleTimeRef.current = now
    }
  }
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    activePointerIdRef.current = null
    if (pointerRef.current) pointerRef.current.active = false
  }

  const moveKeyboardTarget = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null) return
    const movement = event.key === 'ArrowLeft' ? [-28, 0]
      : event.key === 'ArrowRight' ? [28, 0]
        : event.key === 'ArrowUp' ? [0, -28]
          : event.key === 'ArrowDown' ? [0, 28]
            : null
    if (!movement) {
      if (event.key === 'Escape' && pointerRef.current) {
        pointerRef.current.active = false
      }
      return
    }
    event.preventDefault()
    const bounds = boundsRef.current
    const pointer = pointerRef.current
    const point = {
      x: Math.max(12, Math.min(bounds.width - 12, (pointer?.x ?? bounds.width * 0.5) + movement[0])),
      y: Math.max(12, Math.min(bounds.height - 12, (pointer?.y ?? bounds.height * 0.55) + movement[1])),
    }
    const trail = pointer?.trail ?? []
    trail.push(point)
    if (trail.length > 18) trail.shift()
    pointerRef.current = { ...point, active: true, strength: 1, trail }
    particlesRef.current.addRipple(point, 0.65)
  }

  const stopKeyboardTarget = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!event.key.startsWith('Arrow') || activePointerIdRef.current !== null) return
    if (pointerRef.current) pointerRef.current.active = false
  }

  const blurKeyboardTarget = () => {
    if (activePointerIdRef.current !== null) return
    if (pointerRef.current) pointerRef.current.active = false
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pond"
        role="application"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-describedby="pond-keyboard-hint"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={moveKeyboardTarget}
        onKeyUp={stopKeyboardTarget}
        onBlur={blurKeyboardTarget}
      />
      <span className="sr-only" id="pond-keyboard-hint">{keyboardHint}</span>
    </>
  )
}
