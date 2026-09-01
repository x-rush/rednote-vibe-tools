import content from '../content/content.json'
import { getBehaviorProfile } from '../content'
import type { AnchorSlot, BodyStage, BossId, BossResolutionPath, EcologyBudgetDefinition, EventId, FirstRunAssistDefinition, FormId, JourneyDefinition, OrganelleId, OriginId, ScaleTierDefinition, StageThreatProfileDefinition } from '../content'
import type { EntityState, Vec2 } from '../domain/types'
import { decideBehavior, decideIntent } from '../entities/ai'
import type { BehaviorMemory } from '../entities/behaviors/types'
import { createEntity, type ContactDamageDefinition, type EntityDefinition } from '../entities/factory'
import { creatureEntityDefinition, ecologyGroupPositions, findEnteredRouteRift, generateRegion, getRegionDefinition } from '../world/generator'
import { createFixedClock } from './clock'
import { createPointerInput, type MovementIntent, type PointerInput } from './input'
import { resolveInteraction, type DamageSource, type GameEvent } from './interactions'
import { coveredRatio } from './containment'
import { SpatialGrid } from './spatial-grid'
import type { MutationInstallResult } from '../evolution/mutation'
import { evaluatePassiveOrgans, FATAL_SPLIT_COVERAGE, type EvolvedEntityState, type InstalledOrganelle, type OrganEffect, type OrganPerception } from '../evolution/organs'
import { advanceFusionStability, splitBody, stepSwarm, tryFuse, type SwarmBody } from '../evolution/split'
import { createRng } from '../domain/rng'
import { bossRamDamage, createBoss, stepBoss, type BossState } from '../world/bosses'
import { startEvent, stepEvent, type EcosystemEventState } from '../world/events'
import { applyEventWorldEffects, createEnvironmentField, resolveEnvironmentMovement, sampleEnvironmentField, stepEnvironmentField, type EnvironmentField } from '../world/environments'
import type { GeneratedRegion, RouteRift } from '../world/generator'
import { applyModifiers } from '../progression/challenges'
import { applySoftBoundary, constrainWorldMotion, engulfAccessMargin } from './bounds'
import { advanceVelocity } from './motion'
import { escapeContactRelief } from './escape'
import { createRunDirector, stepRunDirector, type RunDirectorState, type RunPhase } from '../world/run-director'
import { createEcologyDirector, stepEcologyDirector, type EcologyCommand, type EcologyRole, type EcologySummary } from '../world/ecology-director'
import { createBuildState, type BuildState } from '../evolution/build'
import { evaluateTriggers, type TriggerFrame, type TriggerOutcome } from '../evolution/triggers'
import { isMaterializing, isThreatArrivalInactive, materializeSpawn, stepThreatArrival } from './materialization'
import { advanceLifecycle, applyLifecycleBiomass, canAdvanceLifecycle, createLifecycle, radiusForTierProgress, type LifecycleState } from '../evolution/lifecycle'

export type PauseReason = 'user' | 'visibility' | 'evolution' | 'canvas'

export type HudSnapshot = {
  membrane: number
  energy: number
  stability: number
  biomass: number
  peakBiomass: number
  evolutionThreshold: number
  elapsedMs: number
  environmentId: string
  paused: boolean
  engulfScore: number
  journeyIndex: number
  journeyTotal: number
  bodyStage: BodyStage
  bodyStageProgress: number
  formId: FormId
  tierIndex: number
  tierProgress: number
  membraneRatio: number
  swarm?: { bodyCount: number; minimumRemainingMs: number; fusionProgress: number }
}

export type PlayerMorphologySnapshot = {
  bodyCount: number
  totalMass: number
  radius: number
  stability: number
  organelles: InstalledOrganelle[]
}

export type GameEngine = {
  start(): void
  advance(elapsedMs: number): void
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
  snapshot(): HudSnapshot
  drainEvents(): GameEvent[]
  destroy(): void
}

export type WorldRenderSnapshot = {
  elapsedMs: number
  interpolationAlpha: number
  environmentId: string
  width: number
  height: number
  playerId: string
  bodyStage: BodyStage
  playerBuild?: BuildState
  entities: readonly EntityState[]
  playerOrganelleIdsByEntity: Readonly<Record<string, readonly OrganelleId[]>>
  playerStability: number
  playerSynergyIds: readonly string[]
  playerDamage?: { source: DamageSource; untilMs: number }
  swarmTransition?: { kind: 'split' | 'fusion'; bodyCount: number; startedAtMs: number }
  routeRifts: readonly RouteRift[]
  activeEvent?: EcosystemEventState
  environmentField: EnvironmentField
  boss?: BossState
  collapsePhase: RunPhase
  collapseProgress: number
  migrationDirection?: Vec2
  lifecycle: LifecycleState
}

export type ProtoCellEngine = GameEngine & {
  input: PointerInput
  renderSnapshot(): WorldRenderSnapshot
  applyMutation(result: MutationInstallResult): void
  applyEvolution(build: BuildState): void
  evolutionSnapshot(): { organelles: readonly InstalledOrganelle[]; capacity: number; stability: number }
  morphologySnapshot(): PlayerMorphologySnapshot
  worldSnapshot(): { activeEvent?: EcosystemEventState; environmentField: EnvironmentField; boss?: BossState; selectedRouteId?: string }
  selectMigration(routeId: string): void
  runSnapshot(): RunDirectorState
  ecologySnapshot(): EcologySummary
  advanceForm(): void
}

type PlayerDefinition = EntityDefinition & {
  stability: number
  evolutionThreshold: number
  evolutionThresholdGrowth: number
}

type EngineEnvironment = {
  id: string
  width: number
  height: number
  playerDefinition: PlayerDefinition
  entityDefinitions: EntityDefinition[]
}

const STEP_MS = 1000 / 60
const PLAYER_ID = 'player'
const SWARM_MINIMUM_DURATION_MS = 6000
const SWARM_FUSION_STABLE_MS = 1200
export const CONTACT_DAMAGE_ARM_MS = 420

export class LifecycleInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LifecycleInvariantError'
  }
}

