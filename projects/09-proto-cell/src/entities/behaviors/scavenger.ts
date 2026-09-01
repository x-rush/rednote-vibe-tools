import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, movementAway, movementToward, nearest, result, transition } from './types'

export const decideScavenger: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const threat = nearest(entity, nearby.filter((item) => item.mass > entity.mass * 1.45 && item.role !== 'fragment'))
  if (threat) return result(transition(memory, 'escape', context.atMs, threat.id), movementAway(entity.position, threat.position))
  const fragment = nearest(entity, nearby.filter((item) => item.role === 'fragment'))
  if (fragment) return result(transition(memory, 'harvest', context.atMs, fragment.id), movementToward(entity.position, fragment.position), 'consume')
  return result(transition(memory, 'harvest', context.atMs), deterministicWander(entity.id, context.atMs, 0.4))
}
