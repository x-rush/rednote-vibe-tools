import type { Vec2 } from '../domain/types'
import type { MovementIntent } from './input'

export function advanceVelocity(
  current: Vec2,
  intent: MovementIntent,
  maxSpeed: number,
  elapsedMs: number,
): Vec2 {
  const target = {
    x: intent.direction.x * intent.strength * maxSpeed,
    y: intent.direction.y * intent.strength * maxSpeed,
  }
  const opposing = current.x * target.x + current.y * target.y < 0
  const responseMs = intent.strength === 0 ? 320 : opposing ? 120 : 180
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / responseMs)

  return {
    x: current.x + (target.x - current.x) * blend,
    y: current.y + (target.y - current.y) * blend,
  }
}
