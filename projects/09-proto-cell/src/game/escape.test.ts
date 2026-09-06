import { describe, expect, it } from 'vitest'
import { circleBody, entity } from '../tests/fixtures'
import { escapeContactRelief } from './escape'

function contactPair(distance: number) {
  const player = entity('large', 10, { x: 0, y: 0 })
  const threat = {
    ...entity('hunter', 16, { x: -distance, y: 0 }),
    faction: 'hostile' as const,
    role: 'predator' as const,
    behaviorState: 'pursue',
  }
  return { player, threat }
}

describe('movement-only contact escape', () => {
  it('moves the player outward while a larger hunter has less than lethal coverage', () => {
    const { player, threat } = contactPair(20)
    const relief = escapeContactRelief(player, threat, {
      direction: { x: 1, y: 0 },
      strength: 1,
    })

    expect(relief?.position.x).toBeGreaterThan(player.position.x)
    expect(relief?.velocity.x).toBeGreaterThan(player.velocity.x)
  })

  it('does not rescue a player after the hunter reaches seventy percent coverage', () => {
    const { player, threat } = contactPair(0)
    player.body = circleBody(player.position, 10)
    threat.body = circleBody(threat.position, 16)

    expect(escapeContactRelief(player, threat, {
      direction: { x: 1, y: 0 },
      strength: 1,
    })).toBeUndefined()
  })

  it('does not push the player out without an outward movement input', () => {
    const { player, threat } = contactPair(20)

    expect(escapeContactRelief(player, threat, {
      direction: { x: 0, y: 1 },
      strength: 1,
    })).toBeUndefined()
  })
})
