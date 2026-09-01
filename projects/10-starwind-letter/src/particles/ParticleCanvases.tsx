import { useEffect, useRef } from 'react'
import type { Mood } from '../content/messages'
import type { TimelineSample } from '../experience/timeline'
import { drawExterior, drawInterior } from './renderer'
import { createParticleWorld, stepParticleWorld, type ParticleWorld } from './system'

interface ParticleCanvasesProps {
  readonly sample: TimelineSample
  readonly sashOpen: number
  readonly mood: Mood
  readonly run: number
  readonly reducedMotion: boolean
  readonly enabled?: boolean
}

function prepareCanvas(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const targetWidth = Math.max(1, Math.round(width * dpr))
  const targetHeight = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth
    canvas.height = targetHeight
  }
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.setTransform(targetWidth / 390, 0, 0, targetHeight / 844, 0, 0)
  context.clearRect(0, 0, 390, 844)
  return context
}

export function ParticleCanvases({ sample, sashOpen, mood, run, reducedMotion, enabled = true }: ParticleCanvasesProps) {
  const exterior = useRef<HTMLCanvasElement>(null)
  const interior = useRef<HTMLCanvasElement>(null)
  const world = useRef<ParticleWorld>(createParticleWorld(run + 0x91a7, reducedMotion ? 'fallback' : 'full', mood))
  const lastElapsed = useRef(0)

  useEffect(() => {
    world.current = createParticleWorld(run + 0x91a7, reducedMotion ? 'fallback' : 'full', mood)
    lastElapsed.current = 0
  }, [mood, reducedMotion, run])

  useEffect(() => {
    if (!enabled) {
      if (exterior.current) prepareCanvas(exterior.current)
      if (interior.current) prepareCanvas(interior.current)
      return
    }
    const deltaMs = Math.max(0, sample.elapsedMs - lastElapsed.current)
    lastElapsed.current = sample.elapsedMs
    world.current = stepParticleWorld(world.current, {
      elapsedMs: sample.elapsedMs, deltaMs, sashOpen, reducedMotion,
    })
    const exteriorContext = exterior.current ? prepareCanvas(exterior.current) : undefined
    const interiorContext = interior.current ? prepareCanvas(interior.current) : undefined
    if (exteriorContext) drawExterior(exteriorContext, world.current)
    if (interiorContext) drawInterior(interiorContext, world.current)
  }, [enabled, reducedMotion, sample, sashOpen])

  return (
    <>
      <canvas ref={exterior} className="particle-canvas particle-canvas--exterior" aria-hidden="true" />
      <canvas ref={interior} className="particle-canvas particle-canvas--interior" aria-hidden="true" />
    </>
  )
}
