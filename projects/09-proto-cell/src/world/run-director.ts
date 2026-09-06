import type {
  EnvironmentId,
  FirstRunAssistDefinition,
  JourneyDefinition,
  JourneyStageDefinition,
  ScaleTierDefinition,
} from '../content'
import { getContent } from '../content'
import type { GameEvent } from '../game/interactions'

export type RunPhase = 'active' | 'feeding' | 'warning' | 'encounter' | 'choosing' | 'collapsing' | 'transition' | 'finale' | 'complete'

export type RunDirectorState = {
  seed: number
  runOrdinal: number
  stageIndex: number
  environmentId: EnvironmentId
  phase: RunPhase
  stageStartedAtMs: number
  offeredRoutes: JourneyStageDefinition['routeOffers']
  warningLeadMultiplier: number
  mode?: 'legacy' | 'scale'
  tiers?: readonly ScaleTierDefinition[]
  tierIndex?: number
}

export type RunDirectorStep = { state: RunDirectorState; events: GameEvent[] }

export function createRunDirector(
  journey: JourneyDefinition | readonly ScaleTierDefinition[],
  seed: number,
  runOrdinal: number,
  assist: FirstRunAssistDefinition,
): RunDirectorState {
  if (!('stages' in journey)) return createScaleDirector(journey, seed, runOrdinal, assist)
  const firstStage = journey.stages[0]
  if (!firstStage) throw new RangeError('Journey requires at least one stage')

  return {
    seed,
    runOrdinal,
    stageIndex: 0,
    environmentId: 'env-clear-drop',
    phase: 'active',
    stageStartedAtMs: 0,
    offeredRoutes: copyRoutes(firstStage.routeOffers),
    warningLeadMultiplier: runOrdinal <= assist.throughRunOrdinal ? assist.warningLeadMultiplier : 1,
  }
}

export function stepRunDirector(
  state: RunDirectorState,
  input: { atMs: number; selectedRouteId?: string; pressureReady?: boolean; encounterResolved?: boolean },
): RunDirectorStep {
  if (state.mode === 'scale') return stepScaleDirector(state, input)
  if (state.phase === 'complete') return unchanged(state)

  const journey = getContent().journey
  const stage = journey.stages[state.stageIndex]
  if (!stage) return { state: { ...state, phase: 'complete' }, events: [] }

  const ageMs = Math.max(0, input.atMs - state.stageStartedAtMs)
  if (state.phase === 'finale') {
    return ageMs >= stage.durationMs
      ? { state: { ...state, phase: 'complete' }, events: [] }
      : unchanged(state)
  }

  const selectedRoute = (state.phase === 'choosing' || state.phase === 'collapsing')
    ? state.offeredRoutes.find((route) => route.id === input.selectedRouteId)
    : undefined
  if (selectedRoute) return enterJourneyStage(state, selectedRoute, input.atMs, false, journey)

  const warningLeadMs = stage.warningLeadMs * state.warningLeadMultiplier
  if (state.phase === 'active' && ageMs >= stage.durationMs - warningLeadMs) {
    return {
      state: { ...state, phase: 'warning' },
      events: [{ type: 'collapse-warning', stageIndex: state.stageIndex + 1, atMs: input.atMs }],
    }
  }

  if (state.phase === 'warning' && ageMs >= stage.durationMs) {
    return {
      state: { ...state, phase: 'choosing' },
      events: [{
        type: 'migration-ready',
        stageIndex: state.stageIndex + 1,
        routes: copyRoutes(state.offeredRoutes),
        atMs: input.atMs,
      }],
    }
  }

  const collapseDeadlineMs = stage.durationMs + stage.collapseDurationMs
  if ((state.phase === 'choosing' || state.phase === 'collapsing') && ageMs >= collapseDeadlineMs) {
    const route = deterministicFallback(state)
    return route
      ? enterJourneyStage(state, route, input.atMs, true, journey)
      : { state: { ...state, phase: 'complete' }, events: [] }
  }

  if (state.phase === 'choosing') return { state: { ...state, phase: 'collapsing' }, events: [] }
  return unchanged(state)
}

