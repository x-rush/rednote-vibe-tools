import type { Vec2 } from '../domain/types'
import type { MovementIntent } from './input'

export function worldSpeedForForm(radius: number, bodyLengthsPerSecond: number): number {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1
  const safeRate = Number.isFinite(bodyLengthsPerSecond) && bodyLengthsPerSecond > 0 ? bodyLengthsPerSecond : 1
  return safeRadius * 2 * safeRate
}

export function advanceVelocity(
  current: Vec2,
  intent: MovementIntent,
  maxSpeed: number,
  elapsedMs: number,
  options: { responseMs?: number } = {},
): Vec2 {
  const target = {
    x: intent.direction.x * intent.strength * maxSpeed,
    y: intent.direction.y * intent.strength * maxSpeed,
  }
  const opposing = current.x * target.x + current.y * target.y < 0
  const responseMs = options.responseMs === undefined
    ? intent.strength === 0 ? 320 : opposing ? 120 : 180
    : Math.max(1, options.responseMs)
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / responseMs)

  return {
    x: current.x + (target.x - current.x) * blend,
    y: current.y + (target.y - current.y) * blend,
  }
}
