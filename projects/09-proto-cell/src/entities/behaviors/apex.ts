import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, nearest, predationCycle, result, transition, warnPredation } from './types'

export const decideApex: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const target = nearest(entity, nearby.filter((item) => item.faction !== entity.faction && item.role !== 'nutrient' && (context.profile.id === 'behavior-leviathan' ? item.faction === 'player' : item.body.radius < entity.body.radius * 0.95)))
  const cycle = predationCycle(entity, memory, context, target, 'charge')
  if (cycle) return cycle
  if (target && (memory.state === 'recover' || context.atMs - memory.stateStartedAtMs >= 900)) {
    return warnPredation(entity, memory, context, target)
  }
  return result(transition(memory, 'patrol', context.atMs, undefined, memory.anchor ?? entity.position), deterministicWander(entity.id, context.atMs, 0.3))
}
