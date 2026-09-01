import type { Vec2 } from '../domain/types'

export function minimumPlayableWidth(radius: number, bodyWidths: number): number {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0
  const safeWidths = Number.isFinite(bodyWidths) && bodyWidths > 0 ? bodyWidths : 0
  return safeRadius * 2 * safeWidths
}

export function collapseInsetLimit(
  world: { width: number; height: number },
  radius: number,
  bodyWidths: number,
): number {
  const required = minimumPlayableWidth(radius, bodyWidths)
  const widthLimit = (world.width - required) / 2
  const heightLimit = (world.height - required) / 2
  return Math.max(0, Math.min(widthLimit, heightLimit))
}

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

export function applySoftBoundary(
  desiredPosition: Vec2,
  velocity: Vec2,
  world: { width: number; height: number; softZone?: number },
  radius: number,
): { position: Vec2; velocity: Vec2; steering: Vec2 } {
  const safeRadius = Math.max(0, radius)
  const softZone = Math.max(1, world.softZone ?? 72)
  const comfortablyInside = desiredPosition.x >= safeRadius + softZone
    && desiredPosition.x <= world.width - safeRadius - softZone
    && desiredPosition.y >= safeRadius + softZone
    && desiredPosition.y <= world.height - safeRadius - softZone
  if (comfortablyInside) {
    return { position: desiredPosition, velocity, steering: { x: 0, y: 0 } }
  }
  const position = {
    x: Number.isFinite(desiredPosition.x) ? desiredPosition.x : world.width / 2,
    y: Number.isFinite(desiredPosition.y) ? desiredPosition.y : world.height / 2,
  }
  const safeVelocity = {
    x: Number.isFinite(velocity.x) ? velocity.x : 0,
    y: Number.isFinite(velocity.y) ? velocity.y : 0,
  }
  const steering = {
    x: edgeSteering(position.x - safeRadius, world.width - safeRadius - position.x, safeVelocity.x, softZone),
    y: edgeSteering(position.y - safeRadius, world.height - safeRadius - position.y, safeVelocity.y, softZone),
  }
  const steeredVelocity = {
    x: safeVelocity.x + steering.x,
    y: safeVelocity.y + steering.y,
  }
  const constrained = constrainWorldMotion(position, steeredVelocity, {
    width: world.width,
    height: world.height,
    margin: safeRadius,
  })

  return { ...constrained, steering }
}

function edgeSteering(
  distanceFromLowEdge: number,
  distanceFromHighEdge: number,
  velocity: number,
  softZone: number,
): number {
  const lowInfluence = easeOut(clamp(1 - distanceFromLowEdge / softZone, 0, 1))
  const highInfluence = easeOut(clamp(1 - distanceFromHighEdge / softZone, 0, 1))
  const inwardStrength = Math.max(24, Math.abs(velocity) * 1.25)

  return (lowInfluence - highInfluence) * inwardStrength
}

function easeOut(value: number): number {
  return 1 - (1 - value) ** 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