function createScaleDirector(tiers: readonly ScaleTierDefinition[], seed: number, runOrdinal: number, assist: FirstRunAssistDefinition): RunDirectorState {
  const first = tiers[0]
  if (!first) throw new RangeError('Scale journey requires at least one tier')
  return {
    seed,
    runOrdinal,
    stageIndex: 0,
    tierIndex: 0,
    environmentId: first.environmentId,
    phase: 'feeding',
    stageStartedAtMs: 0,
    offeredRoutes: [],
    warningLeadMultiplier: runOrdinal <= assist.throughRunOrdinal ? assist.warningLeadMultiplier : 1,
    mode: 'scale',
    tiers,
  }
}

function stepScaleDirector(
  state: RunDirectorState,
  input: { atMs: number; pressureReady?: boolean; encounterResolved?: boolean },
): RunDirectorStep {
  if (state.phase === 'complete') return unchanged(state)
  const tiers = state.tiers ?? []
  const tierIndex = state.tierIndex ?? state.stageIndex
  const tier = tiers[tierIndex]
  if (!tier) return { state: { ...state, phase: 'complete' }, events: [] }
  const pressureReady = input.pressureReady === true
  const encounterResolved = input.encounterResolved === true
  if (state.phase === 'feeding' && pressureReady) {
    if (encounterResolved) {
      if (tierIndex >= tiers.length - 1) return { state: { ...state, phase: 'complete' }, events: [] }
      return {
        state: { ...state, phase: 'transition' },
        events: [{ type: 'tier-encounter-resolved', tierIndex, encounterId: tier.encounterId, atMs: input.atMs }],
      }
    }
    return { state: { ...state, phase: 'warning' }, events: [{ type: 'collapse-warning', stageIndex: tierIndex + 1, atMs: input.atMs }] }
  }
  if (state.phase === 'warning' && pressureReady) {
    return { state: { ...state, phase: 'encounter' }, events: [] }
  }
  if (state.phase === 'encounter' && pressureReady && encounterResolved) {
    if (tierIndex >= tiers.length - 1) return { state: { ...state, phase: 'complete' }, events: [] }
    return {
      state: { ...state, phase: 'transition' },
      events: [{ type: 'tier-encounter-resolved', tierIndex, encounterId: tier.encounterId, atMs: input.atMs }],
    }
  }
  return unchanged(state)
}

function enterJourneyStage(
  state: RunDirectorState,
  route: JourneyStageDefinition['routeOffers'][number],
  atMs: number,
  forced: boolean,
  journey: JourneyDefinition,
): RunDirectorStep {
  const stageIndex = state.stageIndex + 1
  const nextStage = journey.stages[stageIndex]
  const environmentId = route.destinationEnvironmentId
  const events: GameEvent[] = []
  if (forced) {
    events.push({
      type: 'migration-forced',
      stageIndex: state.stageIndex + 1,
      routeId: route.id,
      destinationEnvironmentId: environmentId,
      atMs,
    })
  }
  events.push({ type: 'route-selected', routeId: route.id, environmentId, atMs })

  return {
    state: {
      ...state,
      stageIndex,
      environmentId,
      phase: nextStage?.routeOffers.length === 0 ? 'finale' : 'active',
      stageStartedAtMs: atMs,
      offeredRoutes: copyRoutes(nextStage?.routeOffers ?? []),
    },
    events,
  }
}

function deterministicFallback(state: RunDirectorState) {
  if (state.offeredRoutes.length === 0) return undefined
  const index = (Math.imul(state.seed ^ state.stageIndex, 2_654_435_761) >>> 0) % state.offeredRoutes.length
  return state.offeredRoutes[index]
}

function copyRoutes(routes: JourneyStageDefinition['routeOffers']): JourneyStageDefinition['routeOffers'] {
  return routes.map((route) => ({ ...route }))
}

function unchanged(state: RunDirectorState): RunDirectorStep {
  return { state, events: [] }
}
