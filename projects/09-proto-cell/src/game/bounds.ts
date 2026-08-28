import type { Vec2 } from '../domain/types'

export function engulfAccessMargin(entityRadius: number, playerRadii: readonly number[]): number {
  return playerRadii.reduce((margin, playerRadius) => (
    playerRadius > entityRadius ? Math.max(margin, playerRadius) : margin
  ), entityRadius)
}

export function constrainWorldMotion(
  desiredPosition: Vec2,
  velocity: Vec2,
  world: { width: number; height: number; margin: number },
): { position: Vec2; velocity: Vec2 } {
  const marginX = Math.min(world.width / 2, Math.max(0, world.margin))
  const marginY = Math.min(world.height / 2, Math.max(0, world.margin))
  const position = {
    x: clamp(desiredPosition.x, marginX, world.width - marginX),
    y: clamp(desiredPosition.y, marginY, world.height - marginY),
  }
  return {
    position,
    velocity: {
      x: position.x !== desiredPosition.x && Math.sign(velocity.x) === Math.sign(desiredPosition.x - position.x) ? 0 : velocity.x,
      y: position.y !== desiredPosition.y && Math.sign(velocity.y) === Math.sign(desiredPosition.y - position.y) ? 0 : velocity.y,
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
