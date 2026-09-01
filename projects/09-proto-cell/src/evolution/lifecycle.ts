import type { FormId, ScaleTierDefinition } from '../content/schema'

export type LifecycleState = {
  tierIndex: number
  formId: FormId
  totalBiomass: number
  tierBiomass: number
  evolutionPressure: number
  bodyRadius: number
  encounterResolved: boolean
}

export function createLifecycle(
  tiers: readonly ScaleTierDefinition[],
  initialBiomass: number,
): LifecycleState {
  const tier = tierAt(tiers, 0)
  return {
    tierIndex: 0,
    formId: tier.formId,
    totalBiomass: finiteNonNegative(initialBiomass),
    tierBiomass: 0,
    evolutionPressure: 0,
    bodyRadius: radiusForTierProgress(tier, 0),
    encounterResolved: false,
  }
}

export function applyLifecycleBiomass(
  state: LifecycleState,
  gain: number,
  tiers: readonly ScaleTierDefinition[],
): LifecycleState {
  const acceptedGain = finiteNonNegative(gain)
  const tier = tierAt(tiers, state.tierIndex)
  const tierBiomass = state.tierBiomass + acceptedGain
  const evolutionPressure = clamp01(tierBiomass / tier.evolutionPressureTarget)
  return {
    ...state,
    totalBiomass: state.totalBiomass + acceptedGain,
    tierBiomass,
    evolutionPressure,
    bodyRadius: radiusForTierProgress(tier, evolutionPressure),
  }
}

export function markLifecycleEncounterResolved(state: LifecycleState): LifecycleState {
  return { ...state, encounterResolved: true }
}

export function canAdvanceLifecycle(
  state: LifecycleState,
  tiers: readonly ScaleTierDefinition[],
): boolean {
  return state.tierIndex >= 0
    && state.tierIndex < tiers.length - 1
    && state.evolutionPressure >= 1
    && state.encounterResolved
}

export function advanceLifecycle(
  state: LifecycleState,
  tiers: readonly ScaleTierDefinition[],
): LifecycleState {
  if (!canAdvanceLifecycle(state, tiers)) throw new RangeError('Lifecycle is not ready to advance')
  const tierIndex = state.tierIndex + 1
  const tier = tierAt(tiers, tierIndex)
  return {
    ...state,
    tierIndex,
    formId: tier.formId,
    tierBiomass: 0,
    evolutionPressure: 0,
    bodyRadius: radiusForTierProgress(tier, 0),
    encounterResolved: false,
  }
}

export function radiusForTierProgress(tier: ScaleTierDefinition, progress: number): number {
  const [minimum, maximum] = tier.radiusRange
  const clampedProgress = clamp01(progress)
  const easedProgress = 1 - (1 - clampedProgress) ** 2
  return minimum + (maximum - minimum) * easedProgress
}

function tierAt(tiers: readonly ScaleTierDefinition[], index: number): ScaleTierDefinition {
  const tier = tiers[index]
  if (!tier) throw new RangeError(`Unknown lifecycle tier index: ${index}`)
  return tier
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
