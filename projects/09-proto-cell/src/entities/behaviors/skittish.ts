import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, movementAway, nearest, result, transition } from './types'

export const decideSkittish: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const threat = nearest(entity, nearby.filter((item) => item.faction === 'hostile' || item.mass > entity.mass * 1.2))
  if (threat) {
    const next = transition(memory, 'flee', context.atMs, threat.id)
    const movement = movementAway(entity.position, threat.position, 1)
    const turn = ((hash(entity.id) & 1) === 0 ? 1 : -1) * Math.min(0.32, (context.atMs - next.stateStartedAtMs) / 1200)
    return result(next, {
      direction: { x: movement.direction.x - movement.direction.y * turn, y: movement.direction.y + movement.direction.x * turn },
      strength: 1,
    })
  }
  return result(transition(memory, 'forage', context.atMs), deterministicWander(entity.id, context.atMs, 0.42))
}

function hash(value: string): number {
  let result = 0
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 31)
  return result >>> 0
}
