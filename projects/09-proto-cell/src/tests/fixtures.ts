import type { BodyShape, EntityState, Vec2 } from '../domain/types'
import type { InteractionContext } from '../game/interactions'
import { createGameEngine, type ProtoCellEngine } from '../game/engine'
import type { ControllerDependencies } from '../app/controller'
import { getContent, type BossId, type ContentPack } from '../content'
import type { EvolvedEntityState, OrganPerception } from '../evolution/organs'
import type { MutationContext } from '../evolution/mutation'
import type { EventContext } from '../world/events'
import { createBoss, type BossPath, type BossState } from '../world/bosses'
import type { GameEvent } from '../game/interactions'
import type { LifeEventLogEntry } from '../progression/archive'
import type { SaveDataV1 } from '../storage/codec'
import type { IndexedDbDriver, SettingsStorage } from '../storage/repository'
import { encodeDishCode } from '../progression/challenges'

export function vec(x: number, y: number): Vec2 {
  return { x, y }
}

export function circleBody(center: Vec2, radius: number): BodyShape {
  return {
    center: { ...center },
    radius,
    contour: Array.from({ length: 24 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      }
    }),
  }
}

export function entity(id: string, radius: number, position: Vec2 = { x: 0, y: 0 }): EntityState {
  return {
    id,
    body: circleBody(position, radius),
    position: { ...position },
    velocity: { x: 0, y: 0 },
    mass: radius * radius,
    membrane: radius,
    energy: radius,
    faction: id === 'large' ? 'player' : 'neutral',
    role: id === 'large' ? 'player' : 'prey',
    status: 'active',
  }
}

export function entityAt(id: string, x: number, y: number): EntityState {
  return entity(id, 5, { x, y })
}

export function testInteractionContext(overrides: Partial<InteractionContext> = {}): InteractionContext {
  return {
    atMs: 100,
    engulfLocks: new Set<string>(),
    ruptureLossFraction: 0,
    ...overrides,
  }
}

export function createTestEngine(): ProtoCellEngine {
  const engine = createGameEngine({ seed: 727, environmentId: 'env-clear-drop' })
  engine.start()
  return engine
}

export function testDependencies(): ControllerDependencies {
  return {
    createEngine: ({ seed }) => createGameEngine({ seed, environmentId: 'env-clear-drop' }),
    nextSeed: (seed) => seed + 1,
    recordResult: () => undefined,
  }
}

export function contentFixture(): ContentPack {
  return structuredClone(getContent())
}

export function testContent(): ContentPack {
  return contentFixture()
}

export function eventLog(events: readonly GameEvent[]): LifeEventLogEntry[] {
  return events.map((event, index) => ({ sequence: index + 1, event: { ...event } }))
}

export function saveFixture(overrides: { extra?: unknown; archiveCount?: number } = {}): SaveDataV1 & Record<string, unknown> {
  const archiveCount = overrides.archiveCount ?? 1
  const value: SaveDataV1 & Record<string, unknown> = {
    schemaVersion: 1,
    contentVersion: getContent().contentVersion,
    settings: { music: true, sfx: true, reducedMotion: false, reducedFlash: false, lowParticles: false, reducedShake: false, graphics: 'balanced' },
    progression: { genePoints: 0, unlockedIds: ['origin-primal-cell'], discoveredSynergyIds: [], completedModifierIds: [], rewardCounts: {} },
    codex: { 'creature-drifter': 'seen' },
    records: { bestSurvivalMs: 0, bestEnvironmentOrder: 0, maxBiomass: 144, dailySeeds: { '2026-08-28': 727 } },
    lifeArchives: Array.from({ length: archiveCount }, (_, index) => ({
      speciesNameSeed: index,
      survivalMs: index * 1000,
      farthestEnvironmentId: 'env-clear-drop',
      maxBiomass: 144 + index,
      keyOrganelleIds: [],
      synergyIds: [],
      deathTemplateId: 'death-engulfed',
      dishCode: encodeDishCode({ seed: index, contentVersion: getContent().contentVersion, route: ['env-algae-glow', 'env-fiber-maze'] }),
    })),
  }
  if ('extra' in overrides) value.extra = overrides.extra
  return value
}

export function failingIndexedDb(): IndexedDbDriver {
  const unavailable = () => Promise.reject(Object.assign(new Error('storage unavailable'), {
    name: 'UnavailableError',
    recoveryPayload: saveFixture(),
  }))
  return { open: unavailable, read: unavailable, write: unavailable, clear: unavailable }
}

