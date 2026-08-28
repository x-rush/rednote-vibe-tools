import { length, normalize } from '../domain/math'
import type { EntityState, Vec2 } from '../domain/types'
import type { MovementIntent } from '../game/input'

export type Perception = {
  nearby: readonly EntityState[]
  attractionFields?: ReadonlyArray<{ center: Vec2; radius: number; strength: number; flow?: Vec2 }>
}

export function decideIntent(entity: EntityState, perception: Perception): MovementIntent {
  if (entity.status !== 'active' || entity.role === 'player' || entity.role === 'nutrient') {
    return still()
  }

  const candidates = perception.nearby.filter((item) => item.id !== entity.id && item.status === 'active')
  const threat = nearest(entity, candidates.filter((item) => item.mass > entity.mass * 1.25 && item.role !== 'nutrient'))
  if (threat && entity.role !== 'predator' && entity.role !== 'elite' && entity.role !== 'boss') {
    return toward(entity.position, threat.position, -1)
  }

  if (entity.faction !== 'player') {
    const field = perception.attractionFields?.find((item) => Math.sqrt(distanceSquared(entity.position, item.center)) <= item.radius)
    if (field) {
      const intent = toward(entity.position, field.center, 1)
      const driftedDirection = normalize({
        x: intent.direction.x + (field.flow?.x ?? 0),
        y: intent.direction.y + (field.flow?.y ?? 0),
      })
      return { direction: driftedDirection, strength: Math.min(1, Math.max(0, field.strength)) }
    }
  }

  if (entity.role === 'predator' || entity.role === 'elite' || entity.role === 'boss' || entity.role === 'competitor') {
    const prey = nearest(entity, candidates.filter((item) => (
      item.mass < entity.mass * 0.75
      && item.role !== 'nutrient'
      && item.role !== 'fragment'
      && item.faction !== entity.faction
    )))
    if (prey) return toward(entity.position, prey.position, 1)
  }

  if (entity.role === 'scavenger') {
    const fragment = nearest(entity, candidates.filter((item) => item.role === 'fragment'))
    if (fragment) return toward(entity.position, fragment.position, 1)
  }

  const nutrient = nearest(entity, candidates.filter((item) => item.role === 'nutrient'))
  if (nutrient) return toward(entity.position, nutrient.position, 1)

  return wander(entity.id)
}

function nearest(entity: EntityState, candidates: readonly EntityState[]): EntityState | undefined {
  return candidates.reduce<EntityState | undefined>((closest, candidate) => {
    if (!closest) return candidate
    return distanceSquared(entity.position, candidate.position) < distanceSquared(entity.position, closest.position)
      ? candidate
      : closest
  }, undefined)
}

function toward(from: Vec2, to: Vec2, sign: 1 | -1): MovementIntent {
  const displacement = { x: (to.x - from.x) * sign, y: (to.y - from.y) * sign }
  return { direction: normalize(displacement), strength: length(displacement) === 0 ? 0 : 1 }
}

function wander(id: string): MovementIntent {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 31)
  const angle = (hash >>> 0) / 4_294_967_296 * Math.PI * 2
  return { direction: { x: Math.cos(angle), y: Math.sin(angle) }, strength: 0.25 }
}

function still(): MovementIntent {
  return { direction: { x: 0, y: 0 }, strength: 0 }
}

function distanceSquared(first: Vec2, second: Vec2): number {
  const x = first.x - second.x
  const y = first.y - second.y
  return x * x + y * y
}
