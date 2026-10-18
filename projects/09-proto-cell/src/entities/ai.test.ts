import { describe, expect, it } from 'vitest'
import { entityAt } from '../tests/fixtures'
import { decideBehavior, decideIntent } from './ai'
import { getContent } from '../content'

describe('baseline ecology AI', () => {
  it('makes a former hunter abandon its target and flee the evolved larger player', () => {
    const hunter = { ...entityAt('old-hunter', 0, 0), role: 'predator' as const, faction: 'hostile' as const, mass: 484 }
    const player = { ...entityAt('player', 30, 0), role: 'player' as const, faction: 'player' as const, mass: 1600 }
    hunter.body.radius = 22
    player.body.radius = 40
    const decision = decideBehavior(hunter, { state: 'pursue', stateStartedAtMs: 0, targetId: 'player' }, {
      atMs: 2000,
      nearby: [player],
      profile: getContent().behaviorProfiles.find((item) => item.family === 'hunter')!,
    }).decision
    expect(decision.presentationState).toBe('flee')
    expect(decision.movement.direction.x).toBeLessThan(0)
    expect(decision.targetId).toBe('player')
  })

  it('keeps a larger predator pursuing instead of applying cosmetic reversal', () => {
    const predator = { ...entityAt('predator', 0, 0), role: 'predator' as const, faction: 'hostile' as const, mass: 1600 }
    const player = { ...entityAt('player', 30, 0), role: 'player' as const, faction: 'player' as const, mass: 144 }
    predator.body.radius = 40
    player.body.radius = 12
    const decision = decideBehavior(predator, { state: 'pursue', stateStartedAtMs: 0, targetId: 'player' }, {
      atMs: 200,
      nearby: [player],
      profile: getContent().behaviorProfiles.find((item) => item.family === 'hunter')!,
    }).decision
    expect(decision.presentationState).not.toBe('flee')
    expect(decision.movement.direction.x).toBeGreaterThan(0)
  })
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
