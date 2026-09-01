import { length, normalize } from '../domain/math'
import type { Vec2 } from '../domain/types'

export type MovementIntent = {
  direction: Vec2
  strength: number
}

export type PointerInput = {
  start(pointer: Vec2): void
  move(pointer: Vec2): void
  end(): void
  cancel(): void
  snapshot(): MovementIntent
}

const ZERO_INTENT: MovementIntent = {
  direction: { x: 0, y: 0 },
  strength: 0,
}

export const DEFAULT_POINTER_DEAD_ZONE = 6
export const DEFAULT_POINTER_FULL_STRENGTH_DISTANCE = 48

export function createPointerInput(options: { deadZone?: number; fullStrengthDistance?: number } = {}): PointerInput {
  const deadZone = Math.max(0, options.deadZone ?? DEFAULT_POINTER_DEAD_ZONE)
  const fullStrengthDistance = Math.max(1, options.fullStrengthDistance ?? DEFAULT_POINTER_FULL_STRENGTH_DISTANCE)
  let origin: Vec2 | undefined
  let intent = ZERO_INTENT

  const update = (pointer: Vec2) => {
    if (!origin) return
    const displacement = {
      x: pointer.x - origin.x,
      y: pointer.y - origin.y,
    }
    const distance = length(displacement)
    intent = distance <= deadZone ? ZERO_INTENT : {
      direction: normalize(displacement),
      strength: Math.min(1, distance / fullStrengthDistance),
    }
  }

  const clear = () => {
    origin = undefined
    intent = ZERO_INTENT
  }

  return {
    start(pointer) {
      origin = { ...pointer }
      intent = ZERO_INTENT
    },
    move: update,
    end: clear,
    cancel: clear,
    snapshot: () => ({ direction: { ...intent.direction }, strength: intent.strength }),
  }
}
