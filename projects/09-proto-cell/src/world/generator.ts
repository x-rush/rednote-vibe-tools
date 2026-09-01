import content from '../content/content.json'
import type { BossResolutionPath, CreatureDefinition, EnvironmentId } from '../content'
import { createRng } from '../domain/rng'
import type { Vec2 } from '../domain/types'
import { createEntity, type EntityDefinition, type SpawnedEntityState } from '../entities/factory'
import { canResolveBossPath } from './bosses'

type M0Environment = {
  id: string
  width: number
  height: number
  playerDefinition: EntityDefinition & { stability: number; evolutionThreshold: number; evolutionThresholdGrowth: number }
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

export function ecologyGroupPositions(input: {
  seed: number
  groupId: string
  center: { x: number; y: number }
  distance: number
  count: number
  width: number
  height: number
  margin: number
  angle?: number
}): Vec2[] {
  const rng = createRng(input.seed).fork(input.groupId)
  const baseAngle = input.angle ?? rng.next() * Math.PI * 2
  return Array.from({ length: input.count }, (_, index) => {
    const spread = (index - (input.count - 1) / 2) * 0.14 + (rng.next() - 0.5) * 0.08
    const distance = input.distance * (0.88 + rng.next() * 0.18)
    return {
      x: Math.min(input.width - input.margin, Math.max(input.margin, input.center.x + Math.cos(baseAngle + spread) * distance)),
      y: Math.min(input.height - input.margin, Math.max(input.margin, input.center.y + Math.sin(baseAngle + spread) * distance)),
    }
  })
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
  const environment = getRegionDefinition(environmentId)

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
    routeRifts: routeDefinitions(environmentId as EnvironmentId).map((rift, index, all) => ({
      ...rift,
      radius: 26,
      position: {
        x: all.length === 1 ? environment.width / 2 : index === 0 ? 72 + routeRng.next() * 84 : environment.width - 156 + routeRng.next() * 84,
        y: 72 + routeRng.next() * 130,
      },
    })),
  }
}

export function getRegionDefinition(environmentId: string): M0Environment {
  const m0 = (content.m0.environments as M0Environment[]).find((item) => item.id === environmentId)
  if (m0) {
    const aliases: Record<string, string> = {
      'nutrient-clear-speck': 'nutrient-sugar',
      'prey-drifter': 'creature-drifter',
      'competitor-spark': 'creature-spark-swarm',
      'scavenger-vesicle': 'creature-vesicle-scavenger',
      'elite-membrane-warden': 'predator-membrane-warden',
    }
    return {
      ...m0,
      entityDefinitions: m0.entityDefinitions.map((definition) => {
        const id = aliases[definition.id] ?? definition.id
        const creature = content.creatures.find((item) => item.id === id)
        return {
          ...definition,
          id,
          behaviorProfileId: (creature?.behaviorProfileId ?? (definition.role === 'nutrient' ? 'behavior-resource' : undefined)) as EntityDefinition['behaviorProfileId'],
        }
      }),
      spawnSchedule: m0.spawnSchedule.map((entry) => ({ ...entry, definitionId: aliases[entry.definitionId] ?? entry.definitionId })),
    }
  }
  const environment = content.environments.find((item) => item.id === environmentId)
  const spawnTable = content.spawnTables.find((item) => item.id === environment?.spawnTableId)
  const playerDefinition = (content.m0.environments as M0Environment[])[0]?.playerDefinition
  if (!environment || !spawnTable || !playerDefinition) throw new RangeError(`Unknown environment id: ${environmentId}`)
  const definitions = spawnTable.entries.map((entry) => {
    const creature = content.creatures.find((item) => item.id === entry.creatureId)
    if (!creature) throw new RangeError(`Unknown creature id: ${entry.creatureId}`)
    return creatureEntityDefinition(creature as CreatureDefinition)
  })
  const nutrient = content.nutrients[environment.order]
  const nutrientDefinition: EntityDefinition | undefined = nutrient ? {
    id: nutrient.id,
    role: 'nutrient',
    faction: 'neutral',
    radius: 6,
    mass: 36,
    membrane: 1,
    energy: 12,
    maxSpeed: 8,
    visualRecipeId: nutrient.visualRecipeId,
  } : undefined
  return {
    id: environment.id,
    width: 640,
    height: 1100,
    playerDefinition,
    entityDefinitions: nutrientDefinition ? [nutrientDefinition, ...definitions] : definitions,
    spawnSchedule: [...(nutrientDefinition ? [{ atMs: 0, definitionId: nutrientDefinition.id, count: 4 }] : []), ...spawnTable.entries.map((entry) => ({
      atMs: entry.minAtMs,
      definitionId: entry.creatureId,
      count: Math.max(2, Math.min(12, Math.round(entry.weight / 4))),
    }))],
  }
}

