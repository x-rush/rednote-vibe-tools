import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, movementToward, nearest, result, transition } from './types'

export const decideHunter: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const currentTarget = nearby.find((item) => item.id === memory.targetId)
  const prey = currentTarget ?? nearest(entity, nearby.filter((item) => (
    (item.faction !== entity.faction || item.role === 'prey' || item.role === 'player')
    && item.mass < entity.mass * 0.82
    && item.role !== 'nutrient'
    && item.role !== 'fragment'
  )))

  const stateAgeMs = context.atMs - memory.stateStartedAtMs

  if (!prey && memory.state === 'pursue' && stateAgeMs > context.profile.abandonAfterMs) {
    return result(transition(memory, 'search', context.atMs), deterministicWander(entity.id, context.atMs, 0.45))
  }

  if (memory.state === 'recover' && stateAgeMs < (context.profile.recoveryMs ?? 0)) {
    return result(memory, deterministicWander(entity.id, context.atMs, 0.18))
  }

  if (memory.state === 'pursue' && stateAgeMs > (context.profile.pursuitBurstMs ?? context.profile.abandonAfterMs)) {
    return result(transition(memory, 'recover', context.atMs), deterministicWander(entity.id, context.atMs, 0.18))
  }

  if (prey) {
    const target = {
      x: prey.position.x + prey.velocity.x * 0.35,
      y: prey.position.y + prey.velocity.y * 0.35,
    }
    return result(transition(memory, 'pursue', context.atMs, prey.id), movementToward(entity.position, target))
  }

  if (memory.state === 'pursue') return result(memory, deterministicWander(entity.id, context.atMs, 0.52))
  return result(transition(memory, 'search', context.atMs), deterministicWander(entity.id, context.atMs, 0.38))
}
