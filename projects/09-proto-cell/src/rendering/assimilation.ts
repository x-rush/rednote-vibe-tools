import type { EntityState } from '../domain/types'
import type { FormId } from '../content'
import { membraneContour, membranePose, membraneSilhouette } from '../domain/membrane'
import { drawCell } from './cell'
import type { RenderQuality } from './effects'

export function assimilationPresentation(ageMs: number, reducedMotion: boolean, reducedFlash: boolean, durationMs = 650) {
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs >= durationMs || !Number.isFinite(durationMs) || durationMs <= 0) return undefined
  const progress = ageMs / durationMs
  const intake = 1 - Math.pow(1 - progress, 2)
  return {
    offsetScale: reducedMotion ? 1 : 1 - intake * 0.86,
    preyScale: reducedMotion ? 1 : 1 - intake * 0.9,
    alpha: 0.86 * Math.pow(1 - progress, 0.7),
    pulseAlpha: (reducedFlash ? 0.2 : 0.65) * (1 - progress),
  }
}

export function behaviorCuePresentation(entity: Pick<EntityState, 'behaviorState' | 'velocity' | 'behaviorDirection'>) {
  const phase = entity.behaviorState === 'telegraph' ? 'prepare'
    : entity.behaviorState === 'pursue' || entity.behaviorState === 'charge' || entity.behaviorState === 'ambush' ? 'strike'
      : entity.behaviorState === 'recover' ? 'recover' : undefined
  if (!phase) return undefined
  const direction = entity.behaviorDirection ?? entity.velocity
  return { phase, heading: Math.atan2(direction.y, direction.x) }
}

export function drawAssimilation(
  context: CanvasRenderingContext2D,
  predator: EntityState,
  prey: EntityState,
  screen: { x: number; y: number; radius: number; zoom: number },
  formId: FormId,
  ageMs: number,
  elapsedMs: number,
  options: { quality: RenderQuality; reducedMotion?: boolean; reducedFlash?: boolean; durationMs?: number },
) {
  const presentation = assimilationPresentation(ageMs, options.reducedMotion ?? false, options.reducedFlash ?? false, options.durationMs)
  if (!presentation) return
  const pose = membranePose(predator, elapsedMs)
  const contour = membraneContour(membraneSilhouette(predator, formId), elapsedMs, predator.id)
  context.save()
  // Intake is entirely inside the real membrane, never an extra collision halo.
  context.translate(screen.x, screen.y)
  context.rotate(pose.heading)
  context.scale((1 + pose.strain) * pose.pulse, (1 - pose.strain) * pose.pulse)
  context.beginPath()
  contour.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x * screen.radius, point.y * screen.radius)
    else context.lineTo(point.x * screen.radius, point.y * screen.radius)
  })
  context.closePath()
  context.clip()
  context.globalAlpha = presentation.pulseAlpha
  context.strokeStyle = '#fff0b2'
  context.lineWidth = Math.max(2, screen.radius * 0.13)
  context.stroke()
  // Undo body transform while preserving its clipping region.
  context.scale(1 / ((1 + pose.strain) * pose.pulse), 1 / ((1 - pose.strain) * pose.pulse))
  context.rotate(-pose.heading)
  context.globalAlpha = presentation.alpha
  drawCell(context, prey,
    (prey.position.x - predator.position.x) * screen.zoom * presentation.offsetScale,
    (prey.position.y - predator.position.y) * screen.zoom * presentation.offsetScale,
    prey.body.radius * screen.zoom * presentation.preyScale,
    options.reducedMotion ? 0 : elapsedMs,
    { quality: options.quality, edible: true, membraneElapsedMs: elapsedMs - ageMs })
  context.restore()
}
