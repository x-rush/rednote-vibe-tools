import type { BodyShape, EntityState } from '../domain/types'
import type { FormId } from '../content'
import type { BuildState } from '../evolution/build'
import { physicalMembrane } from '../domain/membrane'
import { fullyContains } from '../game/containment'

export type RelationshipCue = 'edible' | 'danger' | 'neutral'
export type RelationshipContext = { formId: FormId; build?: BuildState; elapsedMs?: number }

const CLEAR_RADIUS_RATIO = 1.18
type PreparedShape = { body: BodyShape; bounds?: ReturnType<typeof bounds>; centralRadiusSquared?: number }

export function relationshipCue(player: EntityState, target: EntityState, context?: RelationshipContext): RelationshipCue {
  if (player.status !== 'active' || target.status !== 'active' || target.faction === 'player') return 'neutral'
  if (context) return geometricRelationship(target, context, { body: centeredMembrane(player, context) })
  // Engulfing uses physical containment. Biomass is accounting and is deliberately
  // preserved when lifecycle growth resizes the body, so it cannot drive this cue.
  if (player.body.radius >= target.body.radius * CLEAR_RADIUS_RATIO) return 'edible'
  if (target.body.radius >= player.body.radius * CLEAR_RADIUS_RATIO) return 'danger'
  return 'neutral'
}

/** A render frame asks about each target in several passes. Cache its fit once. */
export function createRelationshipFrame(player: EntityState, context: RelationshipContext): (target: EntityState) => RelationshipCue {
  const playerShape: PreparedShape = { body: centeredMembrane(player, context) }
  const cues = new Map<string, RelationshipCue>()
  return (target) => {
    if (player.status !== 'active' || target.status !== 'active' || target.faction === 'player') return 'neutral'
    const cached = cues.get(target.id)
    if (cached) return cached
    const cue = geometricRelationship(target, context, playerShape)
    cues.set(target.id, cue)
    return cue
  }
}

function centeredMembrane(entity: EntityState, context: RelationshipContext): BodyShape {
  return physicalMembrane({ ...entity, position: { x: 0, y: 0 } }, context.formId, context.elapsedMs ?? 0, context.build)
}

function geometricRelationship(target: EntityState, context: RelationshipContext, playerShape: PreparedShape): RelationshipCue {
  const targetShape: PreparedShape = { body: centeredMembrane(target, context) }
  if (geometricallyFits(playerShape, targetShape)) return 'edible'
  if (geometricallyFits(targetShape, playerShape)) return 'danger'
  return 'neutral'
}

function geometricallyFits(container: PreparedShape, target: PreparedShape): boolean {
  if (container.body.radius <= target.body.radius) return false
  const outer = container.bounds ??= bounds(container.body)
  const inner = target.bounds ??= bounds(target.body)
  if (inner.left < outer.left || inner.right > outer.right || inner.top < outer.top || inner.bottom > outer.bottom) return false
  // These centered, star-shaped membranes contain a central inscribed circle.
  // Routine tiny food fits wholly inside it, avoiding a polygon-pair walk for
  // every grain on every frame. Borderline shapes still use full containment.
  if (target.body.radius * target.body.radius < (container.centralRadiusSquared ??= centralRadiusSquared(container.body))) return true
  return fullyContains(container.body, target.body)
}

function centralRadiusSquared(body: BodyShape): number {
  let nearest = Number.POSITIVE_INFINITY
  for (let index = 0; index < body.contour.length; index += 1) {
    const start = body.contour[index]!
    const end = body.contour[(index + 1) % body.contour.length]!
    const x = end.x - start.x
    const y = end.y - start.y
    const lengthSquared = x * x + y * y
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(start.x * x + start.y * y) / lengthSquared))
    const closestX = start.x + t * x
    const closestY = start.y + t * y
    nearest = Math.min(nearest, closestX * closestX + closestY * closestY)
  }
  return nearest
}

function bounds(body: BodyShape) {
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const point of body.contour) {
    left = Math.min(left, point.x)
    right = Math.max(right, point.x)
    top = Math.min(top, point.y)
    bottom = Math.max(bottom, point.y)
  }
  return { left, right, top, bottom }
}

export function relationshipPulse(elapsedMs: number, reducedFlash: boolean): number {
  return reducedFlash ? 1 : 1 + Math.sin(elapsedMs / 120) * 0.035
}
