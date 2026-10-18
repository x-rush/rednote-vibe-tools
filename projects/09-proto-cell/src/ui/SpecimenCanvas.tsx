import { useEffect, useRef } from 'react'
import { getContent, type FormId } from '../content'
import type { BuildState } from '../evolution/build'
import { createEntity } from '../entities/factory'
import { drawCell } from '../rendering/cell'

export type SpecimenCanvasProps = { build: BuildState; formId: FormId; size?: number; visualRecipeId?: string; elapsedMs?: number }

export function drawSpecimen(context: CanvasRenderingContext2D, build: BuildState, formId: FormId, size: number, options: { visualRecipeId?: string; elapsedMs?: number } = {}) {
  const radius = size * 0.28
  const visualRecipeId = options.visualRecipeId ?? getContent().origins[0]?.visualRecipeId ?? ''
  const entity = createEntity({
    id: 'specimen', role: 'player', faction: 'player', radius, mass: radius * radius,
    membrane: 100, energy: 100, maxSpeed: 0, visualRecipeId,
  }, { id: 'player', position: { x: 0, y: 0 }, velocity: { x: 1, y: -0.2 } })
  context.clearRect(0, 0, size, size)
  drawCell(context, entity, size * 0.5, size * 0.5, radius, Number.isFinite(options.elapsedMs) ? options.elapsedMs! : 1200, {
    quality: 'balanced', build, formId, stability: build.stability, synergyIds: build.synergyIds,
  })
}

/** A quiet, deterministic specimen using the exact same body as the live ecology. */
export function SpecimenCanvas({ build, formId, size = 120, visualRecipeId, elapsedMs }: SpecimenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const side = Number.isFinite(size) ? Math.max(24, Math.min(512, size)) : 120
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(side * ratio)
    canvas.height = Math.round(side * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    drawSpecimen(context, build, formId, side, { visualRecipeId, elapsedMs })
  }, [build, formId, side, visualRecipeId, elapsedMs])
  return <canvas ref={canvasRef} className="specimen-canvas" width={side} height={side} style={{ width: side, height: side, maxWidth: '100%', objectFit: 'contain' }} aria-hidden="true" />
}
