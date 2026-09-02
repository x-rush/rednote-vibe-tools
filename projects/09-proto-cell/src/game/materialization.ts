import type { EntityState, Vec2 } from '../domain/types'
import type { MovementIntent } from './input'

export type SpawnPresentationConfig = {
  foodMaterializeMs: number
  neutralMaterializeMs: number
  threatApproachSpeedRatio: number
  threatSpawnDistance: number
  threatDiscoveryDistance: number
  threatAlertMs: number
}

export function materializeSpawn(
  entity: EntityState,
  atMs: number,
  config: SpawnPresentationConfig,
): EntityState {
  if (entity.faction === 'player' || entity.role === 'boss') return entity
  if (entity.faction === 'hostile') {
    return {
      ...entity,
      velocity: { x: 0, y: 0 },
      spawnedAtMs: atMs,
      materializingUntilMs: undefined,
      arrivalPhase: 'approach',
      behaviorState: 'approach',
      arrivalReleaseUntilMs: undefined,
    }
  }
  const duration = entity.role === 'nutrient' || entity.role === 'prey'
    ? config.foodMaterializeMs
    : config.neutralMaterializeMs
  return {
    ...entity,
    velocity: { x: 0, y: 0 },
    spawnedAtMs: atMs,
    materializingUntilMs: atMs + duration,
  }
}

export function isMaterializing(entity: EntityState, atMs: number): boolean {
  return entity.materializingUntilMs !== undefined && atMs < entity.materializingUntilMs
}

export function stepThreatArrival(
  entity: EntityState,
  playerPosition: Vec2 | undefined,
  atMs: number,
  config: SpawnPresentationConfig,
): { entity: EntityState; intent?: MovementIntent; speedRatio?: number; stationary: boolean } | undefined {
  if (!entity.arrivalPhase) {
    if (entity.arrivalReleaseUntilMs !== undefined && atMs < entity.arrivalReleaseUntilMs) {
      return { entity, speedRatio: 0.68, stationary: false }
    }
    return undefined
  }
  if (entity.arrivalPhase === 'alert') {
    if (atMs < (entity.alertedAtMs ?? atMs) + config.threatAlertMs) {
      return { entity: { ...entity, velocity: { x: 0, y: 0 }, behaviorState: 'alert' }, stationary: true }
    }
    const { arrivalPhase: _arrivalPhase, alertedAtMs: _alertedAtMs, ...active } = entity
    return {
      entity: { ...active, behaviorState: undefined, arrivalReleaseUntilMs: atMs + 240 },
      speedRatio: 0.68,
      stationary: false,
    }
  }

  if (playerPosition && Math.hypot(entity.position.x - playerPosition.x, entity.position.y - playerPosition.y) <= config.threatDiscoveryDistance) {
    return {
      entity: { ...entity, velocity: { x: 0, y: 0 }, arrivalPhase: 'alert', alertedAtMs: atMs, behaviorState: 'alert' },
      stationary: true,
    }
  }

  return {
    entity: { ...entity, behaviorState: 'approach' },
    intent: patrolIntent(entity.id, atMs),
    speedRatio: config.threatApproachSpeedRatio,
    stationary: false,
  }
}

export function isThreatArrivalInactive(entity: EntityState): boolean {
  return entity.arrivalPhase === 'approach' || entity.arrivalPhase === 'alert'
}

function patrolIntent(id: string, atMs: number): MovementIntent {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 31)
  const segment = Math.floor(atMs / 2400)
  const angle = (((hash ^ Math.imul(segment, 2_654_435_761)) >>> 0) / 4_294_967_296) * Math.PI * 2
  return { direction: { x: Math.cos(angle), y: Math.sin(angle) }, strength: 1 }
}
