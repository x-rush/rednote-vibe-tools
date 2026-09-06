import type { EntityState, Vec2 } from '../domain/types'
import type { BodyStage } from '../content'

export type CameraFrame = {
  center: Vec2
  zoom: number
  anchor: Vec2
}

type CameraPlayer = Pick<EntityState, 'position' | 'velocity'> & { radius: number }
type Viewport = { width: number; height: number }

export function targetScreenDiameterRatio(range: readonly [number, number], progress: number): number {
  const min = finitePositive(range[0], 0.16)
  const max = Math.max(min, finitePositive(range[1], min))
  const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  return min + (max - min) * normalized
}

export function cameraZoomFor(input: { viewport: Viewport; radius: number; screenDiameterRatio: number; world?: { width: number; height: number } }): number {
  const shortSide = Math.min(input.viewport.width, input.viewport.height)
  const radius = finitePositive(input.radius, 1)
  const ratio = finitePositive(input.screenDiameterRatio, 0.16)
  const raw = shortSide * ratio / (radius * 2)
  const worldLimit = input.world
    ? Math.min(input.viewport.width / Math.max(1, input.world.width), input.viewport.height / Math.max(1, input.world.height)) * 8
    : 8
  const maximum = Math.max(0.25, Number.isFinite(worldLimit) && worldLimit > 0 ? worldLimit : 8)
  return Math.min(maximum, Math.max(0.25, Number.isFinite(raw) && raw > 0 ? raw : 1))
}

export function visibleWorldRadius(viewport: Viewport, zoom: number): number {
  const diagonal = Math.hypot(viewport.width, viewport.height)
  // Round upward by a tenth so ecology never underestimates a visible edge.
  return Math.ceil((diagonal / (2 * finitePositive(zoom, 1))) * 10) / 10
}

const STAGE_ZOOM: Record<BodyStage, number> = {
  microbe: 2.6,
  hunter: 2.3,
  specialist: 2.05,
  dominant: 1.82,
  ascendant: 1.65,
}

export function createCameraTracker(): {
  update(player: CameraPlayer, viewport: Viewport, stage: BodyStage | { screenDiameterRatio: number }, elapsedMs: number): CameraFrame
} {
  let center: Vec2 | undefined
  let previousPlayerPosition: Vec2 | undefined
  let previousElapsedMs = 0
  let zoom: number | undefined

  return {
    update(player, viewport, stage, elapsedMs) {
      const anchor = { x: viewport.width * 0.5, y: viewport.height * 0.58 }
      const targetZoom = typeof stage === 'string'
        ? STAGE_ZOOM[stage]
        : cameraZoomFor({ viewport, radius: player.radius, screenDiameterRatio: stage.screenDiameterRatio })
      const teleported = previousPlayerPosition
        ? Math.hypot(
            player.position.x - previousPlayerPosition.x,
            player.position.y - previousPlayerPosition.y,
          ) > 240
        : false
      previousPlayerPosition = { ...player.position }

      if (!center || elapsedMs < previousElapsedMs || teleported) {
        center = { ...player.position }
        previousElapsedMs = elapsedMs
        zoom = targetZoom
        return { center: { ...center }, zoom, anchor }
      }

      const deltaMs = Math.min(50, Math.max(0, elapsedMs - previousElapsedMs))
      previousElapsedMs = elapsedMs
      const look = cappedLook(player.velocity, 0.2, 64)
      const target = {
        x: player.position.x + look.x,
        y: player.position.y + look.y,
      }
      const blend = 1 - Math.exp(-deltaMs / 125)
      center = {
        x: center.x + (target.x - center.x) * blend,
        y: center.y + (target.y - center.y) * blend,
      }

      const zoomBlend = 1 - Math.exp(-deltaMs / 600)
      zoom = (zoom ?? targetZoom) + (targetZoom - (zoom ?? targetZoom)) * zoomBlend

      return { center: { ...center }, zoom, anchor }
    },
  }
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function cappedLook(velocity: Vec2, lookSeconds: number, maximum: number): Vec2 {
  const x = velocity.x * lookSeconds
  const y = velocity.y * lookSeconds
  const length = Math.hypot(x, y)
  if (length <= maximum || length === 0) return { x, y }
  const scale = maximum / length
  return { x: x * scale, y: y * scale }
}
