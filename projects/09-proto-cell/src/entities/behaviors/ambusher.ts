import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, movementToward, nearest, result, transition } from './types'

export const decideAmbusher: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const prey = nearest(entity, nearby.filter((item) => item.faction !== entity.faction && item.mass < entity.mass * 0.82 && item.role !== 'nutrient'))
  const hiddenLongEnough = memory.state === 'hide' && context.atMs - memory.stateStartedAtMs >= 700
  if (prey && hiddenLongEnough) {
    return result(transition(memory, 'ambush', context.atMs, prey.id), movementToward(entity.position, prey.position), 'charge')
  }
  if (memory.state === 'ambush' && context.atMs - memory.stateStartedAtMs < 520) {
    const target = nearby.find((item) => item.id === memory.targetId)
    if (target) return result(memory, movementToward(entity.position, target.position), 'charge')
  }
  const next = transition(memory, 'hide', context.atMs, undefined, memory.anchor ?? entity.position)
  return result(next, memory.anchor ? movementToward(entity.position, memory.anchor, 0.18) : deterministicWander(entity.id, context.atMs, 0))
}
