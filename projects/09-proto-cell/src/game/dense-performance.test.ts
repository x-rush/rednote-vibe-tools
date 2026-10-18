import { describe, expect, it, vi } from 'vitest'
import { createGameEngine } from './engine'
import { circleBody } from '../tests/fixtures'

describe('dense hostile interaction budget', () => {
  it('rejects non-interacting hostile pairs before sorting pair keys', () => {
    const engine = createGameEngine({ seed: 727 })
    engine.start(); engine.advance(1000 / 60)
    const world = engine.renderSnapshot()
    const crowd = world.entities.filter((body) => body.id !== 'player')
    expect(crowd.length).toBeGreaterThan(4)
    for (const body of crowd) {
      body.faction = 'hostile'; body.role = 'predator'
      body.position = { x: 300, y: 300 }; body.body = circleBody(body.position, 16)
      body.materializingUntilMs = -1; body.arrivalPhase = undefined
      delete body.behaviorProfileId
    }
    const sort = vi.spyOn(Array.prototype, 'sort')
    try {
      engine.advance(1000 / 60)
      expect(sort.mock.calls.length).toBeLessThanOrEqual(5)
      expect(engine.drainEvents().filter((event) => event.type === 'engulfed')).toEqual([])
    } finally { sort.mockRestore(); engine.destroy() }
  })
})
