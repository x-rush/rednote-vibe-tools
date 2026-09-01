import type {
  EnvironmentId,
  FirstRunAssistDefinition,
  JourneyDefinition,
  JourneyStageDefinition,
} from '../content'
import { getContent } from '../content'
import type { GameEvent } from '../game/interactions'

export type RunPhase = 'active' | 'warning' | 'choosing' | 'collapsing' | 'finale' | 'complete'

export type RunDirectorState = {
  seed: number
  runOrdinal: number
  stageIndex: number
  environmentId: EnvironmentId
  phase: RunPhase
  stageStartedAtMs: number
  offeredRoutes: JourneyStageDefinition['routeOffers']
  warningLeadMultiplier: number
}

export type RunDirectorStep = { state: RunDirectorState; events: GameEvent[] }

export function createRunDirector(
  journey: JourneyDefinition,
  seed: number,
  runOrdinal: number,
  assist: FirstRunAssistDefinition,
): RunDirectorState {
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
  input: { atMs: number; selectedRouteId?: string },
): RunDirectorStep {
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
