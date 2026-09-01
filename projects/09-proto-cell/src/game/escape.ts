import type { EntityState, Vec2 } from '../domain/types'
import type { MovementIntent } from './input'
import { coveredRatio } from './containment'

export type EscapeContactRelief = {
  position: Vec2
  velocity: Vec2
}

export function escapeContactRelief(
  player: EntityState,
  threat: EntityState,
  intent: MovementIntent,
  lethalCoverage = 0.7,
): EscapeContactRelief | undefined {
  if (player.faction !== 'player' || threat.faction !== 'hostile') return undefined
  if (threat.body.radius <= player.body.radius || threat.behaviorState !== 'pursue') return undefined
  if (intent.strength < 0.45) return undefined

  const x = player.position.x - threat.position.x
  const y = player.position.y - threat.position.y
  const distance = Math.hypot(x, y)
  const overlap = player.body.radius + threat.body.radius - distance
  if (distance <= 0 || overlap <= 0 || coveredRatio(threat.body, player.body) >= lethalCoverage) return undefined

  const away = { x: x / distance, y: y / distance }
  const outwardAlignment = intent.direction.x * away.x + intent.direction.y * away.y
  if (outwardAlignment < 0.35) return undefined

  const reliefDistance = Math.min(overlap, 2.5 + intent.strength * 4.5)
  const currentOutwardSpeed = player.velocity.x * away.x + player.velocity.y * away.y
  const targetOutwardSpeed = 42 * intent.strength * outwardAlignment
  const addedOutwardSpeed = Math.max(0, targetOutwardSpeed - currentOutwardSpeed)
  return {
    position: {
      x: player.position.x + away.x * reliefDistance,
      y: player.position.y + away.y * reliefDistance,
    },
    velocity: {
      x: player.velocity.x + away.x * addedOutwardSpeed,
      y: player.velocity.y + away.y * addedOutwardSpeed,
    },
  }
}
