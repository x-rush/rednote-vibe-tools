import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, movementToward, nearest, predationCycle, result, transition, warnPredation } from './types'

export const decideAmbusher: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const prey = nearest(entity, nearby.filter((item) => item.faction !== entity.faction && item.body.radius < entity.body.radius * 0.9 && item.role !== 'nutrient'))
  const cycle = predationCycle(entity, memory, context, prey, 'ambush')
  if (cycle) return cycle
  const hiddenLongEnough = memory.state === 'hide' && context.atMs - memory.stateStartedAtMs >= 700
  if (prey && hiddenLongEnough) {
    return warnPredation(entity, memory, context, prey)
  }
  const next = transition(memory, 'hide', context.atMs, undefined, memory.anchor ?? entity.position)
  return result(next, memory.anchor ? movementToward(entity.position, memory.anchor, 0.18) : deterministicWander(entity.id, context.atMs, 0))
}
