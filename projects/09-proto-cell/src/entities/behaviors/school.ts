import type { BehaviorHandler } from './types'
import { activeNeighbors, deterministicWander, movementAway, movementToward, nearest, result, transition } from './types'

export const decideSchool: BehaviorHandler = (entity, memory, context) => {
  const nearby = activeNeighbors(entity, context)
  const threat = nearest(entity, nearby.filter((item) => item.faction === 'hostile' || item.mass > entity.mass * 1.35))
  if (threat) return result(transition(memory, 'flee', context.atMs, threat.id), movementAway(entity.position, threat.position))

  const peers = nearby.filter((item) => item.behaviorProfileId === entity.behaviorProfileId)
  if (peers.length > 0) {
    const centroid = peers.reduce((sum, peer) => ({ x: sum.x + peer.position.x, y: sum.y + peer.position.y }), { x: 0, y: 0 })
    centroid.x /= peers.length
    centroid.y /= peers.length
    return result(transition(memory, 'regroup', context.atMs, undefined, centroid), movementToward(entity.position, centroid, 0.72), 'split-school')
  }
  return result(transition(memory, 'regroup', context.atMs), deterministicWander(entity.id, context.atMs, 0.34))
}
