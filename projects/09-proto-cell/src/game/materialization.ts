import type { EntityState } from '../domain/types'

export type SpawnPresentationConfig = {
  foodMaterializeMs: number
  neutralMaterializeMs: number
  threatMaterializeMs: number
}

export function materializeSpawn(
  entity: EntityState,
  atMs: number,
  config: SpawnPresentationConfig,
): EntityState {
  if (entity.faction === 'player' || entity.role === 'boss') return entity
  const duration = entity.faction === 'hostile'
    ? config.threatMaterializeMs
    : entity.role === 'nutrient' || entity.role === 'prey'
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
