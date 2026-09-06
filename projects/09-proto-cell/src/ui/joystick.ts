import type { Vec2 } from '../domain/types'
import { DEFAULT_POINTER_FULL_STRENGTH_DISTANCE } from '../game/input'

export const FLOATING_JOYSTICK_TRAVEL = DEFAULT_POINTER_FULL_STRENGTH_DISTANCE

export type FloatingJoystickVisual = {
  origin: Vec2
  knobOffset: Vec2
}

export function resolveFloatingJoystick(
  origin: Vec2,
  pointer: Vec2,
  maxTravel = FLOATING_JOYSTICK_TRAVEL,
): FloatingJoystickVisual {
  const x = pointer.x - origin.x
  const y = pointer.y - origin.y
  const distance = Math.hypot(x, y)
  const scale = distance > maxTravel && distance > 0 ? maxTravel / distance : 1
  return {
    origin: { ...origin },
    knobOffset: {
      x: Math.abs(x * scale) < Number.EPSILON ? 0 : x * scale,
      y: Math.abs(y * scale) < Number.EPSILON ? 0 : y * scale,
    },
  }
}