export function createGameEngine(options: {
  seed: number
  environmentId?: string
  originId?: OriginId
  input?: PointerInput
  initialElapsedMs?: number
  modifierIds?: readonly string[]
  route?: readonly string[]
  runOrdinal?: number
  initialLifecycle?: Partial<LifecycleState>
}): ProtoCellEngine {
  const modifiers = applyModifiers(options.modifierIds ?? [], { baseTelegraphLeadMs: 1400 })
  let routeStageIndex = 0
  let environmentId = options.environmentId ?? 'env-clear-drop'
  let environment = getEnvironment(environmentId)
  const originId = options.originId ?? 'origin-primal-cell'
  const origin = content.origins.find((item) => item.id === originId)
  if (!origin) throw new RangeError(`Unknown origin id: ${originId}`)
  const playerDefinition = getPlayerDefinition(originId, environment)

  let region = filteredRegion(generateRegion(options.seed, environmentId), options.route?.[routeStageIndex])
  let scheduleAt = new Map(region.spawnSchedule.map((entry) => [entry.entityId, entry.atMs]))
  let regionById = new Map(region.entities.map((entity) => [entity.id, entity]))
  const scaleTiers = content.scaleTiers as unknown as readonly ScaleTierDefinition[]
  const initialPlayer = createEntity(playerDefinition, {
    id: PLAYER_ID,
    position: { x: environment.width / 2, y: environment.height / 2 },
  })
  let lifecycle = initialLifecycleState(createLifecycle(scaleTiers, initialPlayer.mass), options.initialLifecycle, scaleTiers)
  const player = resizeBodyToRadius(initialPlayer, lifecycle.bodyRadius)
  const entities = new Map<string, EntityState>([[player.id, player]])
  const spawnedIds = new Set<string>()
  const pauseReasons = new Set<PauseReason>()
  const engulfLocks = new Set<string>()
  const damagePeriods = new Map<string, number>()
  const behaviorMemories = new Map<string, BehaviorMemory>()
  const events: GameEvent[] = []
  const grid = new SpatialGrid(96)
  const clock = createFixedClock({ stepMs: STEP_MS, maxSteps: 5 })
  const input = options.input ?? createPointerInput()
  const worldRng = createRng(options.seed).fork('m1-world')
  let elapsedMs = Math.max(0, options.initialElapsedMs ?? 0)
  const journeyEnabled = (options.environmentId ?? 'env-clear-drop') === 'env-clear-drop'
  let runDirectorState = createRunDirector(
    content.journey as JourneyDefinition,
    options.seed,
    options.runOrdinal ?? 0,
    content.firstRunAssist as FirstRunAssistDefinition,
  )
  let ecologyDirectorState = createEcologyDirector(
    ecologyBudget(environmentId),
    options.seed,
    options.runOrdinal ?? 0,
    content.firstRunAssist as FirstRunAssistDefinition,
    elapsedMs,
  )
  let pendingMigrationRouteId: string | undefined
  let interpolationAlpha = 0
  let started = false
  let destroyed = false
  let mutationPending = false
  let formTransitionPending = false
  let evolutionThreshold = playerDefinition.evolutionThreshold
  let playerStability = playerDefinition.stability
  let installedOrganelles: InstalledOrganelle[] = origin.initialOrganelleIds.map((id) => {
    const definition = content.organelles.find((item) => item.id === id)
    if (!definition) throw new RangeError(`Unknown initial organ id: ${id}`)
    return { id: id as OrganelleId, stage: 'installed', anchor: definition.slots[0] as AnchorSlot }
  })
  let buildState = createBuildState({
    traitIds: origin.initialOrganelleIds as OrganelleId[],
    routeCounts: origin.initialOrganelleIds.reduce<BuildState['routeCounts']>((counts, id) => {
      const route = content.organelles.find((organ) => organ.id === id)?.evolutionRoute as keyof BuildState['routeCounts'] | undefined
      if (route) counts[route] += 1
      return counts
    }, { predation: 0, survival: 0, colony: 0 }),
  })
  let organCapacity = modifiers.rules['three-standard-organs'] ? 3 : 6
  const organReadyAt = new Map<string, number>()
  const organEventReadyAt = new Map<string, number>()
  let lastDamageAt = Number.NEGATIVE_INFINITY
  let lastDamageSource: DamageSource | undefined
  let lastPlayerDefeaterDefinitionId: string | undefined
  let sameDirectionMs = 0
  let pursuitMs = 0
  let previousPursuitTargetId: string | undefined
  let previousPursuitDistance = Number.POSITIVE_INFINITY
  const traitReadyAt = new Map<OrganelleId, number>()
  let playerEngulfChain = 0
  let lastPlayerEngulfAt = Number.NEGATIVE_INFINITY
  let previousInputDirection: Vec2 = { x: 0, y: 0 }
  let activeSwarm: SwarmBody[] | undefined
  let swarmStableMs = 0
  let swarmStartedAtMs: number | undefined
  let massSplitArmed = true
  let massSplitRearmMass = 320
  let swarmTransition: WorldRenderSnapshot['swarmTransition']
  let activeEvent: EcosystemEventState | undefined
  let environmentField = createEnvironmentField(environmentId as `env-${string}`, options.seed)
  let eventStarted = false
  const eventSpawnedRequests = new Set<number>()
  let bossState: BossState | undefined
  let bossResolutionEmitted = false
  let lastBossRamAt = Number.NEGATIVE_INFINITY
  let selectedRouteId: string | undefined
  let environmentEnteredAtMs = 0
  let routeEntryGuardUntilMs = 0
  let lastFieldDamageAt = Number.NEGATIVE_INFINITY
  let foodSpawnSequence = 0
  let peakBiomass = player.mass
  let engulfScore = 0
  let terminalReached = false
  let lastLiveMorphology: PlayerMorphologySnapshot = {
    bodyCount: 1,
    totalMass: player.mass,
    radius: player.body.radius,
    stability: playerDefinition.stability,
    organelles: installedOrganelles.map((organ) => ({ ...organ })),
  }

  spawnDue(elapsedMs)
  spawnModifierElite()

  const engine: ProtoCellEngine = {
    input,
    start() {
      if (!destroyed) started = true
    },
    advance(frameElapsedMs) {
      if (!started || destroyed || pauseReasons.size > 0) return
      const result = clock.advance(frameElapsedMs, simulateStep)
      interpolationAlpha = result.alpha
    },
    pause(reason) {
      pauseReasons.add(reason)
      clock.reset()
      input.cancel()
      resetTriggerTracking()
    },
    resume(reason) {
      pauseReasons.delete(reason)
      clock.reset()
    },
    snapshot() {
      const playerBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
      const currentPlayer = entities.get(PLAYER_ID) ?? playerBodies[0] ?? player
      const biomass = lifecycle.totalBiomass
      const membrane = activeSwarm ? playerBodies.reduce((sum, body) => sum + body.membrane, 0) : currentPlayer.membrane
      peakBiomass = Math.max(peakBiomass, biomass)
      return {
        membrane,
        energy: activeSwarm ? playerBodies.reduce((sum, body) => sum + body.energy, 0) : currentPlayer.energy,
        stability: playerStability,
        biomass,
        peakBiomass,
        evolutionThreshold,
        elapsedMs,
        environmentId,
        paused: pauseReasons.size > 0,
        engulfScore,
        journeyIndex: journeyEnabled ? runDirectorState.stageIndex + 1 : Math.min(6, routeStageIndex + 1),
        journeyTotal: (content.journey as JourneyDefinition).stages.length,
        bodyStage: currentBodyStage(),
        playerBuild: createBuildState(buildState),
        bodyStageProgress: clamp(biomass / Math.max(1, evolutionThreshold), 0, 1),
        formId: lifecycle.formId,
        tierIndex: lifecycle.tierIndex,
        tierProgress: lifecycle.evolutionPressure,
        membraneRatio: clamp(membrane / Math.max(1, playerDefinition.membrane), 0, 1),
        swarm: activeSwarm ? {
          bodyCount: playerBodies.length,
          minimumRemainingMs: Math.max(0, (swarmStartedAtMs ?? elapsedMs) + SWARM_MINIMUM_DURATION_MS - elapsedMs),
          fusionProgress: clamp(swarmStableMs / SWARM_FUSION_STABLE_MS, 0, 1),
        } : undefined,
      }
    },
    drainEvents() {
      return events.splice(0, events.length)
    },
    renderSnapshot() {
      assertFinitePlayerState(entities, activeSwarm?.map((body) => body.id) ?? [PLAYER_ID])
      const routeRifts = activeRouteRifts()
      const collapseProgress = currentCollapseProgress()
      const playerBody = entities.get(PLAYER_ID)
      const targetRift = routeRifts[0]
      return {
        elapsedMs,
        interpolationAlpha,
        environmentId,
        width: environment.width,
        height: environment.height,
        playerId: PLAYER_ID,
        bodyStage: currentBodyStage(),
        entities: [...entities.values()].filter((entity) => entity.status === 'active'),
        playerOrganelleIdsByEntity: activeSwarm
          ? Object.fromEntries(activeSwarm.map((body) => [body.id, body.organelles.map((organ) => organ.id)]))
          : { [PLAYER_ID]: installedOrganelles.map((organ) => organ.id) },
        playerStability,
        playerSynergyIds: content.synergies.filter((synergy) => synergy.requires.every((id) => installedOrganelles.some((organ) => organ.id === id))).map((synergy) => synergy.id),
        playerDamage: lastDamageSource && elapsedMs - lastDamageAt <= 560 ? { source: lastDamageSource, untilMs: lastDamageAt + 560 } : undefined,
        swarmTransition: swarmTransition && elapsedMs - swarmTransition.startedAtMs <= 900 ? swarmTransition : undefined,
        routeRifts,
        activeEvent,
        environmentField,
        boss: bossState,
        collapsePhase: runDirectorState.phase,
        collapseProgress,
        migrationDirection: playerBody && targetRift && runDirectorState.phase !== 'active'
          ? normalizedDirection(playerBody.position, targetRift.position)
          : undefined,
        lifecycle: { ...lifecycle },
      }
    },
    applyMutation(result) {
      playerStability = result.stability
      installedOrganelles = [...result.organelles]
      buildState = createBuildState({
        ...buildState,
        traitIds: result.organelles.map((organ) => organ.id),
        stability: result.stability,
      })
      if (activeSwarm) {
        activeSwarm = activeSwarm.map((body, bodyIndex) => ({
          ...body,
          stability: result.stability,
          organelles: result.organelles.filter((_, organIndex) => organIndex % activeSwarm!.length === bodyIndex),
        }))
      }
      organCapacity = result.capacity
      evolutionThreshold = Math.ceil(evolutionThreshold * playerDefinition.evolutionThresholdGrowth)
      mutationPending = false
      captureLiveMorphology()
    },
    applyEvolution(build) {
      buildState = createBuildState(build)
      playerStability = buildState.stability
      const occupied = new Set<AnchorSlot>()
      installedOrganelles = buildState.traitIds.map((id) => {
        const existing = installedOrganelles.find((organ) => organ.id === id)
        if (existing) {
          occupied.add(existing.anchor)
          return existing
        }
        const definition = content.organelles.find((organ) => organ.id === id)
        if (!definition) throw new RangeError(`Unknown evolution trait: ${id}`)
        const anchor = (definition.slots.find((slot) => !occupied.has(slot as AnchorSlot)) ?? definition.slots[0]) as AnchorSlot
        occupied.add(anchor)
        return { id, stage: 'installed', anchor }
      })
      evolutionThreshold = Math.ceil(evolutionThreshold * playerDefinition.evolutionThresholdGrowth)
      mutationPending = false
      resetTriggerTracking()
      captureLiveMorphology()
    },
    evolutionSnapshot() {
      return {
        organelles: installedOrganelles,
        capacity: organCapacity,
        stability: playerStability,
      }
    },
    morphologySnapshot() {
      return {
        ...lastLiveMorphology,
        organelles: lastLiveMorphology.organelles.map((organ) => ({ ...organ })),
      }
    },
    worldSnapshot() {
      return { activeEvent, environmentField, boss: bossState, selectedRouteId }
    },
    selectMigration(routeId) {
      if (runDirectorState.phase !== 'choosing' && runDirectorState.phase !== 'collapsing') return
      if (!runDirectorState.offeredRoutes.some((route) => route.id === routeId)) return
      pendingMigrationRouteId = routeId
    },
    runSnapshot() {
      return { ...runDirectorState, offeredRoutes: runDirectorState.offeredRoutes.map((route) => ({ ...route })) }
    },
    ecologySnapshot() {
      return {
        ...ecologyDirectorState.summary,
        population: { ...ecologyDirectorState.summary.population },
        opportunityHistory: [...ecologyDirectorState.summary.opportunityHistory],
      }
    },
    advanceForm() {
      if (!formTransitionPending) throw new RangeError('No form transition is pending')
      const fromFormId = lifecycle.formId
      lifecycle = advanceLifecycle(lifecycle, scaleTiers)
      formTransitionPending = false
      resizeActivePlayerBodies()
      events.push({
        type: 'form-transitioned',
        fromFormId,
        toFormId: lifecycle.formId,
        atMs: elapsedMs,
      })
      captureLiveMorphology()
    },
    destroy() {
      destroyed = true
      started = false
      pauseReasons.clear()
      entities.clear()
      behaviorMemories.clear()
      events.length = 0
      clock.reset()
      input.cancel()
      resetTriggerTracking()
    },
  }

  return engine

  function simulateStep(stepMs: number) {
    if (terminalReached) return
    elapsedMs += stepMs
    stepJourney()
    if (terminalReached) {
      activeSwarm = undefined
      return
    }
    stepWorldFeatures(stepMs)
    if (terminalReached) {
      activeSwarm = undefined
      return
    }
    spawnDue(elapsedMs)
    stepEcology()
    rebuildGrid()
    const passive = stepEvolution(stepMs)
    moveEntities(stepMs, passive.speedMultiplier)
    stepFusion(stepMs)
    stepRouteRiftsAndBoss(stepMs)
    if (terminalReached) {
      captureLiveMorphology()
      return
    }
    rebuildGrid()
    resolveNearbyInteractions()
    if (terminalReached) {
      captureLiveMorphology()
      return
    }
    syncActiveSwarm(true)
    pruneInactiveEntities()
    captureLiveMorphology()

    const playerMass = [...entities.values()]
      .filter((entity) => entity.faction === 'player' && entity.status === 'active')
      .reduce((sum, entity) => sum + entity.mass, 0)
    const firstEvolutionDeadlineReached = buildState.evolutionCount === 0 && elapsedMs >= content.m1.firstEvolutionAtMs
    if (playerMass > 0 && !mutationPending && (playerMass >= evolutionThreshold || firstEvolutionDeadlineReached)) {
      events.push({ type: 'mutation-ready', entityId: PLAYER_ID, atMs: elapsedMs })
      mutationPending = true
    }
    emitFormTransitionReady()
  }

  function emitFormTransitionReady() {
    if (formTransitionPending || !canAdvanceLifecycle(lifecycle, scaleTiers)) return
    const nextTier = scaleTiers[lifecycle.tierIndex + 1]
    if (!nextTier) return
    formTransitionPending = true
    events.push({
      type: 'form-transition-ready',
      fromFormId: lifecycle.formId,
      toFormId: nextTier.formId,
      atMs: elapsedMs,
    })
  }

  function stepJourney() {
    if (!journeyEnabled) return
    const previousPhase = runDirectorState.phase
    const result = stepRunDirector(runDirectorState, {
      atMs: elapsedMs,
      selectedRouteId: pendingMigrationRouteId,
    })
    pendingMigrationRouteId = undefined
    runDirectorState = result.state
    events.push(...result.events)
    if (previousPhase !== 'complete' && runDirectorState.phase === 'complete') {
      const survivingBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
      if (survivingBodies.length > 1) {
        events.push({ type: 'ending-reached', endingId: 'ending-swarm-mind', atMs: elapsedMs })
      } else if (playerStability >= 70) {
        events.push({ type: 'ending-reached', endingId: 'ending-stable-species', atMs: elapsedMs })
      } else {
        events.push({ type: 'player-died', cause: 'finale-instability', atMs: elapsedMs })
      }
      terminalReached = true
      return
    }
    const route = result.events.find((event): event is Extract<GameEvent, { type: 'route-selected' }> => event.type === 'route-selected')
    if (!route) return
    selectedRouteId = route.routeId
    enterEnvironment(route.environmentId)
  }

  function stepWorldFeatures(_stepMs: number) {
    environmentField = stepEnvironmentField(environmentField, elapsedMs)
    const launchEnvironment = content.environments.find((item) => item.id === environmentId)
    const availableEventIds = launchEnvironment?.eventIds.filter((eventId) => (
      content.events.some((event) => event.id === eventId && event.environmentIds.includes(environmentId as `env-${string}`))
    )) ?? []
    const scheduledEventId = availableEventIds[Math.abs(options.seed) % Math.max(1, availableEventIds.length)]
    const scheduledEvent = environmentId === 'env-clear-drop'
      ? { ...content.m1.eventSchedule[0], atMs: environmentEnteredAtMs + content.m1.eventSchedule[0].atMs }
      : scheduledEventId ? { eventId: scheduledEventId, atMs: environmentEnteredAtMs + 60_000 } : undefined
    if (!eventStarted && scheduledEvent && elapsedMs >= scheduledEvent.atMs) {
      activeEvent = startEvent(scheduledEvent.eventId as EventId, {
        seed: options.seed,
        environmentId: environmentId as `env-${string}`,
        atMs: scheduledEvent.atMs,
        center: {
          x: environment.width * (0.35 + worldRng.next() * 0.3),
          y: environment.height * (0.32 + worldRng.next() * 0.25),
        },
      })
      eventStarted = true
      events.push({ type: 'event-phase', eventId: activeEvent.id, phase: activeEvent.phase, atMs: elapsedMs })
    }
    if (activeEvent) {
      const previousPhase = activeEvent.phase
      activeEvent = stepEvent(activeEvent, elapsedMs)
      if (activeEvent.phase !== previousPhase) {
        events.push({ type: 'event-phase', eventId: activeEvent.id, phase: activeEvent.phase, atMs: elapsedMs })
      }
      activeEvent.spawnRequests.forEach((request, index) => {
        if (request.atMs <= elapsedMs && !eventSpawnedRequests.has(index)) {
          spawnEventEntities(request, index)
          eventSpawnedRequests.add(index)
        }
      })
    }
    environmentField = applyEventWorldEffects(environmentField, activeEvent, elapsedMs)
    if (modifiers.rules['persistent-turbidity']) environmentField = { ...environmentField, visibility: environmentField.visibility * 0.68 }
    if (modifiers.rules['progressive-acid-coverage'] && environmentId === 'env-acid-vesicle') {
      const environmentOrder = content.environments.find((item) => item.id === environmentId)?.order ?? routeStageIndex
      environmentField = { ...environmentField, safeRadius: Math.max(48, 92 - environmentOrder * 12) }
    }
    applyEnvironmentDamage()
    const bossDefinition = content.bosses.find((item) => item.id === launchEnvironment?.bossId)
    const bossSpawnAtMs = runDirectorState.phase === 'finale'
      ? environmentEnteredAtMs + 45_000
      : environmentEnteredAtMs + Math.max(30_000, ((launchEnvironment?.durationTargetSec[0] ?? 120) - 25) * 1000)
    if (!bossState && bossDefinition && elapsedMs >= bossSpawnAtMs) {
      const definition = bossDefinition
      bossState = createBoss(definition.id as BossId, { seed: options.seed, atMs: bossSpawnAtMs })
      const boss = createEntity(definition.entity as EntityDefinition, {
        id: definition.id,
        position: { x: environment.width / 2, y: 150 },
        spawnedAtMs: elapsedMs,
      })
      entities.set(boss.id, boss)
    }
  }

  function spawnEventEntities(request: EcosystemEventState['spawnRequests'][number], requestIndex: number) {
    const wantedRole = request.role === 'resource' ? 'nutrient' : 'predator'
    const definition = environment.entityDefinitions.find((item) => item.role === wantedRole)
    if (!definition) return
    for (let index = 0; index < request.count; index += 1) {
      const angle = worldRng.next() * Math.PI * 2
      const distance = Math.sqrt(worldRng.next()) * request.radius
      const position = {
        x: clamp(request.center.x + Math.cos(angle) * distance, definition.radius, environment.width - definition.radius),
        y: clamp(request.center.y + Math.sin(angle) * distance, definition.radius, environment.height - definition.radius),
      }
      const id = `${activeEvent?.id ?? 'event'}-${requestIndex}-${index}`
      const spawned = createEntity(definition, { id, position, spawnedAtMs: elapsedMs })
      entities.set(id, prepareSpawn(spawned, entities.get(PLAYER_ID), elapsedMs))
    }
  }

  function stepRouteRiftsAndBoss(stepMs: number) {
    const playerBody = entities.get(PLAYER_ID)
    const bossAllowsExit = !bossState || bossState.phase === 'resolved'
    if (bossAllowsExit && elapsedMs >= routeEntryGuardUntilMs && playerBody?.status === 'active') {
      const entered = findEnteredRouteRift(activeRouteRifts(), {
        position: playerBody.position,
        radius: playerBody.body.radius,
      }, elapsedMs)
      if (entered) {
        if (journeyEnabled) {
          const offered = runDirectorState.offeredRoutes.find((route) => (
            route.id === entered.id || route.destinationEnvironmentId === entered.destinationEnvironmentId
          ))
          if (offered) {
            pendingMigrationRouteId = offered.id
            stepJourney()
          }
        } else {
          selectedRouteId = entered.id
          events.push({ type: 'route-selected', routeId: entered.id, environmentId: entered.destinationEnvironmentId, atMs: elapsedMs })
          enterEnvironment(entered.destinationEnvironmentId)
        }
        return
      }
    }
    if (!bossState) return
    if (bossState.phase === 'resolved') {
      emitBossResolution()
      return
    }
    const bossEntity = entities.get(bossState.id)
    if (!bossEntity || playerBody?.status !== 'active') {
      bossState = stepBoss(bossState, { atMs: elapsedMs })
      return
    }
    const distance = Math.hypot(playerBody.position.x - bossEntity.position.x, playerBody.position.y - bossEntity.position.y)
    const territoryCrossed = distance <= 170
    const playerEscaped = bossState.territoryCrossed && distance >= 230
    const lockDelta = distance <= 115 ? stepMs / 7000 : -stepMs / 9000
    const definition = content.bosses.find((item) => item.id === bossState?.id)
    const validationRift = region.routeRifts.find((rift) => (
      elapsedMs >= rift.opensAtMs
      && definition?.rules.environmentHazardIds.includes(rift.hazardId)
      && Math.hypot(bossEntity.position.x - rift.position.x, bossEntity.position.y - rift.position.y) <= bossEntity.body.radius + rift.radius
    ))
    const fieldSample = sampleEnvironmentField(environmentField, bossEntity.position, bossEntity.body.radius)
    const fieldHazardId = fieldSample.hazardId && definition?.rules.environmentHazardIds.includes(fieldSample.hazardId)
      ? fieldSample.hazardId
      : undefined
    const parasiteBody = [...entities.values()].find((body) => (
      body.faction === 'player'
      && body.status === 'active'
      && evolvedPlayer(body).installedOrganelles.some((organ) => organ.id === 'organelle-needle-mouth')
      && Math.hypot(body.position.x - bossEntity.position.x, body.position.y - bossEntity.position.y) <= body.body.radius + bossEntity.body.radius + 8
    ))
    const parasiteReady = Boolean(parasiteBody) && bossState.outerMembrane === 0
    bossState = stepBoss(bossState, {
      atMs: elapsedMs,
      hazardId: validationRift?.hazardId ?? fieldHazardId,
      hazardOverlapMs: (validationRift || fieldHazardId) && bossState.phase !== 'dormant' ? stepMs : 0,
      parasiteAttachedMs: parasiteReady ? bossState.parasiteAttachedMs + stepMs : 0,
      territoryCrossed,
      playerEscaped,
      lockRatio: clamp(bossState.lockRatio + lockDelta, 0, 1),
    })
    emitBossResolution()
  }

  function emitBossResolution() {
    if (bossState?.phase !== 'resolved' || !bossState.resolutionCandidate) return
    const bossEntity = entities.get(bossState.id)
    if (bossEntity?.status === 'active') {
      entities.set(bossEntity.id, neutralizeResolvedBoss(bossEntity, bossState))
    }
    if (!bossResolutionEmitted) {
      events.push({ type: 'boss-resolved', bossId: bossState.id, path: bossState.resolutionCandidate, atMs: elapsedMs })
      const definition = content.bosses.find((item) => item.id === bossState?.id)
      const terminalEvent = bossTerminalEvent(definition?.rewardIds ?? [], playerStability, elapsedMs, {
        path: bossState.resolutionCandidate,
        bodyCount: activeSwarm?.filter((body) => body.status === 'active').length ?? 1,
      })
      if (terminalEvent) {
        if (terminalEvent.type === 'player-died') {
          terminatePlayerEntities(entities)
          activeSwarm = undefined
        }
        events.push(terminalEvent)
        terminalReached = true
      }
      bossResolutionEmitted = true
    }
  }

  function spawnDue(atMs: number) {
    const playerBody = [...entities.values()].find((entity) => entity.faction === 'player' && entity.status === 'active')
    const activeByRole = new Map<string, number>()
    for (const entity of entities.values()) {
      if (entity.faction === 'player' || entity.status !== 'active') continue
      activeByRole.set(entity.role, (activeByRole.get(entity.role) ?? 0) + 1)
    }
    for (const [entityId, scheduledAt] of scheduleAt) {
      if (scheduledAt > atMs || spawnedIds.has(entityId)) continue
      const entity = regionById.get(entityId)
      if (!entity || !playerBody) continue
      const roleCount = activeByRole.get(entity.role) ?? 0
      if (roleCount >= spawnCapForRole(entity.role)) continue
      if (distanceBetween(entity, playerBody) > 420) continue
      entities.set(entityId, prepareSpawn({ ...entity, spawnedAtMs: atMs }, playerBody, atMs))
      spawnedIds.add(entityId)
      activeByRole.set(entity.role, roleCount + 1)
    }
  }

  function pruneInactiveEntities() {
    for (const [id, entity] of entities) {
      if (entity.faction !== 'player' && entity.status !== 'active') {
        entities.delete(id)
        behaviorMemories.delete(id)
      }
    }
  }

  function stepEcology() {
    const playerBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
    const playerBody = playerBodies[0]
    if (!playerBody) return
    const nearbyEdibleCount = [...entities.values()].filter((entity) => (
      entity.status === 'active'
      && !isMaterializing(entity, elapsedMs)
      && (entity.role === 'nutrient' || entity.role === 'prey')
      && entity.body.radius < playerBody.body.radius
      && distanceBetween(entity, playerBody) <= 160
    )).length
    const visibleEntities = [...entities.values()].flatMap((entity) => {
      const role = entity.ecologyGroupId ? ecologyRoleFor(entity) : undefined
      return role ? [{
        id: entity.id,
        role,
        distance: distanceBetween(entity, playerBody),
        biomass: entity.mass,
        isBoss: entity.role === 'boss',
      }] : []
    })
    const result = stepEcologyDirector(ecologyDirectorState, {
      atMs: elapsedMs,
      playerPosition: playerBody.position,
      viewportRadius: 320,
      nearbyEdibleCount,
      visibleEntities,
    })
    ecologyDirectorState = result.state
    const retiring = result.commands.filter((command) => command.type === 'dematerialize-group')
    const arriving = result.commands.filter((command) => command.type !== 'dematerialize-group')
    for (const command of retiring) applyEcologyCommand(command, playerBody)
    for (const command of arriving) applyEcologyCommand(command, playerBody)
  }

  function applyEcologyCommand(command: EcologyCommand, playerBody: EntityState) {
    if (command.type === 'start-opportunity') {
      events.push({ type: 'ecology-opportunity', opportunityId: command.opportunityId, environmentId, atMs: command.atMs })
      return
    }
    if (command.type === 'dematerialize-group') {
      for (const id of command.entityIds) {
        entities.delete(id)
        behaviorMemories.delete(id)
      }
      return
    }
    if (command.type !== 'materialize-group') return

    const activeNonPlayers = [...entities.values()].filter((entity) => entity.faction !== 'player' && entity.status === 'active').length
    const count = Math.min(command.count, Math.max(0, 58 - activeNonPlayers))
    const definition = ecologyDefinition(command.role)
    if (!definition || count === 0) return
    const positions = ecologyGroupPositions({
      seed: options.seed,
      groupId: `${environmentId}-${command.groupId}`,
      center: playerBody.position,
      distance: command.distance,
      angle: command.angle,
      count,
      width: environment.width,
      height: environment.height,
      margin: definition.radius + 8,
    })
    positions.forEach((position) => {
      const food = command.role === 'resource' || command.role === 'prey'
      const id = `${food ? 'eco-food' : `eco-${command.role}`}-${environmentId}-${foodSpawnSequence}`
      foodSpawnSequence += 1
      entities.set(id, prepareSpawn({
        ...createEntity(definition, { id, position, spawnedAtMs: elapsedMs }),
        ecologyGroupId: command.groupId,
      }, playerBody, elapsedMs))
    })
  }

  function ecologyDefinition(role: EcologyRole): EntityDefinition | undefined {
    const matching = environment.entityDefinitions.filter((definition) => {
      if (!definition.behaviorProfileId) return role === 'resource' && definition.role === 'nutrient'
      const family = getBehaviorProfile(definition.behaviorProfileId).family
      if (role === 'resource') return family === 'resource'
      if (role === 'prey') return family === 'skittish'
      if (role === 'competitor') return family === 'school' || family === 'competitor'
      if (role === 'scavenger') return family === 'scavenger'
      if (role === 'hunter') return family === 'hunter' || family === 'ambusher'
      return family === 'apex'
    })
    return matching[foodSpawnSequence % Math.max(1, matching.length)]
  }

  function ecologyRoleFor(entity: EntityState): EcologyRole | undefined {
    if (!entity.behaviorProfileId) return undefined
    const family = getBehaviorProfile(entity.behaviorProfileId).family
    if (family === 'resource') return 'resource'
    if (family === 'skittish') return 'prey'
    if (family === 'school' || family === 'competitor') return 'competitor'
    if (family === 'scavenger') return 'scavenger'
    if (family === 'hunter' || family === 'ambusher') return 'hunter'
    if (family === 'apex') return 'apex'
    return undefined
  }

  function rebuildGrid() {
    grid.clear()
    for (const entity of entities.values()) {
      if (entity.status === 'active') grid.insert(entity)
    }
  }

  function moveEntities(stepMs: number, speedMultiplier: number) {
    const seconds = stepMs / 1000
    if (activeSwarm) moveActiveSwarm(stepMs, speedMultiplier)
    const playerBodies = [...entities.values()]
      .filter((entity) => entity.faction === 'player' && entity.status === 'active')
    const playerRadii = playerBodies.map((entity) => entity.body.radius)
    for (const entity of entities.values()) {
      if (entity.status !== 'active') continue
      if (activeSwarm && entity.faction === 'player') continue
      if (isMaterializing(entity, elapsedMs)) {
        if (entity.velocity.x !== 0 || entity.velocity.y !== 0) entities.set(entity.id, moveEntity(entity, entity.position, { x: 0, y: 0 }))
        continue
      }
      const nearestPlayer = playerBodies.reduce<EntityState | undefined>((nearest, body) => (
        !nearest || distanceBetween(entity, body) < distanceBetween(entity, nearest) ? body : nearest
      ), undefined)
      const arrival = stepThreatArrival(entity, nearestPlayer?.position, elapsedMs, content.m1.spawnPresentation)
      if (arrival?.stationary) {
        entities.set(entity.id, moveEntity(arrival.entity, entity.position, { x: 0, y: 0 }))
        continue
      }
      const enteringEntity = arrival?.entity ?? entity
      const bossDormant = enteringEntity.id === bossState?.id && bossState.phase === 'dormant'
      const movement = arrival?.intent
        ? { entity: enteringEntity, intent: arrival.intent }
        : movementDecision(enteringEntity, bossDormant)
      const intent = movement.intent
      const movingEntity = movement.entity
      const bossPhaseSpeed = entity.id !== bossState?.id ? 1
        : bossState.phase === 'feeding' ? 0.58
          : bossState.phase === 'exposed' ? 0.86
            : bossState.phase === 'enraged' ? 1.35
              : 1
      const pursuitSpeed = entity.faction === 'hostile' && ['ambush', 'charge', 'pursue'].includes(movingEntity.behaviorState ?? '')
        ? currentThreatProfile().pursuitSpeedMultiplier
        : 1
      const turnResponseMs = pursuitSpeed > 1 && entity.behaviorProfileId
        ? getBehaviorProfile(entity.behaviorProfileId).turnResponseMs
        : undefined
      const fieldSample = sampleEnvironmentField(environmentField, entity.position, entity.body.radius)
      const maxSpeed = ('maxSpeed' in entity ? Number(entity.maxSpeed) : 52)
        * (entity.id === PLAYER_ID ? speedMultiplier : bossPhaseSpeed)
        * pursuitSpeed
        * (arrival?.speedRatio ?? 1)
        * fieldSample.speedMultiplier
      const responsiveVelocity = advanceVelocity(entity.velocity, intent, maxSpeed, stepMs, { responseMs: turnResponseMs })
      const flowVelocity = arrival?.intent ? { x: 0, y: 0 } : {
        x: fieldSample.flow.x * 24,
        y: fieldSample.flow.y * 24,
      }
      const velocity = {
        x: responsiveVelocity.x + flowVelocity.x,
        y: responsiveVelocity.y + flowVelocity.y,
      }
      const desiredPosition = {
        x: entity.position.x + velocity.x * seconds,
        y: entity.position.y + velocity.y * seconds,
      }
      const margin = entity.faction === 'player'
        ? entity.body.radius
        : engulfAccessMargin(entity.body.radius, playerRadii)
      const safeInset = collapseSafeInset()
      const constrainedLocal = applySoftBoundary({
        x: desiredPosition.x - safeInset,
        y: desiredPosition.y - safeInset,
      }, velocity, {
        width: environment.width - safeInset * 2,
        height: environment.height - safeInset * 2,
        softZone: 72,
      }, margin)
      const constrained = {
        position: { x: constrainedLocal.position.x + safeInset, y: constrainedLocal.position.y + safeInset },
        velocity: constrainedLocal.velocity,
      }
      const position = resolveEnvironmentMovement(environmentField, entity.position, constrained.position, entity.body.radius)
      entities.set(entity.id, moveEntity(movingEntity, position, {
        x: constrained.velocity.x - flowVelocity.x,
        y: constrained.velocity.y - flowVelocity.y,
      }))
    }
  }

  function movementDecision(entity: EntityState, bossDormant: boolean): { entity: EntityState; intent: MovementIntent } {
    if (bossDormant) return { entity, intent: { direction: { x: 0, y: 0 }, strength: 0 } }
    if (entity.id === PLAYER_ID) return { entity, intent: input.snapshot() }

    const attractionFields = activeEvent?.phase === 'active' ? activeEvent.aiSignals.map((signal) => ({
      center: signal.center,
      radius: signal.radius,
      strength: signal.strength,
      flow: signal.flow,
    })) : []
    if (entity.behaviorProfileId) {
      const profile = getBehaviorProfile(entity.behaviorProfileId)
      const perceptionRadius = profile.perceptionRadius * (modifiers.rules['longer-predator-perception'] && entity.faction === 'hostile' ? 1.4 : 1)
      const behavior = decideBehavior(
        entity,
        behaviorMemories.get(entity.id) ?? { state: 'idle', stateStartedAtMs: elapsedMs },
        {
          atMs: elapsedMs,
          nearby: grid.query({
            x: entity.position.x - perceptionRadius,
            y: entity.position.y - perceptionRadius,
            width: perceptionRadius * 2,
            height: perceptionRadius * 2,
          }),
          profile,
          attractionFields,
        },
      )
      behaviorMemories.set(entity.id, behavior.memory)
      return {
        entity: { ...entity, behaviorState: behavior.decision.presentationState },
        intent: behavior.decision.movement,
      }
    }

    return {
      entity,
      intent: decideIntent(entity, {
        nearby: grid.query({
          x: entity.position.x - 240,
          y: entity.position.y - 240,
          width: 480,
          height: 480,
        }),
        attractionFields,
      }),
    }
  }

  function applyEnvironmentDamage() {
    if (elapsedMs - lastFieldDamageAt < 900) return
    const playerBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
    const threatened = playerBodies.filter((entity) => sampleEnvironmentField(environmentField, entity.position, entity.body.radius).damage > 0)
    if (threatened.length === 0) return
    lastFieldDamageAt = elapsedMs
    for (const entity of threatened) {
      const sample = sampleEnvironmentField(environmentField, entity.position, entity.body.radius)
      const damage = sample.damage
      const nextMembrane = Math.max(0, entity.membrane - damage)
      entities.set(entity.id, { ...entity, membrane: nextMembrane, status: nextMembrane === 0 ? 'ruptured' : entity.status })
      events.push({
        type: 'damaged',
        targetId: entity.id,
        amount: damage,
        source: environmentId === 'env-antibody-storm' ? 'electric' : 'acid',
        atMs: elapsedMs,
      })
      lastDamageAt = elapsedMs
      lastDamageSource = environmentId === 'env-antibody-storm' ? 'electric' : 'acid'
    }
    if ([...entities.values()].every((entity) => entity.faction !== 'player' || entity.status !== 'active')) {
      events.push({ type: 'player-died', cause: 'environmental-rupture', atMs: elapsedMs })
      activeSwarm = undefined
      terminalReached = true
    }
  }

  function enterEnvironment(destinationEnvironmentId: string) {
    environmentId = destinationEnvironmentId
    environment = getEnvironment(environmentId)
    environmentEnteredAtMs = elapsedMs
    routeStageIndex = journeyEnabled ? runDirectorState.stageIndex : routeStageIndex + 1
    routeEntryGuardUntilMs = elapsedMs + 1000
    region = offsetGeneratedRegion(filteredRegion(generateRegion(options.seed, environmentId), options.route?.[routeStageIndex]), environmentEnteredAtMs)
    scheduleAt = new Map(region.spawnSchedule.map((entry) => [entry.entityId, entry.atMs]))
    regionById = new Map(region.entities.map((entity) => [entity.id, entity]))
    spawnedIds.clear()
    engulfLocks.clear()
    damagePeriods.clear()
    activeEvent = undefined
    eventStarted = false
    eventSpawnedRequests.clear()
    bossState = undefined
    bossResolutionEmitted = false
    lastBossRamAt = Number.NEGATIVE_INFINITY
    lastFieldDamageAt = Number.NEGATIVE_INFINITY
    ecologyDirectorState = createEcologyDirector(
      ecologyBudget(environmentId),
      options.seed,
      options.runOrdinal ?? 0,
      content.firstRunAssist as FirstRunAssistDefinition,
      elapsedMs,
    )
    lastPlayerDefeaterDefinitionId = undefined
    lastDamageSource = undefined
    resetTriggerTracking()
    environmentField = createEnvironmentField(environmentId as `env-${string}`, options.seed, elapsedMs)
    const playerBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
    for (const [index, body] of playerBodies.entries()) {
      const angle = playerBodies.length === 1 ? 0 : index / playerBodies.length * Math.PI * 2
      const position = {
        x: environment.width / 2 + Math.cos(angle) * 24,
        y: environment.height - 100 + Math.sin(angle) * 24,
      }
      entities.set(body.id, moveEntity(body, position, { x: 0, y: -8 }))
    }
    syncActiveSwarm(false)
    for (const [id, entity] of entities) {
      if (entity.faction !== 'player') {
        entities.delete(id)
        behaviorMemories.delete(id)
      }
    }
    spawnDue(elapsedMs)
    spawnStageEntryEcology(playerBodies[0] ? entities.get(playerBodies[0].id) : undefined)
    spawnModifierElite()
  }

  function spawnStageEntryEcology(playerBody: EntityState | undefined) {
    if (!playerBody) return
    const entry = content.m1.stageEntryEcology.find((profile) => profile.stageIndex === routeStageIndex + 1)
    if (!entry) return
    const centerAngle = Math.atan2(environment.height / 2 - playerBody.position.y, environment.width / 2 - playerBody.position.x)
    const angleJitter = (createRng(options.seed).fork(`${environmentId}-entry-${routeStageIndex}`).next() - 0.5) * 0.24
    entry.groups.forEach((group, index) => {
      applyEcologyCommand({
        type: 'materialize-group',
        groupId: `entry-${environmentId}-${routeStageIndex}-${index}`,
        role: group.role as EcologyRole,
        count: group.count,
        distance: group.distance,
        angle: centerAngle + angleJitter + (index - (entry.groups.length - 1) / 2) * 0.52,
      }, playerBody)
    })
  }

  function activeRouteRifts(): readonly RouteRift[] {
    if (!journeyEnabled || runDirectorState.phase === 'active' || runDirectorState.phase === 'finale' || runDirectorState.phase === 'complete') {
      return region.routeRifts
    }
    const stage = (content.journey as JourneyDefinition).stages[runDirectorState.stageIndex]
    if (!stage) return []
    return runDirectorState.offeredRoutes.map((route, index, all) => ({
      id: route.id,
      destinationEnvironmentId: route.destinationEnvironmentId,
      position: {
        x: all.length === 1 ? environment.width / 2 : environment.width * (index === 0 ? 0.26 : 0.74),
        y: Math.max(86, environment.height * 0.18),
      },
      radius: 30,
      opensAtMs: runDirectorState.stageStartedAtMs + stage.durationMs,
      hazardId: route.riskId,
      resourceId: route.rewardId,
      affinityIconId: route.entryModifierId,
    }))
  }

  function currentBodyStage(): BodyStage {
    if (buildState.evolutionCount > 0 || buildState.bodyStage !== 'microbe') return buildState.bodyStage
    if (!journeyEnabled) return provisionalBodyStage(routeStageIndex)
    return 'microbe'
  }

  function currentCollapseProgress(): number {
    if (!journeyEnabled || (runDirectorState.phase !== 'choosing' && runDirectorState.phase !== 'collapsing')) return 0
    const stage = (content.journey as JourneyDefinition).stages[runDirectorState.stageIndex]
    if (!stage) return 0
    const collapseAge = elapsedMs - runDirectorState.stageStartedAtMs - stage.durationMs
    return clamp(collapseAge / stage.collapseDurationMs, 0, 1)
  }

  function collapseSafeInset(): number {
    const progress = currentCollapseProgress()
    if (progress < 0.75) return 0
    return Math.min(environment.width, environment.height) * 0.18 * ((progress - 0.75) / 0.25)
  }

  function stepEvolution(stepMs: number): { speedMultiplier: number; blockedAmount: number; splitTriggered: boolean } {
    const playerBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
    if (playerBodies.length === 0 || installedOrganelles.length === 0) {
      return { speedMultiplier: 1, blockedAmount: 0, splitTriggered: false }
    }

    const intent = input.snapshot()
    const directionDot = intent.direction.x * previousInputDirection.x + intent.direction.y * previousInputDirection.y
    sameDirectionMs = intent.strength >= 0.7 && directionDot >= 0.94 ? sameDirectionMs + stepMs : 0
    previousInputDirection = { ...intent.direction }

    const aggregate = { speedMultiplier: 1, blockedAmount: 0, splitTriggered: false }
    const triggered = applyTriggerOutcomes(playerBodies[0], evaluateTriggers(buildState, movementTriggerFrame(playerBodies[0], stepMs)))
    aggregate.speedMultiplier = Math.max(aggregate.speedMultiplier, triggered.speedMultiplier)
    aggregate.splitTriggered ||= triggered.splitTriggered
    for (const playerBody of playerBodies) {
      const effects = evaluatePassiveOrgans(evolvedPlayer(playerBody), perceptionFor(playerBody, {
        sameDirectionMs,
        collisionStrength: 0,
        incomingDamage: 0,
      }))
      const applied = applyOrganEffects(effects)
      aggregate.speedMultiplier = Math.max(aggregate.speedMultiplier, applied.speedMultiplier)
      aggregate.blockedAmount += applied.blockedAmount
      aggregate.splitTriggered ||= applied.splitTriggered
    }
    syncActiveSwarm(false)
    return aggregate
  }

  function movementTriggerFrame(currentPlayer: EntityState, stepMs: number): TriggerFrame {
    const edible = [...entities.values()]
      .filter((entity) => entity.faction !== 'player' && entity.status === 'active' && entity.body.radius < currentPlayer.body.radius)
      .map((entity) => ({ entity, distance: distanceBetween(entity, currentPlayer) }))
      .sort((left, right) => left.distance - right.distance)[0]
    const closingSpeed = edible && edible.entity.id === previousPursuitTargetId
      ? Math.max(0, (previousPursuitDistance - edible.distance) / Math.max(STEP_MS / 1000, stepMs / 1000))
      : 0
    pursuitMs = edible && edible.entity.id === previousPursuitTargetId && closingSpeed > 2 && input.snapshot().strength >= 0.45
      ? pursuitMs + stepMs
      : 0
    previousPursuitTargetId = edible?.entity.id
    previousPursuitDistance = edible?.distance ?? Number.POSITIVE_INFINITY
    const nearMiss = [...entities.values()]
      .filter((entity) => entity.faction === 'hostile' && entity.status === 'active')
      .map((threat) => ({ threat, clearance: distanceBetween(threat, currentPlayer) - threat.body.radius - currentPlayer.body.radius }))
      .filter((sample) => sample.clearance >= 0 && sample.clearance <= 6)
      .sort((left, right) => left.clearance - right.clearance)[0]
    const field = sampleEnvironmentField(environmentField, currentPlayer.position, currentPlayer.body.radius)
    const flowStrength = Math.hypot(field.flow.x, field.flow.y)
    const intent = input.snapshot()
    const alignment = flowStrength > 0 && intent.strength > 0
      ? (field.flow.x * intent.direction.x + field.flow.y * intent.direction.y) / flowStrength
      : 0

    return triggerFrame(currentPlayer, {
      movement: {
        speed: Math.hypot(currentPlayer.velocity.x, currentPlayer.velocity.y),
        directionHeldMs: sameDirectionMs,
        pursuitMs,
        closingSpeed,
      },
      proximity: {
        nearestEdibleId: edible?.entity.id,
        nearestThreatId: nearMiss?.threat.id,
        schoolCount: Math.max(0, [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active').length - 1),
      },
      nearMiss: nearMiss ? { threatId: nearMiss.threat.id, clearance: nearMiss.clearance } : undefined,
      current: { strength: flowStrength, alignment },
    })
  }

  function triggerFrame(currentPlayer: EntityState, overrides: Partial<TriggerFrame>): TriggerFrame {
    return {
      atMs: elapsedMs,
      elapsedMs: STEP_MS,
      movement: {
        speed: Math.hypot(currentPlayer.velocity.x, currentPlayer.velocity.y),
        directionHeldMs: sameDirectionMs,
        pursuitMs,
        closingSpeed: 0,
      },
      environmentId: environmentId as `env-${string}`,
      ...overrides,
    }
  }

  function applyTriggerOutcomes(currentPlayer: EntityState, outcomes: readonly TriggerOutcome[]) {
    let speedMultiplier = 1
    let splitTriggered = false
    for (const outcome of outcomes) {
      if ((traitReadyAt.get(outcome.traitId) ?? 0) > elapsedMs) continue
      if (outcome.effectId === 'pursuit-burst' || outcome.effectId === 'current-assisted-acceleration' || outcome.effectId === 'engulf-vortex') {
        speedMultiplier = Math.max(speedMultiplier, outcome.magnitude ?? 1)
      }
      if (outcome.effectId === 'low-membrane-molt' || outcome.effectId === 'school-proximity-heal') {
        const live = entities.get(currentPlayer.id)
        if (live) entities.set(live.id, { ...live, membrane: Math.min(playerDefinition.membrane, live.membrane + (outcome.magnitude ?? 0)) })
      }
      if (outcome.effectId === 'damage-split') splitTriggered = activateSplit(currentPlayer, 2) || splitTriggered
      traitReadyAt.set(outcome.traitId, elapsedMs + outcome.cooldownMs)
      events.push({
        type: 'trait-triggered',
        entityId: currentPlayer.id,
        traitId: outcome.traitId,
        effectId: outcome.effectId,
        durationMs: outcome.durationMs,
        atMs: elapsedMs,
      })
    }
    return { speedMultiplier, splitTriggered }
  }

  function resetTriggerTracking() {
    pursuitMs = 0
    previousPursuitTargetId = undefined
    previousPursuitDistance = Number.POSITIVE_INFINITY
    sameDirectionMs = 0
    previousInputDirection = { x: 0, y: 0 }
    playerEngulfChain = 0
    lastPlayerEngulfAt = Number.NEGATIVE_INFINITY
    traitReadyAt.clear()
  }

  function resizePlayerEntity(entity: EntityState): EntityState {
    if (entity.status !== 'active') return entity
    if (!activeSwarm) return resizeBodyToRadius(entity, lifecycle.bodyRadius)
    const totalActiveMass = [...entities.values()]
      .filter((body) => body.faction === 'player' && body.status === 'active')
      .reduce((sum, body) => sum + body.mass, 0)
    const share = clamp(entity.mass / Math.max(entity.mass, totalActiveMass), 0, 1)
    return resizeBodyToRadius(entity, Math.max(2, lifecycle.bodyRadius * Math.sqrt(share)))
  }

  function resizeActivePlayerBodies() {
    const playerBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
    const totalMass = playerBodies.reduce((sum, entity) => sum + entity.mass, 0)
    for (const body of playerBodies) {
      const share = playerBodies.length === 1 ? 1 : clamp(body.mass / Math.max(body.mass, totalMass), 0, 1)
      entities.set(body.id, resizeBodyToRadius(body, Math.max(2, lifecycle.bodyRadius * Math.sqrt(share))))
    }
  }

  function perceptionFor(
    currentPlayer: EntityState,
    overrides: Partial<Pick<OrganPerception, 'sameDirectionMs' | 'collisionStrength' | 'incomingDamage' | 'incomingFatalDamage' | 'containmentRatio'>>,
  ): OrganPerception {
    const maxSpeed = 'maxSpeed' in currentPlayer ? Number(currentPlayer.maxSpeed) : 52
    const nearbyHostiles = [...entities.values()].filter((entity) => entity.status === 'active' && entity.faction === 'hostile')
    const incomingDamage = overrides.incomingDamage ?? 0
    const containmentThreat = nearbyHostiles
      .map((hostile) => ({ hostile, containment: coveredRatio(hostile.body, currentPlayer.body) }))
      .sort((first, second) => second.containment - first.containment)[0]
    const containmentRatio = overrides.containmentRatio ?? nearbyHostiles.reduce(
      (maximum, hostile) => Math.max(maximum, coveredRatio(hostile.body, currentPlayer.body)),
      0,
    )
    const incomingFatalDamage = overrides.incomingFatalDamage ?? incomingDamage >= currentPlayer.membrane
    if (!massSplitArmed && currentPlayer.mass >= massSplitRearmMass) massSplitArmed = true
    const emergencySplit = containmentRatio >= FATAL_SPLIT_COVERAGE || incomingFatalDamage
    const cooldownRemainingMs = Object.fromEntries(installedOrganelles.map((organ) => [
      organ.id,
      organ.id === 'organelle-division-ring' && !massSplitArmed && !emergencySplit
        ? Number.POSITIVE_INFINITY
        : Math.max(0, (organReadyAt.get(organ.id) ?? 0) - elapsedMs),
    ])) as OrganPerception['cooldownRemainingMs']
    return {
      atMs: elapsedMs,
      containmentRatio,
      hostileCount: nearbyHostiles.filter((hostile) => distanceBetween(hostile, currentPlayer) <= 240).length,
      speedRatio: Math.hypot(currentPlayer.velocity.x, currentPlayer.velocity.y) / Math.max(1, maxSpeed),
      sameDirectionMs: overrides.sameDirectionMs ?? sameDirectionMs,
      msSinceDamage: elapsedMs - lastDamageAt,
      membraneMax: playerDefinition.membrane,
      collisionStrength: overrides.collisionStrength ?? 0,
      incomingFatalDamage,
      incomingDamage,
      threatEscapeDirection: containmentThreat
        ? directionFromThreat(containmentThreat.hostile, currentPlayer)
        : directionFromVelocity(currentPlayer.velocity),
      cooldownRemainingMs,
    }
  }

  function applyOrganEffects(effects: readonly OrganEffect[]): { speedMultiplier: number; blockedAmount: number; splitTriggered: boolean } {
    let speedMultiplier = 1
    let blockedAmount = 0
    let splitTriggered = false
    for (const effect of effects) {
      const currentPlayer = entities.get(effect.entityId)
      if (!currentPlayer || currentPlayer.status !== 'active') break
      if (effect.effect === 'speed-boost') speedMultiplier = Math.max(speedMultiplier, effect.amount ?? 1)
      if (effect.effect === 'escape-impulse' && effect.impulse) {
        const magnitude = 70 * (effect.amount ?? 1)
        entities.set(effect.entityId, moveEntity({
          ...currentPlayer,
          energy: Math.max(0, currentPlayer.energy - (effect.energyCost ?? 0)),
        }, currentPlayer.position, {
          x: effect.impulse.x * magnitude,
          y: effect.impulse.y * magnitude,
        }))
      }
      if (effect.effect === 'repair') {
        entities.set(effect.entityId, {
          ...currentPlayer,
          membrane: Math.min(playerDefinition.membrane, currentPlayer.membrane + (effect.amount ?? 0)),
          energy: Math.max(0, currentPlayer.energy - (effect.energyCost ?? 0)),
        })
      }
      if (effect.effect === 'block') blockedAmount += effect.amount ?? 0
      if (effect.effect === 'block' && effect.energyCost) {
        entities.set(effect.entityId, {
          ...currentPlayer,
          energy: Math.max(0, currentPlayer.energy - effect.energyCost),
        })
      }
      if (effect.consumesCharge) consumeOrganCharge(effect.entityId, effect.organId)
      if (effect.effect === 'split') {
        const didSplit = activateSplit(currentPlayer, Math.max(2, Math.floor(effect.amount ?? 2)))
        splitTriggered ||= didSplit
        if (!didSplit) continue
      }

      const cooldown = organCooldownMs(effect.effect)
      if (cooldown > 0) organReadyAt.set(effect.organId, elapsedMs + cooldown)
      if ((organEventReadyAt.get(effect.organId) ?? 0) <= elapsedMs) {
        events.push({ type: 'organ-triggered', entityId: effect.entityId, organId: effect.organId, atMs: elapsedMs })
        organEventReadyAt.set(effect.organId, elapsedMs + (effect.effect === 'speed-boost' ? 750 : cooldown))
      }
    }
    return { speedMultiplier, blockedAmount, splitTriggered }
  }

  function activateSplit(currentPlayer: EntityState, count: number): boolean {
    if (activeSwarm) return false
    const result = splitBody(evolvedPlayer(currentPlayer), { count, lossFraction: count >= 3 ? 0.03 : 0.05 })
    const fatalThreat = [...entities.values()]
      .filter((entity) => entity.faction === 'hostile' && coveredRatio(entity.body, currentPlayer.body) >= FATAL_SPLIT_COVERAGE)
      .sort((first, second) => coveredRatio(second.body, currentPlayer.body) - coveredRatio(first.body, currentPlayer.body))[0]
    entities.delete(PLAYER_ID)
    activeSwarm = result.children.map((child, index) => ({
      ...child,
      id: index === 0 ? PLAYER_ID : child.id,
      position: fatalThreat ? splitEscapePosition(fatalThreat, child.mass, index, result.children.length) : child.position,
    }))
    for (const child of activeSwarm) {
      const totalChildMass = result.children.reduce((sum, item) => sum + item.mass, 0)
      entities.set(child.id, resizeBodyToRadius({
        ...currentPlayer,
        id: child.id,
        position: { ...child.position },
        velocity: { ...child.velocity },
        mass: child.mass,
        membrane: child.membrane,
        energy: child.energy,
        status: child.status,
      }, Math.max(2, lifecycle.bodyRadius * Math.sqrt(child.mass / Math.max(child.mass, totalChildMass)))))
    }
    captureLiveMorphology()
    swarmStableMs = 0
    swarmStartedAtMs = elapsedMs
    massSplitArmed = false
    massSplitRearmMass = Math.max(320, currentPlayer.mass + 16)
    swarmTransition = { kind: 'split', bodyCount: activeSwarm.length, startedAtMs: elapsedMs }
    return true
  }

  function moveActiveSwarm(stepMs: number, speedMultiplier: number) {
    if (!activeSwarm) return
    const seconds = stepMs / 1000
    const environmentSpeedMultiplier = activeSwarm.reduce((minimum, body) => {
      const entity = entities.get(body.id)
      return entity ? Math.min(minimum, sampleEnvironmentField(environmentField, entity.position, entity.body.radius).speedMultiplier) : minimum
    }, 1)
    activeSwarm = stepSwarm(activeSwarm, input.snapshot(), stepMs, speedMultiplier * environmentSpeedMultiplier).map((body) => {
      const entity = entities.get(body.id)
      if (!entity) return body
      const fieldSample = sampleEnvironmentField(environmentField, entity.position, entity.body.radius)
      const desiredPosition = {
        x: body.position.x + fieldSample.flow.x * 24 * seconds,
        y: body.position.y + fieldSample.flow.y * 24 * seconds,
      }
      const constrained = constrainWorldMotion(desiredPosition, body.velocity, {
        width: environment.width,
        height: environment.height,
        margin: entity.body.radius,
      })
      const position = resolveEnvironmentMovement(environmentField, entity.position, constrained.position, entity.body.radius)
      entities.set(body.id, moveEntity(entity, position, constrained.velocity))
      return { ...body, position, velocity: constrained.velocity }
    })
  }

  function stepFusion(stepMs: number) {
    if (!activeSwarm) return
    if (modifiers.rules['disable-swarm-fusion']) return
    if (elapsedMs - (swarmStartedAtMs ?? elapsedMs) < SWARM_MINIMUM_DURATION_MS) {
      swarmStableMs = 0
      return
    }
    if (input.snapshot().strength >= 0.2) {
      swarmStableMs = 0
      return
    }
    const proximity = 36
    swarmStableMs = advanceFusionStability(activeSwarm, swarmStableMs, stepMs, proximity)
    const fused = tryFuse(activeSwarm, { proximity, stableForMs: swarmStableMs, requiredStableMs: SWARM_FUSION_STABLE_MS })
    if (!fused) return
    const template = entities.get(PLAYER_ID) ?? entities.get(activeSwarm[0].id)
    if (!template) return
    for (const body of activeSwarm) entities.delete(body.id)
    entities.set(PLAYER_ID, resizeBodyToRadius({
      ...template,
      id: PLAYER_ID,
      position: fused.position,
      velocity: fused.velocity,
      mass: fused.mass,
      membrane: fused.membrane,
      energy: fused.energy,
      status: fused.status,
    }, lifecycle.bodyRadius))
    installedOrganelles = fused.organelles
    activeSwarm = undefined
    swarmStableMs = 0
    swarmStartedAtMs = undefined
    swarmTransition = { kind: 'fusion', bodyCount: 1, startedAtMs: elapsedMs }
  }

  function syncActiveSwarm(finalizeLosses: boolean) {
    if (!activeSwarm) return
    const synced = activeSwarm.flatMap((body) => {
      const entity = entities.get(body.id)
      return entity ? [{
        ...body,
        mass: entity.mass,
        position: { ...entity.position },
        velocity: { ...entity.velocity },
        membrane: entity.membrane,
        energy: entity.energy,
        status: entity.status,
      }] : []
    })
    if (!finalizeLosses) {
      activeSwarm = synced
      return
    }

    const survivors = synced.filter((body) => body.status === 'active' && body.mass > 0)
    if (survivors.length >= 2) {
      activeSwarm = ensureSwarmPrimary(survivors, entities)
      installedOrganelles = activeSwarm.flatMap((body) => body.organelles)
      return
    }
    swarmStableMs = 0
    if (survivors.length === 0) {
      activeSwarm = undefined
      events.push({ type: 'player-died', cause: 'all-split-bodies-lost', defeatedByDefinitionId: lastPlayerDefeaterDefinitionId, atMs: elapsedMs })
      return
    }

    const survivor = survivors[0]
    const entity = entities.get(survivor.id)
    if (!entity) return
    entities.delete(survivor.id)
    entities.set(PLAYER_ID, { ...entity, id: PLAYER_ID })
    installedOrganelles = survivor.organelles
    activeSwarm = undefined
  }

  function captureLiveMorphology() {
    const liveBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
    if (liveBodies.length === 0) return
    const liveIds = new Set(liveBodies.map((body) => body.id))
    lastLiveMorphology = {
      bodyCount: liveBodies.length,
      totalMass: liveBodies.reduce((sum, body) => sum + body.mass, 0),
      radius: liveBodies.reduce((maximum, body) => Math.max(maximum, body.body.radius), 0),
      stability: playerStability,
      organelles: (activeSwarm?.filter((body) => liveIds.has(body.id)).flatMap((body) => body.organelles) ?? installedOrganelles).map((organ) => ({ ...organ })),
    }
  }

  function consumeOrganCharge(entityId: string, organId: string) {
    updateBodyOrganelles(entityId, (organelles) => organelles.map((organ) => (
      organ.id === organId ? { ...organ, charges: Math.max(0, (organ.charges ?? 0) - 1) } : organ
    )))
  }

  function rechargeGuard(entityId: string) {
    updateBodyOrganelles(entityId, (organelles) => organelles.map((organ) => (
      organ.id === 'organelle-guard-symbiont'
        ? { ...organ, charges: organ.stage === 'mature' ? 2 : 1 }
        : organ
    )))
  }

  function updateBodyOrganelles(
    entityId: string,
    update: (organelles: InstalledOrganelle[]) => InstalledOrganelle[],
  ) {
    if (!activeSwarm) {
      installedOrganelles = update(installedOrganelles)
      return
    }
    activeSwarm = activeSwarm.map((body) => body.id === entityId ? { ...body, organelles: update(body.organelles) } : body)
    installedOrganelles = activeSwarm.flatMap((body) => body.organelles)
  }

  function evolvedPlayer(entity: EntityState): EvolvedEntityState {
    return {
      ...entity,
      stability: playerStability,
      installedOrganelles: activeSwarm?.find((body) => body.id === entity.id)?.organelles ?? installedOrganelles,
    }
  }

  function resolveNearbyInteractions() {
    const visited = new Set<string>()
    runStableEntityPass(entities, (entity, enqueueEntity) => {
      if (terminalReached) return
      if (entity.status !== 'active') return
      const reach = entity.body.radius + 72
      const nearby = grid.query({
        x: entity.position.x - reach,
        y: entity.position.y - reach,
        width: reach * 2,
        height: reach * 2,
      })

      for (const candidate of nearby) {
        if (candidate.id === entity.id) continue
        const pairKey = [entity.id, candidate.id].sort().join('\u0000')
        if (visited.has(pairKey)) continue
        visited.add(pairKey)

        let first = entities.get(entity.id)
        let second = entities.get(candidate.id)
        if (!first || !second || first.status !== 'active' || second.status !== 'active') continue
        if (isMaterializing(first, elapsedMs) || isMaterializing(second, elapsedMs)) continue
        if (isThreatArrivalInactive(first) || isThreatArrivalInactive(second)) continue
        if (first.id.startsWith('eco-food-') && second.id.startsWith('eco-food-')) continue
        if (first.faction === 'hostile' && second.faction === 'hostile') continue
        if (bossState?.phase === 'dormant' && (first.id === bossState.id || second.id === bossState.id)) continue
        const pairBoss = first.id === bossState?.id ? first : second.id === bossState?.id ? second : undefined
        const pairPlayerForRam = first.faction === 'player' ? first : second.faction === 'player' ? second : undefined
        if (pairBoss && pairPlayerForRam && bossState && elapsedMs - lastBossRamAt >= (content.bosses.find((item) => item.id === bossState?.id)?.rules.ramCooldownMs ?? Infinity)) {
          const overlaps = distanceBetween(pairBoss, pairPlayerForRam) <= pairBoss.body.radius + pairPlayerForRam.body.radius
          const ramDamage = overlaps
            ? bossRamDamage(bossState, evolvedPlayer(pairPlayerForRam).installedOrganelles.map((organ) => organ.id))
            : undefined
          const amount = ramDamage?.outerDamage ?? ramDamage?.coreDamage
          if (ramDamage && amount) {
            bossState = stepBoss(bossState, { atMs: elapsedMs, ...ramDamage })
            lastBossRamAt = elapsedMs
            events.push({ type: 'damaged', targetId: pairBoss.id, amount, source: 'ram', atMs: elapsedMs })
            emitBossResolution()
            if (terminalReached) return
            if (bossState.phase === 'resolved') continue
          }
        }
        const baseConfiguredDamage = contactDamageForPair(first, second, elapsedMs, damagePeriods)
        const configuredDamage = baseConfiguredDamage && modifiers.rules['increased-contact-damage'] && baseConfiguredDamage.damage.targetId === (first.faction === 'player' ? first.id : second.faction === 'player' ? second.id : '')
          ? { ...baseConfiguredDamage, damage: { ...baseConfiguredDamage.damage, amount: baseConfiguredDamage.damage.amount * 1.5 } }
          : baseConfiguredDamage
        let blockedAmount = 0
        let engulfCoverageThreshold = 0.7
        const pairPlayer = first.faction === 'player' ? first : second.faction === 'player' ? second : undefined
        const pairThreat = pairPlayer === first ? second : first
        if (pairPlayer && installedOrganelles.length > 0) {
          const incomingDamage = configuredDamage?.damage.targetId === pairPlayer.id ? configuredDamage.damage.amount : 0
          const passive = applyOrganEffects(evaluatePassiveOrgans(
            evolvedPlayer(pairPlayer),
            perceptionFor(pairPlayer, {
              containmentRatio: pairThreat.faction === 'hostile' ? coveredRatio(pairThreat.body, pairPlayer.body) : 0,
              collisionStrength: incomingDamage,
              incomingDamage,
            }),
          ))
          blockedAmount = passive.blockedAmount
          if (passive.splitTriggered) continue
          if (pairPlayer.body.radius > pairThreat.body.radius) {
            const approach = approachFor(pairPlayer, pairThreat)
            const containmentOutcomes = evaluateTriggers(buildState, triggerFrame(pairPlayer, {
              containment: { coveredRatio: coveredRatio(pairPlayer.body, pairThreat.body), approach },
            }))
            if (containmentOutcomes.some((outcome) => outcome.effectId === 'rear-containment-bonus')) engulfCoverageThreshold = 0.62
            applyTriggerOutcomes(pairPlayer, containmentOutcomes)
          }
          first = entities.get(first.id)
          second = entities.get(second.id)
          if (!first || !second) continue
        }
        const livePlayer = first.faction === 'player' ? first : second.faction === 'player' ? second : undefined
        const liveThreat = livePlayer === first ? second : first
        if (livePlayer && liveThreat.faction === 'hostile') {
          const relief = escapeContactRelief(livePlayer, liveThreat, input.snapshot(), engulfCoverageThreshold)
          if (relief) {
            const inset = collapseSafeInset()
            const position = {
              x: clamp(relief.position.x, livePlayer.body.radius + inset, environment.width - livePlayer.body.radius - inset),
              y: clamp(relief.position.y, livePlayer.body.radius + inset, environment.height - livePlayer.body.radius - inset),
            }
            const relievedPlayer = moveEntity(livePlayer, position, relief.velocity)
            entities.set(relievedPlayer.id, relievedPlayer)
            if (first.id === relievedPlayer.id) first = relievedPlayer
            else second = relievedPlayer
          }
        }
        const result = resolveInteraction(first, second, {
          atMs: elapsedMs,
          engulfLocks,
          ruptureLossFraction: 0.08,
          engulfMassGainFraction: (first.id.startsWith('eco-food-') || second.id.startsWith('eco-food-'))
            && first.faction !== 'player' && second.faction !== 'player'
            ? 0
            : 1,
          engulfCoverageThreshold,
          engulfChain: pairPlayer && elapsedMs - lastPlayerEngulfAt <= 1400 ? playerEngulfChain + 1 : 1,
          contactDamage: configuredDamage ? { ...configuredDamage.damage, blockedAmount } : undefined,
        })
        const engulfed = result.events.find((event) => event.type === 'engulfed')
        const playerEngulf = engulfed && (
          (engulfed.predatorId === first.id && first.faction === 'player')
          || (engulfed.predatorId === second.id && second.faction === 'player')
        )
        if (engulfed && playerEngulf) lifecycle = applyLifecycleBiomass(lifecycle, engulfed.biomass, scaleTiers)
        for (const resolvedEntity of result.entities) {
          entities.set(
            resolvedEntity.id,
            resolvedEntity.faction === 'player'
              ? resizePlayerEntity(resolvedEntity)
              : resizeForMass(resolvedEntity),
          )
        }
        if (first.faction === 'player' || second.faction === 'player') {
          peakBiomass = Math.max(peakBiomass, lifecycle.totalBiomass)
          captureLiveMorphology()
        }
        result.fragments.forEach(enqueueEntity)
        events.push(...result.events)
        if (engulfed) {
          const predator = engulfed.predatorId === first.id ? first : second
          if (predator.faction === 'player') {
            playerEngulfChain = engulfed.chain ?? (elapsedMs - lastPlayerEngulfAt <= 1400 ? playerEngulfChain + 1 : 1)
            lastPlayerEngulfAt = elapsedMs
            engulfScore += engulfed.biomass
            const currentPredator = entities.get(predator.id)
            if (currentPredator) applyTriggerOutcomes(currentPredator, evaluateTriggers(buildState, triggerFrame(currentPredator, {
              engulf: { preyId: engulfed.preyId, chain: playerEngulfChain, approach: approachFor(predator, engulfed.preyId === first.id ? first : second) },
            })))
          }
          if (predator.faction === 'player') rechargeGuard(predator.id)
          if (predator.faction === 'player') {
            const currentPredator = entities.get(predator.id)
            if (currentPredator) entities.set(predator.id, {
              ...currentPredator,
              energy: Math.min(playerDefinition.energy, currentPredator.energy + engulfed.biomass * (modifiers.rules['reduced-energy-yield'] ? 0.03 : 0.08)),
            })
          }
          if (engulfed.preyId === bossState?.id && predator.faction === 'player') {
            bossState = stepBoss(bossState, {
              atMs: elapsedMs,
              outerDamage: bossState.outerMembraneMax,
              coreDamage: bossState.coreIntegrityMax,
            })
            bossState = stepBoss(bossState, { atMs: elapsedMs })
            emitBossResolution()
            if (terminalReached) return
          }
        }
        if (pairPlayer) {
          const playerDamage = result.events.find((event) => event.type === 'damaged' && event.targetId === pairPlayer.id)
          if (playerDamage?.type === 'damaged') {
            lastDamageAt = elapsedMs
            lastDamageSource = playerDamage.source
            const damagedPlayer = entities.get(pairPlayer.id)
            if (damagedPlayer?.status === 'active') applyTriggerOutcomes(damagedPlayer, evaluateTriggers(buildState, triggerFrame(damagedPlayer, {
              damage: {
                source: playerDamage.source,
                remainingMembraneRatio: damagedPlayer.membrane / Math.max(1, playerDefinition.membrane),
              },
              collision: { sourceId: pairThreat.id, strength: playerDamage.amount },
            })))
          }
        }
        if (configuredDamage && result.events.some((event) => event.type === 'damaged' && event.targetId === configuredDamage.damage.targetId)) {
          damagePeriods.set(configuredDamage.lockKey, configuredDamage.periodIndex)
        }
        if (pairPlayer && pairThreat.faction === 'hostile' && result.events.some((event) => (
          event.type === 'engulfed' && event.preyId === pairPlayer.id
          || event.type === 'ruptured' && event.targetId === pairPlayer.id
        ))) {
          lastPlayerDefeaterDefinitionId = 'definitionId' in pairThreat ? String(pairThreat.definitionId) : undefined
        }
        if (!activeSwarm && result.events.some((event) => (
          event.type === 'engulfed' && event.preyId === PLAYER_ID
          || event.type === 'ruptured' && event.targetId === PLAYER_ID
        ))) {
          events.push({
            type: 'player-died',
            cause: 'engulfed-or-ruptured',
            defeatedByDefinitionId: pairThreat.faction === 'hostile' && 'definitionId' in pairThreat ? String(pairThreat.definitionId) : undefined,
            atMs: elapsedMs,
          })
        }
      }
    })
  }

  function spawnModifierElite() {
    if (!modifiers.rules['extra-elite-spawns'] || environmentId === 'env-clear-drop' || environmentId === 'env-abandoned-chamber') return
    const localCreatures = content.creatures.filter((item) => item.environmentIds.includes(environmentId))
    const candidate = localCreatures.find((item) => item.role === 'elite')
      ?? localCreatures.find((item) => item.role === 'hunter')
      ?? localCreatures.find((item) => item.role === 'parasite')
      ?? localCreatures.find((item) => item.role === 'scavenger')
    if (!candidate) return
    const local = creatureEntityDefinition(candidate as import('../content').CreatureDefinition)
    const definition = {
      ...local,
      role: 'elite' as const,
      radius: local.radius * 1.18,
      mass: local.mass * 1.45,
      membrane: local.membrane * 1.35,
    }
    const id = `modifier-elite-${environmentId}-${routeStageIndex}`
    const spawned = createEntity(definition, { id, position: { x: environment.width / 2, y: environment.height / 2 }, spawnedAtMs: elapsedMs })
    entities.set(id, prepareSpawn(spawned, entities.get(PLAYER_ID), elapsedMs))
  }

  function prepareSpawn(entity: EntityState, playerBody: EntityState | undefined, atMs: number): EntityState {
    return materializeSpawn(tuneSpawnedThreat(entity, playerBody), atMs, content.m1.spawnPresentation)
  }

  function currentThreatProfile(): StageThreatProfileDefinition {
    return (content.m1.stageThreatProfiles as StageThreatProfileDefinition[]).find((profile) => profile.stageIndex === routeStageIndex + 1)
      ?? (content.m1.stageThreatProfiles as StageThreatProfileDefinition[])[0]!
  }

  function tuneSpawnedThreat(entity: EntityState, playerBody: EntityState | undefined): EntityState {
    if (entity.faction !== 'hostile' || entity.role === 'boss' || !playerBody) return entity
    const profile = currentThreatProfile()
    const runtimeEntity = entity as EntityState & { maxSpeed?: number; contactDamage?: ContactDamageDefinition }
    const runtimePlayer = playerBody as EntityState & { maxSpeed?: number }
    const minimumRadius = playerBody.body.radius * profile.minimumHunterRadiusRatio
    const radius = Math.max(entity.body.radius, minimumRadius)
    const membraneScale = radius / Math.max(1, entity.body.radius)
    const resized = resizeBodyToMass({
      ...entity,
      mass: Math.max(entity.mass, radius * radius),
      membrane: Math.round(entity.membrane * membraneScale),
    })
    const tuned = {
      ...resized,
      maxSpeed: Math.max(1, Number(runtimePlayer.maxSpeed ?? 96) * profile.hostileCruiseSpeedRatio),
      contactDamage: runtimeEntity.contactDamage ? {
        ...runtimeEntity.contactDamage,
        amount: runtimeEntity.contactDamage.amount * profile.contactDamageMultiplier,
      } : undefined,
    }
    const currentDistance = distanceBetween(tuned, playerBody)
    const safeDistance = Math.max(
      tuned.body.radius + playerBody.body.radius + profile.spawnClearance,
      content.m1.spawnPresentation.threatSpawnDistance,
    )
    if (currentDistance >= safeDistance) return tuned
    const fallbackAngle = createRng(options.seed).fork(`threat-clearance-${entity.id}`).next() * Math.PI * 2
    const angle = currentDistance > 0
      ? Math.atan2(tuned.position.y - playerBody.position.y, tuned.position.x - playerBody.position.x)
      : fallbackAngle
    const separatedPosition = {
      x: clamp(playerBody.position.x + Math.cos(angle) * safeDistance, tuned.body.radius, environment.width - tuned.body.radius),
      y: clamp(playerBody.position.y + Math.sin(angle) * safeDistance, tuned.body.radius, environment.height - tuned.body.radius),
    }
    const separatedDistance = Math.hypot(separatedPosition.x - playerBody.position.x, separatedPosition.y - playerBody.position.y)
    const safePosition = separatedDistance >= safeDistance
      ? separatedPosition
      : Array.from({ length: 16 }, (_, index) => {
        const candidateAngle = index / 16 * Math.PI * 2
        return {
          x: clamp(playerBody.position.x + Math.cos(candidateAngle) * safeDistance, tuned.body.radius, environment.width - tuned.body.radius),
          y: clamp(playerBody.position.y + Math.sin(candidateAngle) * safeDistance, tuned.body.radius, environment.height - tuned.body.radius),
        }
      }).sort((left, right) => (
        Math.hypot(right.x - playerBody.position.x, right.y - playerBody.position.y)
        - Math.hypot(left.x - playerBody.position.x, left.y - playerBody.position.y)
      ))[0]!
    return moveEntity(tuned, safePosition, { x: 0, y: 0 })
  }
}

export function runStableEntityPass<T extends { id: string }>(
  entities: Map<string, T>,
  visit: (entity: T, enqueue: (entity: T) => void) => void,
): void {
  const ids = [...entities.keys()]
  const pending: T[] = []
  const enqueue = (entity: T) => pending.push(entity)

  for (const id of ids) {
    const entity = entities.get(id)
    if (entity) visit(entity, enqueue)
  }

  for (const entity of pending) entities.set(entity.id, entity)
}

export function neutralizeResolvedBoss(entity: EntityState, state: BossState): EntityState {
  if (entity.id !== state.id || state.phase !== 'resolved') return entity
  return { ...entity, velocity: { x: 0, y: 0 }, status: 'engulfed' }
}

export function endingForBossRewards(
  rewardIds: readonly string[],
  stability: number,
  context: { path?: BossResolutionPath; bodyCount?: number } = {},
): string | undefined {
  if (context.path === 'parasite' && rewardIds.includes('ending-host-takeover')) return 'ending-host-takeover'
  if ((context.bodyCount ?? 1) > 1 && rewardIds.includes('ending-swarm-mind')) return 'ending-swarm-mind'
  const stable = content.endings.find((item) => item.id === 'ending-stable-species' && rewardIds.includes(item.id))
  return stable && stability >= (stable.minimumStability ?? Infinity) ? stable.id : undefined
}

export function bossTerminalEvent(
  rewardIds: readonly string[],
  stability: number,
  atMs: number,
  context?: { path?: BossResolutionPath; bodyCount?: number },
): Extract<GameEvent, { type: 'ending-reached' | 'player-died' }> | undefined {
  const hasEndingReward = content.endings.some((ending) => rewardIds.includes(ending.id))
  if (!hasEndingReward) return undefined
  const endingId = endingForBossRewards(rewardIds, stability, context)
  return endingId
    ? { type: 'ending-reached', endingId, atMs }
    : { type: 'player-died', cause: 'organelle-instability', atMs }
}

export function terminatePlayerEntities(entities: Map<string, EntityState>): void {
  for (const [id, entity] of entities) {
    if (entity.faction !== 'player' || entity.status !== 'active') continue
    entities.set(id, { ...entity, mass: 0, membrane: 0, energy: 0, velocity: { x: 0, y: 0 }, status: 'ruptured' })
  }
}

export function ensureSwarmPrimary(
  survivors: readonly SwarmBody[],
  entities: Map<string, EntityState>,
): SwarmBody[] {
  if (survivors.some((body) => body.id === PLAYER_ID)) return [...survivors]
  const replacement = survivors[0]
  const replacementEntity = replacement ? entities.get(replacement.id) : undefined
  if (!replacement || !replacementEntity) return [...survivors]

  entities.delete(PLAYER_ID)
  entities.delete(replacement.id)
  entities.set(PLAYER_ID, { ...replacementEntity, id: PLAYER_ID })
  return survivors.map((body) => body.id === replacement.id ? { ...body, id: PLAYER_ID } : body)
}

export function contactDamageAt(entity: EntityState, atMs: number): {
  source: ContactDamageDefinition['source']
  amount: number
  periodIndex: number
} | undefined {
  const definition = 'contactDamage' in entity ? entity.contactDamage as ContactDamageDefinition | undefined : undefined
  if (!definition || definition.periodMs <= 0 || definition.activeMs <= 0 || definition.amount <= 0) return undefined

  const shiftedTime = Math.max(0, atMs + definition.phaseOffsetMs)
  const periodIndex = Math.floor(shiftedTime / definition.periodMs)
  const phaseMs = shiftedTime - periodIndex * definition.periodMs
  if (phaseMs >= definition.activeMs) return undefined
  return { source: definition.source, amount: definition.amount, periodIndex }
}

export function contactDamageForPair(
  first: EntityState,
  second: EntityState,
  atMs: number,
  damagePeriods: ReadonlyMap<string, number>,
) {
  const options = [
    { attacker: first, target: second, active: armedContactDamageAt(first, atMs) },
    { attacker: second, target: first, active: armedContactDamageAt(second, atMs) },
  ]

  for (const option of options) {
    if (
      !option.active
      || option.attacker.faction === option.target.faction
      || option.target.role === 'fragment'
      || option.target.role === 'nutrient'
    ) continue
    const lockKey = `${option.attacker.id}\u0000${option.target.id}`
    if (damagePeriods.get(lockKey) === option.active.periodIndex) continue
    return {
      lockKey,
      periodIndex: option.active.periodIndex,
      damage: {
        source: option.active.source,
        amount: option.active.amount,
        targetId: option.target.id,
      },
    }
  }
  return undefined
}

function armedContactDamageAt(entity: EntityState, atMs: number) {
  const spawnedAtMs = 'spawnedAtMs' in entity ? Number(entity.spawnedAtMs) : 0
  const armedElapsedMs = atMs - spawnedAtMs - CONTACT_DAMAGE_ARM_MS
  if (!Number.isFinite(armedElapsedMs) || armedElapsedMs < 0) return undefined
  return contactDamageAt(entity, armedElapsedMs)
}

function getEnvironment(environmentId: string): EngineEnvironment {
  return getRegionDefinition(environmentId) as EngineEnvironment
}

function offsetGeneratedRegion(region: GeneratedRegion, offsetMs: number): GeneratedRegion {
  return {
    ...region,
    spawnSchedule: region.spawnSchedule.map((entry) => ({ ...entry, atMs: entry.atMs + offsetMs })),
    routeRifts: region.routeRifts.map((rift) => ({ ...rift, opensAtMs: rift.opensAtMs + offsetMs })),
  }
}

function filteredRegion(region: GeneratedRegion, destinationEnvironmentId?: string): GeneratedRegion {
  if (!destinationEnvironmentId) return region
  const matching = region.routeRifts.filter((rift) => rift.destinationEnvironmentId === destinationEnvironmentId)
  return matching.length > 0 ? { ...region, routeRifts: matching } : region
}

function getPlayerDefinition(originId: string, environment: EngineEnvironment): PlayerDefinition {
  if (environment.playerDefinition.id === originId) return environment.playerDefinition
  const definition = (content.m0.playerDefinitions as PlayerDefinition[]).find((item) => item.id === originId)
  if (!definition) throw new RangeError(`Unknown player definition id: ${originId}`)
  return definition
}

function provisionalBodyStage(routeIndex: number): BodyStage {
  const stages: readonly BodyStage[] = ['microbe', 'hunter', 'specialist', 'dominant', 'ascendant']
  return stages[Math.min(stages.length - 1, Math.max(0, routeIndex))]!
}

function ecologyBudget(environmentId: string): EcologyBudgetDefinition {
  const budget = (content.ecologyBudgets as EcologyBudgetDefinition[]).find((item) => item.environmentId === environmentId)
  if (!budget) throw new RangeError(`Unknown ecology budget environment: ${environmentId}`)
  return budget
}

function spawnCapForRole(role: EntityState['role']): number {
  if (role === 'nutrient') return 18
  if (role === 'prey') return 12
  if (role === 'competitor') return 6
  if (role === 'scavenger') return 4
  if (role === 'predator') return 5
  if (role === 'elite') return 2
  return 4
}

function moveEntity(entity: EntityState, position: Vec2, velocity: Vec2): EntityState {
  const offset = { x: position.x - entity.position.x, y: position.y - entity.position.y }
  return {
    ...entity,
    position,
    velocity,
    body: {
      ...entity.body,
      center: { ...position },
      contour: entity.body.contour.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y })),
    },
  }
}

