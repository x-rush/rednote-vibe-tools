import type { EcologyBudgetDefinition, EnvironmentId, FirstRunAssistDefinition } from '../content'
import type { Vec2 } from '../domain/types'

export type EcologyRole = 'resource' | 'prey' | 'competitor' | 'scavenger' | 'hunter' | 'apex'
export type EcologyOpportunityId = 'food-bloom' | 'school-migration' | 'predator-conflict' | 'carcass-rush' | 'giant-passage' | 'hazard-surge'

export type EcologyPopulation = { role: EcologyRole; count: number; biomass: number; trend: -1 | 0 | 1 }
export type EcologySummary = {
  environmentId: EnvironmentId
  population: Record<EcologyRole, number>
  opportunityHistory: EcologyOpportunityId[]
  materializedGroupCount: number
}

export type EcologyVisibleEntity = {
  id: string
  role: EcologyRole
  distance: number
  biomass: number
  isBoss?: boolean
}

export type EcologyCommand =
  | { type: 'materialize-group'; groupId: string; role: EcologyRole; count: number; distance: number; angle: number; opportunityId?: EcologyOpportunityId }
  | { type: 'dematerialize-group'; entityIds: string[]; role: EcologyRole; biomass: number }
  | { type: 'start-opportunity'; opportunityId: EcologyOpportunityId; atMs: number }
  | { type: 'adjust-population'; role: EcologyRole; countDelta: number; biomassDelta: number }

export type EcologyDirectorState = {
  seed: number
  runOrdinal: number
  budget: EcologyBudgetDefinition
  assist: FirstRunAssistDefinition
  startedAtMs: number
  nextPopulationAtMs: number
  nextOpportunityAtMs: number
  nextFoodSupportAtMs: number
  opportunitySequence: number
  groupSequence: number
  recentOpportunities: EcologyOpportunityId[]
  firstFoodProvided: boolean
  populations: Record<EcologyRole, EcologyPopulation>
  summary: EcologySummary
}

export type EcologyDirectorInput = {
  atMs: number
  playerPosition: Vec2
  viewportRadius: number
  nearbyEdibleCount: number
  visibleEntities: readonly EcologyVisibleEntity[]
}

const ROLES: readonly EcologyRole[] = ['resource', 'prey', 'competitor', 'scavenger', 'hunter', 'apex']
const OPPORTUNITIES: readonly EcologyOpportunityId[] = ['food-bloom', 'school-migration', 'predator-conflict', 'carcass-rush', 'giant-passage', 'hazard-surge']

export function createEcologyDirector(
  budget: EcologyBudgetDefinition,
  seed: number,
  runOrdinal: number,
  assist: FirstRunAssistDefinition,
  startedAtMs: number,
): EcologyDirectorState {
  const populations = Object.fromEntries(ROLES.map((role) => {
    const count = midpoint(budget[role])
    return [role, { role, count, biomass: count * biomassPerRole(role), trend: 0 }]
  })) as Record<EcologyRole, EcologyPopulation>
  const nextOpportunityAtMs = startedAtMs + seededRange(seed, 0, budget.opportunityIntervalMs)
  return withSummary({
    seed,
    runOrdinal,
    budget,
    assist,
    startedAtMs,
    nextPopulationAtMs: startedAtMs + 1000,
    nextOpportunityAtMs,
    nextFoodSupportAtMs: startedAtMs + (runOrdinal <= assist.throughRunOrdinal ? Math.min(1000, assist.firstFoodDeadlineMs) : 4000),
    opportunitySequence: 0,
    groupSequence: 0,
    recentOpportunities: [],
    firstFoodProvided: false,
    populations,
    summary: undefined as never,
  })
}

export function stepEcologyDirector(
  state: EcologyDirectorState,
  input: EcologyDirectorInput,
): { state: EcologyDirectorState; commands: EcologyCommand[] } {
  let next = cloneState(state)
  const commands: EcologyCommand[] = []

  if (input.atMs >= next.nextPopulationAtMs) {
    const elapsedSteps = Math.min(8, Math.floor((input.atMs - next.nextPopulationAtMs) / 1000) + 1)
    for (let step = 0; step < elapsedSteps; step += 1) stepPopulations(next, commands)
    next.nextPopulationAtMs += elapsedSteps * 1000
  }

  if (input.nearbyEdibleCount === 0 && input.atMs >= next.nextFoodSupportAtMs) {
    commands.push(materialize(next, 'resource', 6, Math.min(56, input.viewportRadius * 0.18), undefined))
    next.firstFoodProvided = true
    next.nextFoodSupportAtMs = input.atMs + 6000
  } else if (input.nearbyEdibleCount > 0) {
    next.firstFoodProvided = true
    next.nextFoodSupportAtMs = Math.max(next.nextFoodSupportAtMs, input.atMs + 2500)
  }

  if (input.atMs >= next.nextOpportunityAtMs) {
    const opportunityId = chooseOpportunity(next)
    commands.push({ type: 'start-opportunity', opportunityId, atMs: input.atMs })
    const scene = opportunityScene(opportunityId, input.viewportRadius)
    commands.push(materialize(next, scene.role, scene.count, scene.distance, opportunityId))
    next.recentOpportunities = [...next.recentOpportunities, opportunityId].slice(-3)
    next.opportunitySequence += 1
    next.nextOpportunityAtMs = input.atMs + seededRange(next.seed, next.opportunitySequence, next.budget.opportunityIntervalMs)
  }

  const distant = input.visibleEntities.filter((entity) => !entity.isBoss && entity.distance > input.viewportRadius * 1.75)
  for (const role of ROLES) {
    const entities = distant.filter((entity) => entity.role === role)
    if (entities.length === 0) continue
    const biomass = entities.reduce((sum, entity) => sum + entity.biomass, 0)
    commands.push({ type: 'dematerialize-group', entityIds: entities.map((entity) => entity.id), role, biomass })
    const population = next.populations[role]
    population.count = clamp(population.count + entities.length, next.budget[role])
    population.biomass += biomass
    population.trend = 1
  }

  next = withSummary(next)
  return { state: next, commands }
}