export function generateRunRoute(seed: number): [EnvironmentId, EnvironmentId, EnvironmentId, EnvironmentId] {
  const rng = createRng(seed).fork('launch-route')
  return [
    'env-clear-drop',
    rng.next() < 0.5 ? 'env-algae-glow' : 'env-acid-vesicle',
    rng.next() < 0.5 ? 'env-fiber-maze' : 'env-antibody-storm',
    'env-abandoned-chamber',
  ]
}

export function analyzeGeneratedRegion(seed: number, environmentId: EnvironmentId): { reachableExitCount: number; entityCount: number } {
  const region = generateRegion(seed, environmentId)
  const reachableExitCount = region.routeRifts.filter((rift) => (
    rift.position.x >= rift.radius
    && rift.position.x <= region.width - rift.radius
    && rift.position.y >= rift.radius
    && rift.position.y <= region.height - rift.radius
  )).length
  const terminalResolutionCount = content.bosses.some((boss) => (
    boss.environmentId === environmentId
    && boss.rewardIds.some((rewardId) => content.endings.some((ending) => ending.id === rewardId))
    && boss.resolutionPaths.some((path) => canResolveBossPath(boss.id as `boss-${string}`, path as BossResolutionPath))
  )) ? 1 : 0
  return { reachableExitCount: reachableExitCount + terminalResolutionCount, entityCount: region.entities.length }
}

function routeDefinitions(environmentId: EnvironmentId): Array<Omit<RouteRift, 'position' | 'radius'>> {
  const opensAtMs = (content.environments.find((item) => item.id === environmentId)?.durationTargetSec[0] ?? 120) * 1000
  const route = (id: string, destinationEnvironmentId: EnvironmentId, hazardId: string, resourceId: string, affinityIconId: string) => ({
    id, destinationEnvironmentId, opensAtMs, hazardId, resourceId, affinityIconId,
  })
  if (environmentId === 'env-clear-drop') return [
    route('route-rift-algae', 'env-algae-glow', 'hazard-current-shear', 'resource-sugar-trail', 'affinity-growth'),
    route('route-rift-acid', 'env-acid-vesicle', 'hazard-acid-fringe', 'resource-mineral-trail', 'affinity-armor'),
  ]
  if (environmentId === 'env-algae-glow' || environmentId === 'env-acid-vesicle') return [
    route(`route-rift-${environmentId.slice(4)}-fiber`, 'env-fiber-maze', 'hazard-fiber-anchor', 'resource-protein-trail', 'affinity-small-body'),
    route(`route-rift-${environmentId.slice(4)}-antibody`, 'env-antibody-storm', 'hazard-antibody-sweep', 'resource-lumen-trail', 'affinity-stealth'),
  ]
  if (environmentId === 'env-fiber-maze' || environmentId === 'env-antibody-storm') return [
    route(`route-rift-${environmentId.slice(4)}-chamber`, 'env-abandoned-chamber', 'hazard-chamber-drain', 'resource-gene-trail', 'affinity-terminal'),
  ]
  return []
}

export function creatureEntityDefinition(creature: CreatureDefinition): EntityDefinition {
  const radius = (creature.sizeRange[0] + creature.sizeRange[1]) / 2
  const hostile = creature.role === 'hunter' || creature.role === 'parasite' || creature.role === 'elite'
  const role = creature.role === 'resource' ? 'nutrient'
    : creature.role === 'swarm' ? 'competitor'
    : creature.role === 'hunter' || creature.role === 'parasite' ? 'predator'
    : creature.role
  return {
    id: creature.id,
    role,
    faction: hostile ? 'hostile' : 'neutral',
    radius,
    mass: Math.round(radius * radius),
    membrane: hostile ? Math.round(radius * 3.2) : Math.max(1, Math.round(radius * 1.4)),
    energy: Math.round(radius * 4),
    maxSpeed: hostile ? 54 : creature.role === 'resource' ? 10 : 48,
    visualRecipeId: creature.visualRecipeId,
    contactDamage: hostile ? { source: creature.role === 'elite' ? 'ram' : 'spine', amount: creature.role === 'elite' ? 12 : 7, periodMs: 1800, activeMs: 260, phaseOffsetMs: 0 } : undefined,
    behaviorProfileId: creature.behaviorProfileId,
  }
}
