import { length, normalize } from '../domain/math'
import type { Vec2 } from '../domain/types'

export type MovementIntent = {
  direction: Vec2
  strength: number
}

export type PointerInput = {
  start(pointer: Vec2, playerScreenPosition: Vec2): void
  move(pointer: Vec2, playerScreenPosition: Vec2): void
  end(): void
  cancel(): void
  snapshot(): MovementIntent
}

const ZERO_INTENT: MovementIntent = {
  direction: { x: 0, y: 0 },
  strength: 0,
}

export function createPointerInput(): PointerInput {
  let intent = ZERO_INTENT

  const update = (pointer: Vec2, playerScreenPosition: Vec2) => {
    const displacement = {
      x: pointer.x - playerScreenPosition.x,
      y: pointer.y - playerScreenPosition.y,
    }
    intent = {
      direction: normalize(displacement),
      strength: Math.min(1, Math.max(0, length(displacement) / 120)),
    }
  }

  const clear = () => {
    intent = ZERO_INTENT
  }

  return {
    start: update,
    move: update,
    end: clear,
    cancel: clear,
    snapshot: () => ({ direction: { ...intent.direction }, strength: intent.strength }),
  }
}
