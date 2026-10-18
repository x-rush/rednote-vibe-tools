import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, nearest, predationCycle, result, transition, warnPredation } from './types'

export const decideHunter: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const candidates = nearby.filter((item) => (
    item.faction !== entity.faction
    && item.body.radius < entity.body.radius * 0.9
    && item.role !== 'nutrient'
    && item.role !== 'fragment'
  ))
  const prey = candidates.find((item) => item.id === memory.targetId) ?? nearest(entity, candidates)

  const stateAgeMs = context.atMs - memory.stateStartedAtMs

  if (!prey && memory.state === 'pursue' && stateAgeMs > context.profile.abandonAfterMs) {
    return result(transition(memory, 'search', context.atMs), deterministicWander(entity.id, context.atMs, 0.45))
  }

  const cycle = predationCycle(entity, memory, context, prey, 'pursue')
  if (cycle) return cycle
  if (prey) return warnPredation(entity, memory, context, prey)
  return result(transition(memory, 'search', context.atMs), deterministicWander(entity.id, context.atMs, 0.38))
}
