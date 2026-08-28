import content from '../content/content.json'
import type { EntityState, Vec2 } from '../domain/types'
import { decideIntent } from '../entities/ai'
import { createEntity, type ContactDamageDefinition, type EntityDefinition } from '../entities/factory'
import { generateRegion } from '../world/generator'
import { createFixedClock } from './clock'
import { createPointerInput, type PointerInput } from './input'
import { resolveInteraction, type GameEvent } from './interactions'
import { SpatialGrid } from './spatial-grid'
import type { MutationInstallResult } from '../evolution/mutation'
import { evaluatePassiveOrgans, type EvolvedEntityState, type InstalledOrganelle, type OrganEffect, type OrganPerception } from '../evolution/organs'
import { advanceFusionStability, splitBody, stepSwarm, tryFuse, type SwarmBody } from '../evolution/split'

export type PauseReason = 'user' | 'visibility' | 'evolution'

export type HudSnapshot = {
  membrane: number
  energy: number
  stability: number
  biomass: number
  evolutionThreshold: number
  elapsedMs: number
  environmentId: string
  paused: boolean
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
}

export type ProtoCellEngine = GameEngine & {
  input: PointerInput
  renderSnapshot(): WorldRenderSnapshot
  applyMutation(result: MutationInstallResult): void
  evolutionSnapshot(): { organelles: readonly InstalledOrganelle[]; capacity: number; stability: number }
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
}

const STEP_MS = 1000 / 60
const PLAYER_ID = 'player'
const ACCELERATION_RESPONSE_SECONDS = 0.18
const DRIFT_RESPONSE_SECONDS = 0.32
export const CONTACT_DAMAGE_ARM_MS = 420

export function createGameEngine(options: {
  seed: number
  environmentId?: string
  input?: PointerInput
}): ProtoCellEngine {
  const environmentId = options.environmentId ?? 'env-clear-drop'
  const environment = getEnvironment(environmentId)

  const region = generateRegion(options.seed, environmentId)
  const scheduleAt = new Map(region.spawnSchedule.map((entry) => [entry.entityId, entry.atMs]))
  const regionById = new Map(region.entities.map((entity) => [entity.id, entity]))
  const player = createEntity(environment.playerDefinition, {
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
  let elapsedMs = 0
  let interpolationAlpha = 0
  let started = false
  let destroyed = false
  let mutationPending = false
  let evolutionThreshold = environment.playerDefinition.evolutionThreshold
  let playerStability = environment.playerDefinition.stability
  let installedOrganelles: InstalledOrganelle[] = []
  let organCapacity = 6
  const organReadyAt = new Map<string, number>()
  const organEventReadyAt = new Map<string, number>()
  let lastDamageAt = Number.NEGATIVE_INFINITY
  let sameDirectionMs = 0
  let previousInputDirection: Vec2 = { x: 0, y: 0 }
  let activeSwarm: SwarmBody[] | undefined
  let swarmStableMs = 0

  spawnDue(0)

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
      return {
        membrane: activeSwarm ? playerBodies.reduce((sum, body) => sum + body.membrane, 0) : currentPlayer.membrane,
        energy: activeSwarm ? playerBodies.reduce((sum, body) => sum + body.energy, 0) : currentPlayer.energy,
        stability: playerStability,
        biomass: playerBodies.reduce((sum, body) => sum + body.mass, 0),
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
      evolutionThreshold = Math.ceil(evolutionThreshold * environment.playerDefinition.evolutionThresholdGrowth)
      mutationPending = false
    },
    evolutionSnapshot() {
      return {
        organelles: installedOrganelles,
        capacity: organCapacity,
        stability: playerStability,
      }
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
    elapsedMs += stepMs
    spawnDue(elapsedMs)
    rebuildGrid()
    const passive = stepEvolution(stepMs)
    moveEntities(stepMs, passive.speedMultiplier)
    stepFusion(stepMs)
    rebuildGrid()
    resolveNearbyInteractions()
    syncActiveSwarm(true)

    const playerMass = [...entities.values()]
      .filter((entity) => entity.faction === 'player' && entity.status === 'active')
      .reduce((sum, entity) => sum + entity.mass, 0)
    if (playerMass > 0 && !mutationPending && playerMass >= evolutionThreshold) {
      events.push({ type: 'mutation-ready', entityId: PLAYER_ID, atMs: elapsedMs })
      mutationPending = true
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
      const intent = entity.id === PLAYER_ID
        ? input.snapshot()
        : decideIntent(entity, {
            nearby: grid.query({
              x: entity.position.x - 240,
              y: entity.position.y - 240,
              width: 480,
              height: 480,
            }),
          })
      const maxSpeed = ('maxSpeed' in entity ? Number(entity.maxSpeed) : 52) * (entity.id === PLAYER_ID ? speedMultiplier : 1)
      const desiredVelocity = {
        x: intent.direction.x * intent.strength * maxSpeed,
        y: intent.direction.y * intent.strength * maxSpeed,
      }
      const responseSeconds = intent.strength > 0 ? ACCELERATION_RESPONSE_SECONDS : DRIFT_RESPONSE_SECONDS
      const blend = 1 - Math.exp(-seconds / responseSeconds)
      const velocity = {
        x: entity.velocity.x + (desiredVelocity.x - entity.velocity.x) * blend,
        y: entity.velocity.y + (desiredVelocity.y - entity.velocity.y) * blend,
      }
      const position = {
        x: clamp(entity.position.x + velocity.x * seconds, entity.body.radius, environment.width - entity.body.radius),
        y: clamp(entity.position.y + velocity.y * seconds, entity.body.radius, environment.height - entity.body.radius),
      }
      entities.set(entity.id, moveEntity(entity, position, velocity))
    }
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
      membraneMax: environment.playerDefinition.membrane,
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
          membrane: Math.min(environment.playerDefinition.membrane, currentPlayer.membrane + (effect.amount ?? 0)),
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
    swarmStableMs = 0
    return true
  }

  function moveActiveSwarm(stepMs: number, speedMultiplier: number) {
    if (!activeSwarm) return
    activeSwarm = stepSwarm(activeSwarm, input.snapshot(), stepMs, speedMultiplier).map((body) => {
      const entity = entities.get(body.id)
      if (!entity) return body
      const position = {
        x: clamp(body.position.x, entity.body.radius, environment.width - entity.body.radius),
        y: clamp(body.position.y, entity.body.radius, environment.height - entity.body.radius),
      }
      entities.set(body.id, moveEntity(entity, position, body.velocity))
      return { ...body, position }
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
      activeSwarm = survivors
      installedOrganelles = survivors.flatMap((body) => body.organelles)
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
        result.fragments.forEach(enqueueEntity)
        events.push(...result.events)
        const engulfed = result.events.find((event) => event.type === 'engulfed')
        if (engulfed) {
          const predator = engulfed.predatorId === first.id ? first : second
          if (predator.faction === 'player') rechargeGuard(predator.id)
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
  const environment = (content.m0.environments as EngineEnvironment[]).find((item) => item.id === environmentId)
  if (!environment) throw new RangeError(`Unknown environment id: ${environmentId}`)
  return environment
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
