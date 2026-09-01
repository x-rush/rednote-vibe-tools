import type { EntityState, Vec2 } from '../domain/types'
import type { BodyStage } from '../game/engine'

export type CameraFrame = {
  center: Vec2
  zoom: number
  anchor: Vec2
}

type CameraPlayer = Pick<EntityState, 'position' | 'velocity'> & { radius: number }
type Viewport = { width: number; height: number }

const STAGE_ZOOM: Record<BodyStage, number> = {
  microbe: 2.6,
  hunter: 2.3,
  specialist: 2.05,
  dominant: 1.82,
  ascendant: 1.65,
}

export function createCameraTracker(): {
  update(player: CameraPlayer, viewport: Viewport, stage: BodyStage, elapsedMs: number): CameraFrame
} {
  let center: Vec2 | undefined
  let previousPlayerPosition: Vec2 | undefined
  let previousElapsedMs = 0

  return {
    update(player, viewport, stage, elapsedMs) {
      const anchor = { x: viewport.width * 0.5, y: viewport.height * 0.58 }
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
        return { center: { ...center }, zoom: STAGE_ZOOM[stage], anchor }
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

      return { center: { ...center }, zoom: STAGE_ZOOM[stage], anchor }
    },
  }
}

function cappedLook(velocity: Vec2, lookSeconds: number, maximum: number): Vec2 {
  const x = velocity.x * lookSeconds
  const y = velocity.y * lookSeconds
  const length = Math.hypot(x, y)
  if (length <= maximum || length === 0) return { x, y }
  const scale = maximum / length
  return { x: x * scale, y: y * scale }
}