export function memoryIndexedDb(): IndexedDbDriver & { value(store: string, key: string): unknown } {
  const stores = new Map<string, Map<string, unknown>>()
  const store = (name: string) => {
    const existing = stores.get(name)
    if (existing) return existing
    const created = new Map<string, unknown>()
    stores.set(name, created)
    return created
  }
  return {
    open: async () => undefined,
    read: async (storeName, key) => structuredClone(store(storeName).get(key)),
    write: async (storeName, key, value) => { store(storeName).set(key, structuredClone(value)) },
    clear: async (storeName) => { store(storeName).clear() },
    value: (storeName, key) => store(storeName).get(key),
  }
}

export function memorySettingsStorage(): SettingsStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

export function playerWith(
  organInput: string | string[],
  overrides: Partial<Omit<EvolvedEntityState, 'installedOrganelles'>> = {},
): EvolvedEntityState {
  const organIds = (Array.isArray(organInput) ? organInput : [organInput]) as Array<ContentPack['organelles'][number]['id']>
  const base = entity('large', 12)
  return {
    ...base,
    mass: 144,
    membrane: 100,
    energy: 100,
    stability: 100,
    installedOrganelles: organIds.map((id) => {
      const definition = getContent().organelles.find((item) => item.id === id)
      if (!definition) throw new RangeError(`Unknown organ id: ${id}`)
      return {
        id,
        stage: 'installed' as const,
        anchor: definition.slots[0],
        charges: definition.behaviorId === 'fatal-hit-guard' ? 1 : undefined,
      }
    }),
    ...overrides,
  }
}

export function perception(overrides: Partial<OrganPerception> = {}): OrganPerception {
  return {
    atMs: 5000,
    containmentRatio: 0,
    hostileCount: 0,
    speedRatio: 0,
    sameDirectionMs: 0,
    msSinceDamage: 5000,
    membraneMax: 100,
    collisionStrength: 0,
    incomingFatalDamage: false,
    incomingDamage: 0,
    threatEscapeDirection: { x: -1, y: 0 },
    cooldownRemainingMs: {},
    ...overrides,
  }
}

export function mutationContext(overrides: Partial<MutationContext> = {}): MutationContext {
  const organIds = overrides.organIds ?? []
  const matureOrganIds = overrides.matureOrganIds ?? []
  const installed = overrides.installed ?? organIds.map((id) => {
    const definition = getContent().organelles.find((item) => item.id === id)
    if (!definition) throw new RangeError(`Unknown organ id: ${id}`)
    return {
      id,
      stage: matureOrganIds.includes(id) ? 'mature' as const : 'installed' as const,
      anchor: definition.slots[0],
      charges: definition.behaviorId === 'fatal-hit-guard' ? matureOrganIds.includes(id) ? 2 : 1 : undefined,
    }
  })
  return {
    environmentId: 'env-clear-drop',
    organIds,
    matureOrganIds,
    installed,
    stability: 100,
    capacity: 6,
    ...overrides,
  }
}

export function eventContext(overrides: Partial<EventContext> = {}): EventContext {
  return {
    seed: 727,
    environmentId: 'env-clear-drop',
    atMs: 90_000,
    center: { x: 320, y: 540 },
    ...overrides,
  }
}

export function m1BossState(path: BossPath): BossState {
  const state = createBoss('boss-membrane-queen', { seed: 727, atMs: 240_000 })
  if (path === 'combat') return { ...state, phase: 'enraged', outerMembrane: 0, coreIntegrity: 0, resolutionCandidate: path }
  if (path === 'environment') return { ...state, phase: 'exposed', hazardOverlapMs: 2200, validationHazardId: 'hazard-acid-fringe', resolutionCandidate: path }
  return { ...state, phase: 'feeding', territoryCrossed: true, playerEscaped: true, lockRatio: 0.4, peakLockRatio: 0.4, resolutionCandidate: path }
}

export function bossFixture(bossId: BossId, path: BossPath): BossState {
  const state = createBoss(bossId, { seed: 727, atMs: 0 })
  const definition = getContent().bosses.find((item) => item.id === bossId)
  if (!definition || !definition.resolutionPaths.includes(path)) throw new RangeError(`Unsupported boss path: ${bossId}:${path}`)
  if (path === 'combat') return { ...state, phase: 'resolved', outerMembrane: 0, coreIntegrity: 0, resolutionCandidate: path }
  if (path === 'environment') return {
    ...state,
    phase: 'resolved',
    hazardOverlapMs: definition.rules.hazardHoldMs,
    validationHazardId: definition.rules.environmentHazardIds[0],
    resolutionCandidate: path,
  }
  if (path === 'parasite') return { ...state, phase: 'resolved', outerMembrane: 0, parasiteAttachedMs: definition.rules.parasiteHoldMs, resolutionCandidate: path }
  return { ...state, phase: 'resolved', territoryCrossed: true, playerEscaped: true, peakLockRatio: definition.rules.stealthLockMax, resolutionCandidate: path }
}
