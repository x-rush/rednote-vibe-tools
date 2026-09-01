import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, movementAway, movementToward, nearest, result, transition } from './types'

export const decideCompetitor: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const threat = nearest(entity, nearby.filter((item) => item.mass > entity.mass * 1.3 && item.role !== 'nutrient'))
  if (threat) return result(transition(memory, 'escape', context.atMs, threat.id), movementAway(entity.position, threat.position))

  const food = nearest(entity, nearby.filter((item) => item.role === 'nutrient' || item.role === 'fragment'))
  if (food) return result(transition(memory, 'steal', context.atMs, food.id), movementToward(entity.position, food.position), 'consume')
  return result(transition(memory, memory.state === 'steal' ? 'escape' : 'forage', context.atMs), deterministicWander(entity.id, context.atMs, 0.5))
}
