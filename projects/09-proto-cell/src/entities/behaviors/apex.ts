import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, movementToward, nearest, result, transition } from './types'

export const decideApex: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const target = nearest(entity, nearby.filter((item) => item.faction !== entity.faction && item.role !== 'nutrient' && item.mass < entity.mass))
  if (memory.state === 'charge' && context.atMs - memory.stateStartedAtMs < 720) {
    const locked = nearby.find((item) => item.id === memory.targetId)
    if (locked) return result(memory, movementToward(entity.position, locked.position), 'charge')
  }
  if (target && context.atMs - memory.stateStartedAtMs >= 900) {
    return result(transition(memory, 'charge', context.atMs, target.id), movementToward(entity.position, target.position), 'charge')
  }
  return result(transition(memory, 'patrol', context.atMs, undefined, memory.anchor ?? entity.position), deterministicWander(entity.id, context.atMs, 0.3))
}
