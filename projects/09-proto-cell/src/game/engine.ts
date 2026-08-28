import content from '../content/content.json'
import type { AnchorSlot, BossId, BossResolutionPath, EventId, OrganelleId, OriginId } from '../content'
import type { EntityState, Vec2 } from '../domain/types'
import { decideIntent } from '../entities/ai'
import { createEntity, type ContactDamageDefinition, type EntityDefinition } from '../entities/factory'
import { findEnteredRouteRift, generateRegion, getRegionDefinition } from '../world/generator'
import { createFixedClock } from './clock'
import { createPointerInput, type PointerInput } from './input'
import { resolveInteraction, type GameEvent } from './interactions'
import { SpatialGrid } from './spatial-grid'
import type { MutationInstallResult } from '../evolution/mutation'
import { evaluatePassiveOrgans, type EvolvedEntityState, type InstalledOrganelle, type OrganEffect, type OrganPerception } from '../evolution/organs'
import { advanceFusionStability, splitBody, stepSwarm, tryFuse, type SwarmBody } from '../evolution/split'
import { createRng } from '../domain/rng'
import { bossRamDamage, createBoss, stepBoss, type BossState } from '../world/bosses'
import { startEvent, stepEvent, type EcosystemEventState } from '../world/events'
import { applyEventWorldEffects, createEnvironmentField, resolveEnvironmentMovement, sampleEnvironmentField, stepEnvironmentField, type EnvironmentField } from '../world/environments'
import type { GeneratedRegion, RouteRift } from '../world/generator'

export type PauseReason = 'user' | 'visibility' | 'evolution'

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
  entities: readonly EntityState[]
  routeRifts: readonly RouteRift[]
  activeEvent?: EcosystemEventState
  environmentField: EnvironmentField
  boss?: BossState
}

