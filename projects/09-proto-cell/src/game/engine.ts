import content from '../content/content.json'
import type { EntityState, Vec2 } from '../domain/types'
import { decideIntent } from '../entities/ai'
import { createEntity, type ContactDamageDefinition, type EntityDefinition } from '../entities/factory'
import { generateRegion } from '../world/generator'
import { createFixedClock } from './clock'
import { createPointerInput, type PointerInput } from './input'
import { resolveInteraction, type GameEvent } from './interactions'
import { SpatialGrid } from './spatial-grid'

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
}

type PlayerDefinition = EntityDefinition & {
  stability: number
  evolutionThreshold: number
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
  let mutationEmitted = false

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
      const currentPlayer = entities.get(PLAYER_ID) ?? player
      return {
        membrane: currentPlayer.membrane,
        energy: currentPlayer.energy,
        stability: environment.playerDefinition.stability,
        biomass: currentPlayer.mass,
        evolutionThreshold: environment.playerDefinition.evolutionThreshold,
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
    moveEntities(stepMs)
    rebuildGrid()
    resolveNearbyInteractions()

    const currentPlayer = entities.get(PLAYER_ID)
    if (currentPlayer && !mutationEmitted && currentPlayer.mass >= environment.playerDefinition.evolutionThreshold) {
      events.push({ type: 'mutation-ready', entityId: PLAYER_ID, atMs: elapsedMs })
      mutationEmitted = true
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

  function moveEntities(stepMs: number) {
    const seconds = stepMs / 1000
    for (const entity of entities.values()) {
      if (entity.status !== 'active') continue
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
      const maxSpeed = 'maxSpeed' in entity ? Number(entity.maxSpeed) : 52
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

        const first = entities.get(entity.id)
        const second = entities.get(candidate.id)
        if (!first || !second || first.status !== 'active' || second.status !== 'active') continue
        const configuredDamage = contactDamageForPair(first, second, elapsedMs, damagePeriods)
        const result = resolveInteraction(first, second, {
          atMs: elapsedMs,
          engulfLocks,
          ruptureLossFraction: 0.08,
          contactDamage: configuredDamage?.damage,
        })
        entities.set(result.entities[0].id, resizeForMass(result.entities[0]))
        entities.set(result.entities[1].id, resizeForMass(result.entities[1]))
        result.fragments.forEach(enqueueEntity)
        events.push(...result.events)
        if (configuredDamage && result.events.some((event) => event.type === 'damaged' && event.targetId === configuredDamage.damage.targetId)) {
          damagePeriods.set(configuredDamage.lockKey, configuredDamage.periodIndex)
        }
        if (result.events.some((event) => (
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
