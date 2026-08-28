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
})