function initialLifecycleState(
  base: LifecycleState,
  overrides: Partial<LifecycleState> | undefined,
  tiers: readonly ScaleTierDefinition[],
): LifecycleState {
  if (!overrides) return base
  const tierIndex = Number.isInteger(overrides.tierIndex) && Number(overrides.tierIndex) >= 0 && Number(overrides.tierIndex) < tiers.length
    ? Number(overrides.tierIndex)
    : base.tierIndex
  const tier = tiers[tierIndex]!
  const tierBiomass = Number.isFinite(overrides.tierBiomass) && Number(overrides.tierBiomass) >= 0
    ? Number(overrides.tierBiomass)
    : base.tierBiomass
  const derivedPressure = tierBiomass / tier.evolutionPressureTarget
  const evolutionPressure = clamp(
    Number.isFinite(overrides.evolutionPressure) ? Number(overrides.evolutionPressure) : derivedPressure,
    0,
    1,
  )
  return {
    tierIndex,
    formId: tier.formId,
    totalBiomass: Number.isFinite(overrides.totalBiomass) && Number(overrides.totalBiomass) >= 0
      ? Number(overrides.totalBiomass)
      : base.totalBiomass,
    tierBiomass,
    evolutionPressure,
    bodyRadius: radiusForTierProgress(tier, evolutionPressure),
    encounterResolved: overrides.encounterResolved === true,
  }
}

