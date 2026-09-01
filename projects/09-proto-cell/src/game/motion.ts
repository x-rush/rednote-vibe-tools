import type { Vec2 } from '../domain/types'
import type { MovementIntent } from './input'

export function advanceVelocity(
  current: Vec2,
  intent: MovementIntent,
  maxSpeed: number,
  elapsedMs: number,
): Vec2 {
  const strength = clamp(intent.strength, 0, 1)
  const speed = Math.max(0, maxSpeed)
  const target = {
    x: intent.direction.x * strength * speed,
    y: intent.direction.y * strength * speed,
  }
  const opposing = current.x * target.x + current.y * target.y < 0
  const responseMs = strength === 0 ? 320 : opposing ? 120 : 180
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / responseMs)

  return {
    x: current.x + (target.x - current.x) * blend,
    y: current.y + (target.y - current.y) * blend,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
