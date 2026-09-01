import { describe, expect, it } from 'vitest'
import type { ScaleTierDefinition } from '../content/schema'
import {
  advanceLifecycle,
  applyLifecycleBiomass,
  canAdvanceLifecycle,
  createLifecycle,
  markLifecycleEncounterResolved,
  radiusForTierProgress,
} from './lifecycle'

const tiers = [
  {
    id: 'tier-single-cell',
    formId: 'form-primal-cell',
    name: 'single',
    environmentId: 'env-clear-drop',
    targetDurationMs: 150_000,
    radiusRange: [12, 22],
    screenDiameterRange: [0.16, 0.21],
    worldBodyWidths: 30,
    minimumCollapsedBodyWidths: 6,
    evolutionPressureTarget: 100,
    ecologyBudgetId: 'ecology-tier-single-cell',
    encounterId: 'encounter-primal-shadow',
    movementBodyLengthsPerSecond: 2.4,
    turnResponseMs: 120,
  },
  {
    id: 'tier-colony',
    formId: 'form-colony-body',
    name: 'colony',
    environmentId: 'env-fiber-maze',
    targetDurationMs: 210_000,
    radiusRange: [18, 32],
    screenDiameterRange: [0.19, 0.25],
    worldBodyWidths: 24,
    minimumCollapsedBodyWidths: 6,
    evolutionPressureTarget: 200,
    ecologyBudgetId: 'ecology-tier-colony',
    encounterId: 'encounter-fiber-giant',
    movementBodyLengthsPerSecond: 2,
    turnResponseMs: 170,
  },
  {
    id: 'tier-ciliate',
    formId: 'form-ciliate-composite',
    name: 'ciliate',
    environmentId: 'env-abandoned-chamber',
    targetDurationMs: 270_000,
    radiusRange: [24, 40],
    screenDiameterRange: [0.22, 0.28],
    worldBodyWidths: 22,
    minimumCollapsedBodyWidths: 6,
    evolutionPressureTarget: 300,
    ecologyBudgetId: 'ecology-tier-ciliate',
    encounterId: 'encounter-final-host',
    movementBodyLengthsPerSecond: 1.95,
    turnResponseMs: 145,
  },
] as const satisfies readonly ScaleTierDefinition[]

describe('bounded form lifecycle', () => {
  it('caps physical radius while preserving excess biomass and pressure', () => {
    const state = applyLifecycleBiomass(createLifecycle(tiers, 144), 150, tiers)

    expect(state.totalBiomass).toBe(294)
    expect(state.tierBiomass).toBe(150)
    expect(state.evolutionPressure).toBe(1)
    expect(state.bodyRadius).toBe(22)
  })

  it('requires both full pressure and the ecology encounter before advancing', () => {
    const full = applyLifecycleBiomass(createLifecycle(tiers, 144), 100, tiers)

    expect(canAdvanceLifecycle(full, tiers)).toBe(false)
    const resolved = markLifecycleEncounterResolved(full)
    expect(canAdvanceLifecycle(resolved, tiers)).toBe(true)
    expect(advanceLifecycle(resolved, tiers)).toMatchObject({
      tierIndex: 1,
      formId: 'form-colony-body',
      tierBiomass: 0,
      evolutionPressure: 0,
      bodyRadius: 18,
      encounterResolved: false,
    })
  })

  it('never advertises a fourth form after the final tier', () => {
    const colony = advanceLifecycle(
      markLifecycleEncounterResolved(applyLifecycleBiomass(createLifecycle(tiers, 144), 100, tiers)),
      tiers,
    )
    const final = advanceLifecycle(
      markLifecycleEncounterResolved(applyLifecycleBiomass(colony, 200, tiers)),
      tiers,
    )
    const complete = markLifecycleEncounterResolved(applyLifecycleBiomass(final, 300, tiers))

    expect(canAdvanceLifecycle(complete, tiers)).toBe(false)
    expect(() => advanceLifecycle(complete, tiers)).toThrow(RangeError)
  })

  it('uses a finite eased radius and rejects malformed gain', () => {
    expect(radiusForTierProgress(tiers[0], 0.5)).toBe(19.5)
    expect(radiusForTierProgress(tiers[0], Number.NaN)).toBe(12)
    expect(applyLifecycleBiomass(createLifecycle(tiers, 144), Number.POSITIVE_INFINITY, tiers)).toMatchObject({
      totalBiomass: 144,
      tierBiomass: 0,
      bodyRadius: 12,
    })
  })
})