export function resizeBodyToRadius(entity: EntityState, radius: number): EntityState {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Body radius must be finite and positive')
  if (entity.body.radius === radius) return entity
  return {
    ...entity,
    body: {
      center: { ...entity.position },
      radius,
      contour: Array.from({ length: 16 }, (_, index) => {
        const angle = index / 16 * Math.PI * 2
        return {
          x: entity.position.x + Math.cos(angle) * radius,
          y: entity.position.y + Math.sin(angle) * radius,
        }
      }),
    },
  }
}

function assertFinitePlayerState(entities: ReadonlyMap<string, EntityState>, playerIds: readonly string[]) {
  for (const playerId of playerIds) {
    const entity = entities.get(playerId)
    if (!entity || entity.faction !== 'player' || entity.status !== 'active') continue
    const values = [
      entity.mass,
      entity.body.radius,
      entity.position.x,
      entity.position.y,
      entity.velocity.x,
      entity.velocity.y,
    ]
    if (values.some((value) => !Number.isFinite(value))) {
      throw new LifecycleInvariantError(`Player ${entity.id} contains non-finite lifecycle geometry`)
    }
  }
}

function resizeForMass(entity: EntityState): EntityState {
  if (entity.status !== 'active') return entity
  const radius = Math.max(entity.body.radius, Math.sqrt(entity.mass))
  if (radius === entity.body.radius) return entity

  return {
    ...entity,
    body: {
      center: { ...entity.position },
      radius,
      contour: Array.from({ length: 16 }, (_, index) => {
        const angle = index / 16 * Math.PI * 2
        return {
          x: entity.position.x + Math.cos(angle) * radius,
          y: entity.position.y + Math.sin(angle) * radius,
        }
      }),
    },
  }
}

