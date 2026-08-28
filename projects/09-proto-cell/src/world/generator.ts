import content from '../content/content.json'
import { createRng } from '../domain/rng'
import { createEntity, type EntityDefinition, type SpawnedEntityState } from '../entities/factory'

type M0Environment = {
  id: string
  width: number
  height: number
  entityDefinitions: EntityDefinition[]
  spawnSchedule: Array<{ atMs: number; definitionId: string; count: number }>
}

export type GeneratedRegion = {
  seed: number
  environmentId: string
  width: number
  height: number
  entities: readonly SpawnedEntityState[]
  spawnSchedule: ReadonlyArray<{ atMs: number; entityId: string }>
  routeRifts: readonly RouteRift[]
}

export type RouteRift = {
  id: string
  destinationEnvironmentId: string
  position: { x: number; y: number }
  radius: number
  opensAtMs: number
  hazardId: string
  resourceId: string
  affinityIconId: string
}

export function findEnteredRouteRift(
  routeRifts: readonly RouteRift[],
  player: { position: { x: number; y: number }; radius: number },
  elapsedMs: number,
  selectedRouteId?: string,
): RouteRift | undefined {
  if (selectedRouteId) return undefined
  return routeRifts.find((rift) => (
    elapsedMs >= rift.opensAtMs
    && Math.hypot(player.position.x - rift.position.x, player.position.y - rift.position.y) <= player.radius + rift.radius
  ))
}

export function generateRegion(seed: number, environmentId: string): GeneratedRegion {
  const environments = content.m0.environments as M0Environment[]
  const environment = environments.find((item) => item.id === environmentId)
  if (!environment) throw new RangeError(`Unknown environment id: ${environmentId}`)

  const definitions = new Map(environment.entityDefinitions.map((definition) => [definition.id, definition]))
  const rng = createRng(seed).fork(environmentId)
  const entities: SpawnedEntityState[] = []
  const spawnSchedule: Array<{ atMs: number; entityId: string }> = []
  const routeRng = rng.fork('route-rifts')

  for (const scheduled of environment.spawnSchedule) {
    const definition = definitions.get(scheduled.definitionId)
    if (!definition) throw new RangeError(`Unknown entity definition id: ${scheduled.definitionId}`)

    for (let count = 0; count < scheduled.count; count += 1) {
      const index = entities.length
      const id = `${environmentId}-${seed}-${index}`
      const margin = definition.radius + 12
      const position = {
        x: margin + rng.next() * (environment.width - margin * 2),
        y: margin + rng.next() * (environment.height - margin * 2),
      }
      entities.push(createEntity(definition, { id, position }))
      spawnSchedule.push({ atMs: scheduled.atMs, entityId: id })
    }
  }

  return {
    seed,
    environmentId,
    width: environment.width,
    height: environment.height,
    entities,
    spawnSchedule,
    routeRifts: content.m1.routeRifts.map((rift, index) => ({
      ...rift,
      radius: 26,
      position: {
        x: index === 0 ? 72 + routeRng.next() * 84 : environment.width - 156 + routeRng.next() * 84,
        y: 72 + routeRng.next() * 130,
      },
    })),
  }
}