function stepPopulations(state: EcologyDirectorState, commands: EcologyCommand[]) {
  for (const [index, role] of ROLES.entries()) {
    const population = state.populations[role]
    const target = midpoint(state.budget[role])
    const noise = hashUnit(state.seed, state.opportunitySequence * 97 + state.groupSequence * 13 + index) > 0.72 ? 1 : 0
    const desired = population.count < target ? 1 : population.count > target ? -1 : role === 'resource' ? noise : 0
    const nextCount = clamp(population.count + desired, state.budget[role])
    const delta = nextCount - population.count
    population.count = nextCount
    population.biomass = Math.max(0, population.biomass + delta * biomassPerRole(role))
    population.trend = Math.sign(delta) as -1 | 0 | 1
    if (delta !== 0) commands.push({ type: 'adjust-population', role, countDelta: delta, biomassDelta: delta * biomassPerRole(role) })
  }
}

function chooseOpportunity(state: EcologyDirectorState): EcologyOpportunityId {
  const assisted = state.runOrdinal <= state.assist.throughRunOrdinal
  const allowed = OPPORTUNITIES.filter((id) => (
    !state.recentOpportunities.includes(id)
    && (!assisted || !state.assist.blockedOpportunityIds.includes(id))
    && (id !== 'hazard-surge' || state.budget.environmentId !== 'env-clear-drop')
    && (id !== 'giant-passage' || state.budget.environmentId === 'env-algae-glow' || state.budget.environmentId === 'env-abandoned-chamber')
  ))
  const fallback = OPPORTUNITIES.filter((id) => !state.recentOpportunities.includes(id))
  const choices = allowed.length > 0 ? allowed : fallback
  return choices[Math.floor(hashUnit(state.seed, state.opportunitySequence + 41) * choices.length)] ?? 'food-bloom'
}

function opportunityScene(id: EcologyOpportunityId, viewportRadius: number): { role: EcologyRole; count: number; distance: number } {
  if (id === 'food-bloom') return { role: 'resource', count: 7, distance: Math.min(150, viewportRadius * 0.45) }
  if (id === 'school-migration') return { role: 'competitor', count: 5, distance: viewportRadius * 1.18 }
  if (id === 'predator-conflict') return { role: 'hunter', count: 2, distance: viewportRadius * 0.86 }
  if (id === 'carcass-rush') return { role: 'scavenger', count: 4, distance: viewportRadius * 0.62 }
  if (id === 'giant-passage') return { role: 'apex', count: 1, distance: viewportRadius * 1.2 }
  return { role: 'hunter', count: 3, distance: viewportRadius * 1.05 }
}

function materialize(
  state: EcologyDirectorState,
  role: EcologyRole,
  count: number,
  distance: number,
  opportunityId: EcologyOpportunityId | undefined,
): Extract<EcologyCommand, { type: 'materialize-group' }> {
  const groupId = `eco-group-${state.groupSequence}`
  const angle = hashUnit(state.seed, state.groupSequence + 701) * Math.PI * 2
  state.groupSequence += 1
  state.populations[role].count = clamp(state.populations[role].count - count, state.budget[role])
  return { type: 'materialize-group', groupId, role, count, distance, angle, ...(opportunityId ? { opportunityId } : {}) }
}

function withSummary(state: EcologyDirectorState): EcologyDirectorState {
  return {
    ...state,
    summary: {
      environmentId: state.budget.environmentId,
      population: Object.fromEntries(ROLES.map((role) => [role, state.populations[role].count])) as Record<EcologyRole, number>,
      opportunityHistory: [...state.recentOpportunities],
      materializedGroupCount: state.groupSequence,
    },
  }
}

function cloneState(state: EcologyDirectorState): EcologyDirectorState {
  return {
    ...state,
    recentOpportunities: [...state.recentOpportunities],
    populations: Object.fromEntries(ROLES.map((role) => [role, { ...state.populations[role] }])) as Record<EcologyRole, EcologyPopulation>,
    summary: { ...state.summary, population: { ...state.summary.population }, opportunityHistory: [...state.summary.opportunityHistory] },
  }
}

function midpoint(range: [number, number]): number {
  return Math.round((range[0] + range[1]) / 2)
}

function clamp(value: number, range: [number, number]): number {
  return Math.min(range[1], Math.max(range[0], value))
}

function seededRange(seed: number, sequence: number, range: [number, number]): number {
  return Math.round(range[0] + hashUnit(seed, sequence + 101) * (range[1] - range[0]))
}

function hashUnit(seed: number, sequence: number): number {
  let value = Math.imul(seed ^ Math.imul(sequence + 1, 0x9e3779b1), 0x85ebca6b)
  value ^= value >>> 13
  value = Math.imul(value, 0xc2b2ae35)
  return (value >>> 0) / 4_294_967_296
}

function biomassPerRole(role: EcologyRole): number {
  return role === 'resource' ? 16 : role === 'prey' ? 48 : role === 'competitor' ? 90 : role === 'scavenger' ? 120 : role === 'hunter' ? 420 : 900
}
