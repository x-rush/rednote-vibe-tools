import { describe, expect, it } from 'vitest'
import { entityAt } from '../tests/fixtures'
import { decideIntent } from './ai'

describe('baseline ecology AI', () => {
  it('makes prey flee the nearest larger threat', () => {
    const prey = { ...entityAt('prey', 0, 0), role: 'prey' as const, mass: 10 }
    const threat = { ...entityAt('threat', 30, 0), role: 'predator' as const, mass: 40, faction: 'hostile' as const }

    expect(decideIntent(prey, { nearby: [threat] })).toMatchObject({
      direction: { x: -1, y: 0 },
      strength: 1,
    })
  })

  it('lets a predator prefer a closer profitable non-player target', () => {
    const predator = { ...entityAt('predator', 0, 0), role: 'predator' as const, mass: 100, faction: 'hostile' as const }
    const player = { ...entityAt('player', 80, 0), role: 'player' as const, mass: 10, faction: 'player' as const }
    const prey = { ...entityAt('prey', 0, 30), role: 'prey' as const, mass: 8 }

    expect(decideIntent(predator, { nearby: [player, prey] })).toMatchObject({
      direction: { x: 0, y: 1 },
      strength: 1,
    })
  })

  it('pulls a non-player predator toward an active ecosystem attraction field', () => {
    const predator = { ...entityAt('predator', 0, 0), role: 'predator' as const, mass: 100, faction: 'hostile' as const }

    expect(decideIntent(predator, {
      nearby: [],
      attractionFields: [{ center: { x: 100, y: 0 }, radius: 200, strength: 0.8 }],
    })).toMatchObject({ direction: { x: 1, y: 0 }, strength: 0.8 })
  })

  it('pulls prey and scavengers with the event flow instead of leaving ecology classes behind', () => {
    for (const role of ['prey', 'scavenger'] as const) {
      const entity = { ...entityAt(role, 0, 0), role, faction: 'neutral' as const }
      const intent = decideIntent(entity, {
        nearby: [],
        attractionFields: [{ center: { x: 100, y: 0 }, radius: 200, strength: 0.7, flow: { x: 0, y: 0.5 } }],
      })

      expect(intent.strength).toBe(0.7)
      expect(intent.direction.x).toBeGreaterThan(0)
      expect(intent.direction.y).toBeGreaterThan(0)
    }
  })
})