function resizeBodyToMass(entity: EntityState): EntityState {
  const radius = Math.max(2, Math.sqrt(Math.max(0, entity.mass)))
  return {
    ...entity,
    body: {
      center: { ...entity.position },
      radius,
      contour: Array.from({ length: 16 }, (_, index) => {
        const angle = index / 16 * Math.PI * 2
        return {
          x: entity.position.x + Math.cos(angle) * radius,
          y: entity.position.y + Math.sin(angle) * radius,
        }
      }),
    },
  }
}

function distanceBetween(first: EntityState, second: EntityState): number {
  return Math.hypot(first.position.x - second.position.x, first.position.y - second.position.y)
}

function approachFor(player: EntityState, target: EntityState): 'front' | 'side' | 'rear' {
  const speed = Math.hypot(player.velocity.x, player.velocity.y)
  const distance = Math.max(1, distanceBetween(player, target))
  const dot = speed > 0
    ? (player.velocity.x * (target.position.x - player.position.x) + player.velocity.y * (target.position.y - player.position.y)) / (speed * distance)
    : 0
  return dot >= 0.45 ? 'front' : dot <= -0.45 ? 'rear' : 'side'
}

function directionFromThreat(threat: EntityState, player: EntityState): Vec2 {
  const x = player.position.x - threat.position.x
  const y = player.position.y - threat.position.y
  const length = Math.hypot(x, y)
  return length > 0 ? { x: x / length, y: y / length } : directionFromVelocity(player.velocity)
}

function directionFromVelocity(velocity: Vec2): Vec2 {
  const length = Math.hypot(velocity.x, velocity.y)
  return length > 0 ? { x: -velocity.x / length, y: -velocity.y / length } : { x: -1, y: 0 }
}

function normalizedDirection(from: Vec2, to: Vec2): Vec2 {
  const x = to.x - from.x
  const y = to.y - from.y
  const length = Math.hypot(x, y)
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: -1 }
}

function splitEscapePosition(threat: EntityState, childMass: number, index: number, count: number): Vec2 {
  const angle = index / count * Math.PI * 2
  const distance = threat.body.radius + Math.sqrt(childMass) + 8
  return {
    x: threat.position.x + Math.cos(angle) * distance,
    y: threat.position.y + Math.sin(angle) * distance,
  }
}

function organCooldownMs(effect: OrganEffect['effect']): number {
  if (effect === 'escape-impulse') return 3000
  if (effect === 'block') return 650
  if (effect === 'repair') return 2500
  if (effect === 'split') return 5000
  return 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