export type ProtoCellEngine = GameEngine & {
  input: PointerInput
  renderSnapshot(): WorldRenderSnapshot
  applyMutation(result: MutationInstallResult): void
  evolutionSnapshot(): { organelles: readonly InstalledOrganelle[]; capacity: number; stability: number }
  morphologySnapshot(): PlayerMorphologySnapshot
  worldSnapshot(): { activeEvent?: EcosystemEventState; environmentField: EnvironmentField; boss?: BossState; selectedRouteId?: string }
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
const ACCELERATION_RESPONSE_SECONDS = 0.18
const DRIFT_RESPONSE_SECONDS = 0.32
export const CONTACT_DAMAGE_ARM_MS = 420

export function createGameEngine(options: {
  seed: number
  environmentId?: string
  originId?: OriginId
  input?: PointerInput
  initialElapsedMs?: number
}): ProtoCellEngine {
  let environmentId = options.environmentId ?? 'env-clear-drop'
  let environment = getEnvironment(environmentId)
  const originId = options.originId ?? 'origin-primal-cell'
  const origin = content.origins.find((item) => item.id === originId)
  if (!origin) throw new RangeError(`Unknown origin id: ${originId}`)
  const playerDefinition = getPlayerDefinition(originId, environment)

  let region = generateRegion(options.seed, environmentId)
  let scheduleAt = new Map(region.spawnSchedule.map((entry) => [entry.entityId, entry.atMs]))
  let regionById = new Map(region.entities.map((entity) => [entity.id, entity]))
  const player = createEntity(playerDefinition, {
    id: PLAYER_ID,
    position: { x: environment.width / 2, y: environment.height / 2 },
  })
  const entities = new Map<string, EntityState>([[player.id, player]])
  const spawnedIds = new Set<string>()
  const pauseReasons = new Set<PauseReason>()
  const engulfLocks = new Set<string>()
  const damagePeriods = new Map<string, number>()
  const events: GameEvent[] = []
  const grid = new SpatialGrid(96)
  const clock = createFixedClock({ stepMs: STEP_MS, maxSteps: 5 })
  const input = options.input ?? createPointerInput()
  const worldRng = createRng(options.seed).fork('m1-world')
  let elapsedMs = Math.max(0, options.initialElapsedMs ?? 0)
  let interpolationAlpha = 0
  let started = false
  let destroyed = false
  let mutationPending = false
  let evolutionThreshold = playerDefinition.evolutionThreshold
  let playerStability = playerDefinition.stability
  let installedOrganelles: InstalledOrganelle[] = origin.initialOrganelleIds.map((id) => {
    const definition = content.organelles.find((item) => item.id === id)
    if (!definition) throw new RangeError(`Unknown initial organ id: ${id}`)
    return { id: id as OrganelleId, stage: 'installed', anchor: definition.slots[0] as AnchorSlot }
  })
  let organCapacity = 6
  const organReadyAt = new Map<string, number>()
  const organEventReadyAt = new Map<string, number>()
  let lastDamageAt = Number.NEGATIVE_INFINITY
  let sameDirectionMs = 0
  let previousInputDirection: Vec2 = { x: 0, y: 0 }
  let activeSwarm: SwarmBody[] | undefined
  let swarmStableMs = 0
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
  let peakBiomass = player.mass
  let terminalReached = false
  let lastLiveMorphology: PlayerMorphologySnapshot = {
    bodyCount: 1,
    totalMass: player.mass,
    radius: player.body.radius,
    stability: playerDefinition.stability,
    organelles: installedOrganelles.map((organ) => ({ ...organ })),
  }

  spawnDue(elapsedMs)

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
    },
    resume(reason) {
      pauseReasons.delete(reason)
      clock.reset()
    },
    snapshot() {
      const playerBodies = [...entities.values()].filter((entity) => entity.faction === 'player' && entity.status === 'active')
      const currentPlayer = entities.get(PLAYER_ID) ?? playerBodies[0] ?? player
      const biomass = playerBodies.reduce((sum, body) => sum + body.mass, 0)
      peakBiomass = Math.max(peakBiomass, biomass)
      return {
        membrane: activeSwarm ? playerBodies.reduce((sum, body) => sum + body.membrane, 0) : currentPlayer.membrane,
        energy: activeSwarm ? playerBodies.reduce((sum, body) => sum + body.energy, 0) : currentPlayer.energy,
        stability: playerStability,
        biomass,
        peakBiomass,
        evolutionThreshold,
        elapsedMs,
        environmentId,
        paused: pauseReasons.size > 0,
      }
    },
    drainEvents() {
      return events.splice(0, events.length)
    },
    renderSnapshot() {
      return {
        elapsedMs,
        interpolationAlpha,
        environmentId,
        width: environment.width,
        height: environment.height,
        playerId: PLAYER_ID,
        entities: [...entities.values()].filter((entity) => entity.status === 'active'),
        routeRifts: region.routeRifts,
        activeEvent,
        environmentField,
        boss: bossState,
      }
    },
    applyMutation(result) {
      playerStability = result.stability
      installedOrganelles = [...result.organelles]
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
    destroy() {
      destroyed = true
      started = false
      pauseReasons.clear()
      entities.clear()
      events.length = 0
      clock.reset()
      input.cancel()
    },
  }

  return engine

  function simulateStep(stepMs: number) {
    if (terminalReached) return
    elapsedMs += stepMs
    stepWorldFeatures(stepMs)
    if (terminalReached) {
      activeSwarm = undefined
      return
    }
    spawnDue(elapsedMs)
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
    captureLiveMorphology()

    const playerMass = [...entities.values()]
      .filter((entity) => entity.faction === 'player' && entity.status === 'active')
      .reduce((sum, entity) => sum + entity.mass, 0)
    if (playerMass > 0 && !mutationPending && playerMass >= evolutionThreshold) {
      events.push({ type: 'mutation-ready', entityId: PLAYER_ID, atMs: elapsedMs })
      mutationPending = true
    }
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
    applyEnvironmentDamage()
    const bossDefinition = content.bosses.find((item) => item.id === launchEnvironment?.bossId)
    const bossSpawnAtMs = environmentEnteredAtMs + Math.max(30_000, ((launchEnvironment?.durationTargetSec[0] ?? 120) - 25) * 1000)
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
      entities.set(id, createEntity(definition, { id, position, spawnedAtMs: elapsedMs }))
    }
  }

  function stepRouteRiftsAndBoss(stepMs: number) {
    const playerBody = entities.get(PLAYER_ID)
    const bossAllowsExit = !bossState || bossState.phase === 'resolved'
    if (bossAllowsExit && elapsedMs >= routeEntryGuardUntilMs && playerBody?.status === 'active') {
      const entered = findEnteredRouteRift(region.routeRifts, {
        position: playerBody.position,
        radius: playerBody.body.radius,
      }, elapsedMs)
      if (entered) {
        selectedRouteId = entered.id
        events.push({ type: 'route-selected', environmentId: entered.destinationEnvironmentId, atMs: elapsedMs })
        enterEnvironment(entered.destinationEnvironmentId)
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
    for (const [entityId, scheduledAt] of scheduleAt) {
      if (scheduledAt > atMs || spawnedIds.has(entityId)) continue
      const entity = regionById.get(entityId)
      if (entity) entities.set(entityId, { ...entity, spawnedAtMs: atMs })
      spawnedIds.add(entityId)
    }
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
    for (const entity of entities.values()) {
      if (entity.status !== 'active') continue
      if (activeSwarm && entity.faction === 'player') continue
      const bossDormant = entity.id === bossState?.id && bossState.phase === 'dormant'
      const intent = bossDormant
        ? { direction: { x: 0, y: 0 }, strength: 0 }
        : entity.id === PLAYER_ID
        ? input.snapshot()
        : decideIntent(entity, {
            nearby: grid.query({
              x: entity.position.x - 240,
              y: entity.position.y - 240,
              width: 480,
              height: 480,
            }),
            attractionFields: activeEvent?.phase === 'active' ? activeEvent.aiSignals.map((signal) => ({
              center: signal.center,
              radius: signal.radius,
              strength: signal.strength,
              flow: signal.flow,
            })) : [],
          })
      const bossPhaseSpeed = entity.id !== bossState?.id ? 1
        : bossState.phase === 'feeding' ? 0.58
          : bossState.phase === 'exposed' ? 0.86
            : bossState.phase === 'enraged' ? 1.35
              : 1
      const fieldSample = sampleEnvironmentField(environmentField, entity.position, entity.body.radius)
      const maxSpeed = ('maxSpeed' in entity ? Number(entity.maxSpeed) : 52)
        * (entity.id === PLAYER_ID ? speedMultiplier : bossPhaseSpeed)
        * fieldSample.speedMultiplier
      const desiredVelocity = {
        x: intent.direction.x * intent.strength * maxSpeed + fieldSample.flow.x * 24,
        y: intent.direction.y * intent.strength * maxSpeed + fieldSample.flow.y * 24,
      }
      const responseSeconds = intent.strength > 0 ? ACCELERATION_RESPONSE_SECONDS : DRIFT_RESPONSE_SECONDS
      const blend = 1 - Math.exp(-seconds / responseSeconds)
      const velocity = {
        x: entity.velocity.x + (desiredVelocity.x - entity.velocity.x) * blend,
        y: entity.velocity.y + (desiredVelocity.y - entity.velocity.y) * blend,
      }
      const unconstrainedPosition = {
        x: clamp(entity.position.x + velocity.x * seconds, entity.body.radius, environment.width - entity.body.radius),
        y: clamp(entity.position.y + velocity.y * seconds, entity.body.radius, environment.height - entity.body.radius),
      }
      const position = resolveEnvironmentMovement(environmentField, entity.position, unconstrainedPosition, entity.body.radius)
      entities.set(entity.id, moveEntity(entity, position, velocity))
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
      const nextMembrane = Math.max(0, entity.membrane - sample.damage)
      entities.set(entity.id, { ...entity, membrane: nextMembrane, status: nextMembrane === 0 ? 'ruptured' : entity.status })
      events.push({
        type: 'damaged',
        targetId: entity.id,
        amount: sample.damage,
        source: environmentId === 'env-antibody-storm' ? 'electric' : 'acid',
        atMs: elapsedMs,
      })
      lastDamageAt = elapsedMs
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
    routeEntryGuardUntilMs = elapsedMs + 1000
    region = offsetGeneratedRegion(generateRegion(options.seed, environmentId), environmentEnteredAtMs)
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
      if (entity.faction !== 'player') entities.delete(id)
    }
    spawnDue(elapsedMs)
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

  function perceptionFor(
    currentPlayer: EntityState,
    overrides: Partial<Pick<OrganPerception, 'sameDirectionMs' | 'collisionStrength' | 'incomingDamage' | 'incomingFatalDamage' | 'containmentRatio'>>,
  ): OrganPerception {
    const maxSpeed = 'maxSpeed' in currentPlayer ? Number(currentPlayer.maxSpeed) : 52
    const nearbyHostiles = [...entities.values()].filter((entity) => entity.status === 'active' && entity.faction === 'hostile')
    const cooldownRemainingMs = Object.fromEntries(installedOrganelles.map((organ) => [
      organ.id,
      Math.max(0, (organReadyAt.get(organ.id) ?? 0) - elapsedMs),
    ])) as OrganPerception['cooldownRemainingMs']
    const incomingDamage = overrides.incomingDamage ?? 0
    const containmentThreat = nearbyHostiles
      .map((hostile) => ({ hostile, containment: containmentProgress(hostile, currentPlayer) }))
      .sort((first, second) => second.containment - first.containment)[0]
    return {
      atMs: elapsedMs,
      containmentRatio: overrides.containmentRatio ?? nearbyHostiles.reduce(
        (maximum, hostile) => Math.max(maximum, containmentProgress(hostile, currentPlayer)),
        0,
      ),
      hostileCount: nearbyHostiles.filter((hostile) => distanceBetween(hostile, currentPlayer) <= 240).length,
      speedRatio: Math.hypot(currentPlayer.velocity.x, currentPlayer.velocity.y) / Math.max(1, maxSpeed),
      sameDirectionMs: overrides.sameDirectionMs ?? sameDirectionMs,
      msSinceDamage: elapsedMs - lastDamageAt,
      membraneMax: playerDefinition.membrane,
      collisionStrength: overrides.collisionStrength ?? 0,
      incomingFatalDamage: overrides.incomingFatalDamage ?? incomingDamage >= currentPlayer.membrane,
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
      .filter((entity) => entity.faction === 'hostile' && containmentProgress(entity, currentPlayer) >= 0.96)
      .sort((first, second) => containmentProgress(second, currentPlayer) - containmentProgress(first, currentPlayer))[0]
    entities.delete(PLAYER_ID)
    activeSwarm = result.children.map((child, index) => ({
      ...child,
      id: index === 0 ? PLAYER_ID : child.id,
      position: fatalThreat ? splitEscapePosition(fatalThreat, child.mass, index, result.children.length) : child.position,
    }))
    for (const child of activeSwarm) {
      entities.set(child.id, resizeBodyToMass({
        ...currentPlayer,
        id: child.id,
        position: { ...child.position },
        velocity: { ...child.velocity },
        mass: child.mass,
        membrane: child.membrane,
        energy: child.energy,
        status: child.status,
      }))
    }
    captureLiveMorphology()
    swarmStableMs = 0
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
      const velocity = body.velocity
      const proposed = {
        x: clamp(body.position.x + fieldSample.flow.x * 24 * seconds, entity.body.radius, environment.width - entity.body.radius),
        y: clamp(body.position.y + fieldSample.flow.y * 24 * seconds, entity.body.radius, environment.height - entity.body.radius),
      }
      const position = resolveEnvironmentMovement(environmentField, entity.position, proposed, entity.body.radius)
      entities.set(body.id, moveEntity(entity, position, velocity))
      return { ...body, position, velocity }
    })
  }

  function stepFusion(stepMs: number) {
    if (!activeSwarm) return
    const proximity = 36
    swarmStableMs = advanceFusionStability(activeSwarm, swarmStableMs, stepMs, proximity)
    const fused = tryFuse(activeSwarm, { proximity, stableForMs: swarmStableMs, requiredStableMs: 900 })
    if (!fused) return
    const template = entities.get(PLAYER_ID) ?? entities.get(activeSwarm[0].id)
    if (!template) return
    for (const body of activeSwarm) entities.delete(body.id)
    entities.set(PLAYER_ID, resizeBodyToMass({
      ...template,
      id: PLAYER_ID,
      position: fused.position,
      velocity: fused.velocity,
      mass: fused.mass,
      membrane: fused.membrane,
      energy: fused.energy,
      status: fused.status,
    }))
    installedOrganelles = fused.organelles
    activeSwarm = undefined
    swarmStableMs = 0
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
      events.push({ type: 'player-died', cause: 'all-split-bodies-lost', atMs: elapsedMs })
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
        const configuredDamage = contactDamageForPair(first, second, elapsedMs, damagePeriods)
        let blockedAmount = 0
        const pairPlayer = first.faction === 'player' ? first : second.faction === 'player' ? second : undefined
        const pairThreat = pairPlayer === first ? second : first
        if (pairPlayer && installedOrganelles.length > 0) {
          const incomingDamage = configuredDamage?.damage.targetId === pairPlayer.id ? configuredDamage.damage.amount : 0
          const passive = applyOrganEffects(evaluatePassiveOrgans(
            evolvedPlayer(pairPlayer),
            perceptionFor(pairPlayer, {
              containmentRatio: pairThreat.faction === 'hostile' ? containmentProgress(pairThreat, pairPlayer) : 0,
              collisionStrength: incomingDamage,
              incomingDamage,
            }),
          ))
          blockedAmount = passive.blockedAmount
          if (passive.splitTriggered) continue
          first = entities.get(first.id)
          second = entities.get(second.id)
          if (!first || !second) continue
        }
        const result = resolveInteraction(first, second, {
          atMs: elapsedMs,
          engulfLocks,
          ruptureLossFraction: 0.08,
          contactDamage: configuredDamage ? { ...configuredDamage.damage, blockedAmount } : undefined,
        })
        entities.set(result.entities[0].id, resizeForMass(result.entities[0]))
        entities.set(result.entities[1].id, resizeForMass(result.entities[1]))
        if (first.faction === 'player' || second.faction === 'player') {
          peakBiomass = Math.max(peakBiomass, [...entities.values()]
            .filter((current) => current.faction === 'player' && current.status === 'active')
            .reduce((sum, current) => sum + current.mass, 0))
          captureLiveMorphology()
        }
        result.fragments.forEach(enqueueEntity)
        events.push(...result.events)
        const engulfed = result.events.find((event) => event.type === 'engulfed')
        if (engulfed) {
          const predator = engulfed.predatorId === first.id ? first : second
          if (predator.faction === 'player') rechargeGuard(predator.id)
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
        if (pairPlayer && result.events.some((event) => event.type === 'damaged' && event.targetId === pairPlayer.id)) lastDamageAt = elapsedMs
        if (configuredDamage && result.events.some((event) => event.type === 'damaged' && event.targetId === configuredDamage.damage.targetId)) {
          damagePeriods.set(configuredDamage.lockKey, configuredDamage.periodIndex)
        }
        if (!activeSwarm && result.events.some((event) => (
          event.type === 'engulfed' && event.preyId === PLAYER_ID
          || event.type === 'ruptured' && event.targetId === PLAYER_ID
        ))) {
          events.push({ type: 'player-died', cause: 'engulfed-or-ruptured', atMs: elapsedMs })
        }
      }
    })
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

function getPlayerDefinition(originId: string, environment: EngineEnvironment): PlayerDefinition {
  if (environment.playerDefinition.id === originId) return environment.playerDefinition
  const definition = (content.m0.playerDefinitions as PlayerDefinition[]).find((item) => item.id === originId)
  if (!definition) throw new RangeError(`Unknown player definition id: ${originId}`)
  return definition
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

function containmentProgress(predator: EntityState, prey: EntityState): number {
  if (predator.body.radius <= prey.body.radius) return 0
  const uncoveredDistance = distanceBetween(predator, prey) + prey.body.radius - predator.body.radius
  return clamp(1 - Math.max(0, uncoveredDistance) / Math.max(1, prey.body.radius * 2), 0, 1)
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
