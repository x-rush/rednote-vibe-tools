import { getContent, type BodyStage, type EnvironmentId, type OrganelleId, type SynergyId } from '../content'

export type EvolutionRoute = 'predation' | 'survival' | 'colony'
export type EvolutionLane = 'continuation' | 'adaptation' | 'risk'

export type BuildState = {
  bodyStage: BodyStage
  evolutionCount: number
  traitIds: OrganelleId[]
  routeCounts: Record<EvolutionRoute, number>
  synergyIds: SynergyId[]
  stability: number
}

export type BuildTraitDefinition = {
  organId: OrganelleId
  route: EvolutionRoute
  triggerId: `trigger-${string}`
  effectId: string
  morphologyPartId: string
  costText: string
  environmentIds: EnvironmentId[]
}

export type EvolutionOffer = {
  lane: EvolutionLane
  traitId: OrganelleId
  route: EvolutionRoute
  resultingBodyStage: BodyStage
  behaviorText: string
  costText: string
  triggerAvailable: boolean
}

export type EvolutionOfferContext = {
  seed: number
  environmentId: EnvironmentId
  stageIndex: number
  remainingEnvironmentIds: EnvironmentId[]
  unlockedTraitIds: OrganelleId[]
  recentTraitIds: OrganelleId[]
}

const ROUTES: readonly EvolutionRoute[] = ['predation', 'survival', 'colony']

export function createBuildState(overrides: Partial<BuildState> = {}): BuildState {
  return {
    bodyStage: 'microbe',
    evolutionCount: 0,
    traitIds: [],
    routeCounts: { predation: 0, survival: 0, colony: 0 },
    synergyIds: [],
    stability: 100,
    ...overrides,
    routeCounts: { predation: 0, survival: 0, colony: 0, ...overrides.routeCounts },
    traitIds: [...(overrides.traitIds ?? [])],
    synergyIds: [...(overrides.synergyIds ?? [])],
  }
}

export function traitDefinition(traitId: OrganelleId): BuildTraitDefinition {
  const organ = getContent().organelles.find((candidate) => candidate.id === traitId)
  if (!organ) throw new RangeError(`Unknown evolution trait: ${traitId}`)
  return {
    organId: organ.id,
    route: organ.evolutionRoute,
    triggerId: organ.evolutionTriggerId,
    effectId: organ.behaviorId,
    morphologyPartId: organ.morphologyPartId,
    costText: organ.costText,
    environmentIds: [...organ.environmentIds],
  }
}

export function bodyStageAfterOffer(
  state: BuildState,
  milestone: { stageIndex: number; evolutionCount: number },
): BodyStage {
  if (milestone.stageIndex === 0 && milestone.evolutionCount === 0) return 'hunter'
  if (milestone.stageIndex === 2) return 'specialist'
  if (milestone.stageIndex === 3) return 'dominant'
  if (milestone.stageIndex === 4) return 'ascendant'
  return state.bodyStage
}

export function offerEvolution(state: BuildState, context: EvolutionOfferContext): EvolutionOffer[] {
  const availableEnvironments = new Set([context.environmentId, ...context.remainingEnvironmentIds])
  const unlocked = new Set(context.unlockedTraitIds)
  const installed = new Set(state.traitIds)
  const recent = new Set(context.recentTraitIds)
  const all = getContent().organelles.filter((organ) => (
    unlocked.has(organ.id)
    && !installed.has(organ.id)
    && organ.environmentIds.some((environmentId) => availableEnvironments.has(environmentId))
  ))
  const pool = all.filter((organ) => !recent.has(organ.id)).length >= 3
    ? all.filter((organ) => !recent.has(organ.id))
    : all
  const dominantRoute = ROUTES.reduce((best, route) => (
    state.routeCounts[route] > state.routeCounts[best] ? route : best
  ), ROUTES[0])
  const hasCommittedRoute = ROUTES.some((route) => state.routeCounts[route] > 0)
  const lanes: readonly EvolutionLane[] = ['continuation', 'adaptation', 'risk']
  const used = new Set<OrganelleId>()

  return lanes.flatMap((lane) => {
    const candidates = pool
      .filter((organ) => !used.has(organ.id))
      .map((organ) => ({
        organ,
        score: candidateScore(organ, lane, context.environmentId, dominantRoute, hasCommittedRoute)
          + seededTiebreak(context.seed, state.evolutionCount, lane, organ.id),
      }))
      .sort((left, right) => right.score - left.score || left.organ.id.localeCompare(right.organ.id))
    const selected = candidates[0]?.organ
    if (!selected) return []
    used.add(selected.id)
    return [{
      lane,
      traitId: selected.id,
      route: selected.evolutionRoute,
      resultingBodyStage: bodyStageAfterOffer(state, { stageIndex: context.stageIndex, evolutionCount: state.evolutionCount }),
      behaviorText: selected.shortEffect,
      costText: selected.costText,
      triggerAvailable: selected.environmentIds.some((environmentId) => availableEnvironments.has(environmentId)),
    }]
  })
}

export function applyEvolution(state: BuildState, offer: EvolutionOffer): BuildState {
  const organ = getContent().organelles.find((candidate) => candidate.id === offer.traitId)
  if (!organ) throw new RangeError(`Unknown evolution trait: ${offer.traitId}`)
  const traitIds = state.traitIds.includes(offer.traitId) ? [...state.traitIds] : [...state.traitIds, offer.traitId]
  const installed = new Set(traitIds)
  const synergyIds = getContent().synergies
    .filter((synergy) => synergy.requires.every((traitId) => installed.has(traitId)))
    .map((synergy) => synergy.id)

  return {
    ...state,
    bodyStage: offer.resultingBodyStage,
    evolutionCount: state.evolutionCount + 1,
    traitIds,
    routeCounts: { ...state.routeCounts, [offer.route]: state.routeCounts[offer.route] + 1 },
    synergyIds,
    stability: Math.max(0, state.stability - (organ.cost.stability ?? 0)),
  }
}

function candidateScore(
  organ: ReturnType<typeof getContent>['organelles'][number],
  lane: EvolutionLane,
  environmentId: EnvironmentId,
  dominantRoute: EvolutionRoute,
  hasCommittedRoute: boolean,
): number {
  const environmentMatch = organ.environmentIds.includes(environmentId) ? 30 : 0
  if (lane === 'continuation') return (hasCommittedRoute && organ.evolutionRoute === dominantRoute ? 100 : 20) + environmentMatch
  if (lane === 'adaptation') return environmentMatch * 4 + (organ.evolutionRoute === dominantRoute ? 10 : 0)
  return (hasCommittedRoute && organ.evolutionRoute !== dominantRoute ? 100 : 25) + (organ.rarity === 'rare' ? 20 : 0)
}

function seededTiebreak(seed: number, evolutionCount: number, lane: EvolutionLane, id: string): number {
  let value = (seed ^ ((evolutionCount + 1) * 0x9e3779b1) ^ lanesHash(lane)) >>> 0
  for (let index = 0; index < id.length; index += 1) value = Math.imul(value ^ id.charCodeAt(index), 16777619) >>> 0
  return (value % 10_000) / 100_000
}

function lanesHash(lane: EvolutionLane): number {
  return lane === 'continuation' ? 0x51 : lane === 'adaptation' ? 0xa7 : 0xe3
}
