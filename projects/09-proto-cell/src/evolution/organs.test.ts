import { describe, expect, it } from 'vitest'
import { perception, playerWith } from '../tests/fixtures'
import { applyOrganEffects, evaluatePassiveOrgans } from './organs'

describe('passive organ behavior registry', () => {
  it('spawns an automatic decoy without replacing the controlled player', () => {
    const result = applyOrganEffects([{ entityId: 'player', organId: 'organelle-division-ring', atMs: 0, type: 'organ-triggered', effect: 'colony-decoy', amount: 1 }])
    expect(result.controlledEntityId).toBe('player')
    expect(result.spawnedDecoys).toHaveLength(1)
  })

  it('fires jet vacuole only on imminent containment', () => {
    const player = playerWith('organelle-jet-vacuole', { velocity: { x: 20, y: 0 } })

    expect(evaluatePassiveOrgans(player, perception({ containmentRatio: 0.54 }))).toEqual([])
    expect(evaluatePassiveOrgans(player, perception({ containmentRatio: 0.56, threatEscapeDirection: { x: 1, y: 0 } }))).toContainEqual(expect.objectContaining({
      type: 'organ-triggered',
      organId: 'organelle-jet-vacuole',
      effect: 'escape-impulse',
      impulse: { x: 1, y: 0 },
    }))
  })

  it('repairs only after leaving danger and paying energy', () => {
    const player = playerWith('organelle-repair-vacuole', { membrane: 60, energy: 20 })

    expect(evaluatePassiveOrgans(player, perception({ msSinceDamage: 2999, membraneMax: 100 }))).toEqual([])
    expect(evaluatePassiveOrgans(player, perception({ msSinceDamage: 3000, membraneMax: 100 }))).toContainEqual(expect.objectContaining({
      organId: 'organelle-repair-vacuole',
      effect: 'repair',
      amount: 10,
      energyCost: 8,
    }))
  })

  it('does not retrigger an organ while its deterministic cooldown is active', () => {
    const player = playerWith('organelle-repair-vacuole', { membrane: 60, energy: 20 })

    expect(evaluatePassiveOrgans(player, perception({
      msSinceDamage: 4000,
      membraneMax: 100,
      cooldownRemainingMs: { 'organelle-repair-vacuole': 1 },
    }))).toEqual([])
  })

  it('blocks a finite fatal hit with the guard symbiont', () => {
    const effects = evaluatePassiveOrgans(
      playerWith('organelle-guard-symbiont'),
      perception({ incomingFatalDamage: true, incomingDamage: 120 }),
    )

    expect(effects).toContainEqual(expect.objectContaining({
      organId: 'organelle-guard-symbiont',
      effect: 'block',
      amount: 120,
      energyCost: 14,
      consumesCharge: true,
    }))
    expect(effects.every((effect) => Number.isFinite(effect.amount ?? 0))).toBe(true)
  })

  it('cannot block without a guard charge and matures division into three children', () => {
    const emptyGuard = playerWith('organelle-guard-symbiont')
    emptyGuard.installedOrganelles = emptyGuard.installedOrganelles.map((organ) => ({ ...organ, charges: 0 }))
    expect(evaluatePassiveOrgans(emptyGuard, perception({ incomingFatalDamage: true, incomingDamage: 120 }))).toEqual([])

    const matureDivision = playerWith('organelle-division-ring', { mass: 320 })
    matureDivision.installedOrganelles = matureDivision.installedOrganelles.map((organ) => ({ ...organ, stage: 'mature' }))
    expect(evaluatePassiveOrgans(matureDivision, perception())).toContainEqual(expect.objectContaining({
      effect: 'split',
      amount: 3,
    }))
  })

  it('splits before majority coverage becomes lethal', () => {
    const player = playerWith('organelle-division-ring', { mass: 180 })

    expect(evaluatePassiveOrgans(player, perception({ containmentRatio: 0.61 }))).toEqual([])
    expect(evaluatePassiveOrgans(player, perception({ containmentRatio: 0.63 }))).toContainEqual(expect.objectContaining({
      effect: 'split',
    }))
  })
})
