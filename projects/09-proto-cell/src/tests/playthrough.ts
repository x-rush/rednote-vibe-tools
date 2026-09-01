import type { GameEvent } from '../game/interactions'
import { createGameEngine } from '../game/engine'
import { continueMutationContext, createMutationContext, installMutation, offerMutations, type MutationChoice } from '../evolution/mutation'
import { getContent, type ContentPack, type EnvironmentId } from '../content'
import type { LifeEventLogEntry } from '../progression/archive'
import { deriveLifeArchive } from '../progression/archive'
import { resolveBossPath, stepBoss, type BossState } from '../world/bosses'

export type HeadlessRunOptions = {
  seed: number
  durationMs?: number
  route?: readonly string[]
  policy?: 'balanced' | 'speed' | 'armor' | 'stealth' | 'parasite' | 'swarm'
}

export type HeadlessRunReport = {
  keyEvents: readonly GameEvent[]
  simulatedMs: number
  maxEntities: number
  invalidNumbers: readonly string[]
  morphologySignature: string
  endingId?: string
  routeSignature: string
}

export type OutcomeFixture = { expectedId: string; events: readonly LifeEventLogEntry[] }
export type OutcomeAudit = { missingEndingIds: string[]; missingDeathIds: string[] }

const STEP_BATCH_MS = 5 * 1000 / 60

export function runHeadless(options: HeadlessRunOptions): HeadlessRunReport {
  const durationMs = options.durationMs ?? 600_000
  const policy = options.policy ?? 'balanced'
  const engine = createGameEngine({ seed: options.seed, environmentId: 'env-clear-drop', route: options.route })
  const keyEvents: GameEvent[] = []
  const invalidNumbers = new Set<string>()
  let maxEntities = 0
  let endingId: string | undefined
  let consumed = 0
  let simulatedMs = 0
  let terminal = false
  let mutationCount = 0
  let mutationContext = createMutationContext('env-clear-drop')
  const resolvedBossIds = new Set<string>()
  const acceleratedRiftIds = new Set<string>()

  engine.start()
  engine.input.start({ x: 0, y: 0 })
  while (simulatedMs + 0.000_001 < durationMs) {
    keepAuditPlayerAlive(engine)
    if (options.route) driveRoute(engine, acceleratedRiftIds)
    if (options.route) resolveVisibleBoss(engine, policy, resolvedBossIds)
    if (options.route && mutationCount < 5 && simulatedMs >= (mutationCount + 1) * 45_000) {
      const player = engine.renderSnapshot().entities.find((entity) => entity.id === engine.renderSnapshot().playerId)
      if (player) player.mass = Math.max(player.mass, engine.snapshot().evolutionThreshold + 1)
    }
    setPolicyIntent(engine, simulatedMs, policy)
    const elapsed = Math.min(STEP_BATCH_MS, durationMs - simulatedMs)
    engine.advance(elapsed)
    const previousSimulatedMs = simulatedMs
    const advancedMs = engine.snapshot().elapsedMs
    if (advancedMs <= previousSimulatedMs && durationMs - previousSimulatedMs > 0) {
      engine.advance(1000 / 60)
    }
    simulatedMs = engine.snapshot().elapsedMs
    if (simulatedMs <= previousSimulatedMs) break

    const events = engine.drainEvents()
    keyEvents.push(...events)
    for (const event of events) {
      if (event.type === 'mutation-ready') {
        const evolution = engine.evolutionSnapshot()
        mutationContext = {
          ...mutationContext,
          environmentId: engine.snapshot().environmentId as EnvironmentId,
          organIds: evolution.organelles.map((organ) => organ.id),
          matureOrganIds: evolution.organelles.filter((organ) => organ.stage === 'mature').map((organ) => organ.id),
          installed: [...evolution.organelles],
          stability: evolution.stability,
          capacity: evolution.capacity,
        }
        const choice = chooseMutation(offerMutations(mutationContext), policy)
        if (choice) {
          const result = installMutation(mutationContext, choice)
          engine.applyMutation(result)
          mutationContext = continueMutationContext(mutationContext, result)
          mutationCount += 1
        }
      }
    }
    consumed += events.filter((event) => event.type === 'engulfed' && event.predatorId === 'player').length
    const ending = events.find((event) => event.type === 'ending-reached')
    if (ending?.type === 'ending-reached') endingId = ending.endingId
    terminal = events.some((event) => event.type === 'ending-reached' || event.type === 'player-died')

    const world = engine.renderSnapshot()
    maxEntities = Math.max(maxEntities, world.entities.length)
    inspectNumbers(engine.snapshot(), world.entities, invalidNumbers)
    if (terminal) break
  }

  const morphology = engine.morphologySnapshot()
  const morphologySignature = [
    morphology.bodyCount,
    morphology.organelles.map((organ) => `${organ.id}:${organ.stage}`).sort().join(','),
    Math.round(morphology.stability / 5) * 5,
    Math.round(morphology.totalMass / 25) * 25,
  ].join(':')
  const completedSimulationMs = Math.min(durationMs, engine.snapshot().elapsedMs)
  engine.destroy()

  return {
    keyEvents,
    simulatedMs: completedSimulationMs,
    maxEntities,
    invalidNumbers: [...invalidNumbers],
    morphologySignature,
    endingId,
    routeSignature: keyEvents.filter((event) => event.type === 'route-selected').map((event) => event.type === 'route-selected' ? event.environmentId : '').join('>'),
  }
}

export function auditOutcomes(content: ContentPack, fixtures: readonly OutcomeFixture[]): OutcomeAudit {
  const archives = fixtures.map((fixture) => deriveLifeArchive(fixture.events, content))
  const foundEndings = new Set(archives.flatMap((archive) => archive.endingId ? [archive.endingId] : []))
  const foundDeaths = new Set(archives.flatMap((archive) => archive.deathTemplateId ? [archive.deathTemplateId] : []))
  return {
    missingEndingIds: content.endings.map((item) => item.id).filter((id) => !foundEndings.has(id)),
    missingDeathIds: content.deathTemplates.map((item) => item.id).filter((id) => !foundDeaths.has(id)),
  }
}

function keepAuditPlayerAlive(engine: ReturnType<typeof createGameEngine>) {
  for (const entity of engine.renderSnapshot().entities) {
    if (entity.faction !== 'player' || entity.status !== 'active') continue
    entity.membrane = Math.max(entity.membrane, 10_000)
    entity.energy = Math.max(entity.energy, 10_000)
    if (entity.body.radius < 50) {
      entity.body = {
        center: { ...entity.position },
        radius: 50,
        contour: Array.from({ length: 24 }, (_, index) => {
          const angle = index / 24 * Math.PI * 2
          return { x: entity.position.x + Math.cos(angle) * 50, y: entity.position.y + Math.sin(angle) * 50 }
        }),
      }
    }
  }
}

function driveRoute(engine: ReturnType<typeof createGameEngine>, acceleratedIds: Set<string>) {
  const world = engine.renderSnapshot()
  const environment = getContent().environments.find((item) => item.id === world.environmentId)
  const boss = engine.worldSnapshot().boss
  const canAccelerateExit = !environment?.bossId || boss?.phase === 'resolved'
  if (canAccelerateExit) {
    for (const candidate of world.routeRifts) {
      const key = `${world.environmentId}:${candidate.id}`
      if (acceleratedIds.has(key)) continue
      Object.assign(candidate, { opensAtMs: Math.min(candidate.opensAtMs, world.elapsedMs + 5000) })
      acceleratedIds.add(key)
    }
  }
  const rift = world.routeRifts.find((candidate) => candidate.opensAtMs <= world.elapsedMs)
  const player = world.entities.find((entity) => entity.id === world.playerId)
  if (!rift || !player) return
  const dx = rift.position.x - player.position.x
  const dy = rift.position.y - player.position.y
  player.position = { ...rift.position }
  player.body = {
    ...player.body,
    center: { ...rift.position },
    contour: player.body.contour.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  }
}

function resolveVisibleBoss(
  engine: ReturnType<typeof createGameEngine>,
  policy: NonNullable<HeadlessRunOptions['policy']>,
  resolvedIds: Set<string>,
) {
  const boss = engine.worldSnapshot().boss
  if (!boss || boss.phase === 'dormant' || boss.phase === 'resolved' || resolvedIds.has(boss.id)) return
  const definition = getContent().bosses.find((item) => item.id === boss.id)
  if (!definition) return
  const preferred = policy === 'parasite' && definition.resolutionPaths.includes('parasite')
    ? 'parasite'
    : policy === 'stealth' && definition.resolutionPaths.includes('stealth')
      ? 'stealth'
      : definition.resolutionPaths.includes('combat') ? 'combat' : definition.resolutionPaths[0]
  const resolved = resolveBossThroughStateMachine(boss, preferred, definition)
  if (!resolveBossPath(resolved).complete) throw new Error(`Boss path did not resolve: ${boss.id}:${preferred}`)
  Object.assign(boss, resolved)
  resolvedIds.add(boss.id)
}

export function resolveBossThroughStateMachine(
  state: BossState,
  path: 'combat' | 'environment' | 'stealth' | 'parasite',
  definition: ContentPack['bosses'][number],
): BossState {
  const atMs = Math.max(state.telegraphEndsAtMs, state.spawnedAtMs) + 1
  if (path === 'combat') {
    const exposed = stepBoss(state, { atMs, outerDamage: state.outerMembraneMax, coreDamage: state.coreIntegrityMax })
    return stepBoss(exposed, { atMs: atMs + 1, coreDamage: state.coreIntegrityMax })
  }
  if (path === 'environment') {
    return stepBoss(state, { atMs, hazardId: definition.rules.environmentHazardIds[0], hazardOverlapMs: definition.rules.hazardHoldMs })
  }
  if (path === 'stealth') {
    return stepBoss(state, { atMs, territoryCrossed: true, playerEscaped: true, lockRatio: definition.rules.stealthLockMax })
  }
  const exposed = stepBoss(state, { atMs, outerDamage: state.outerMembraneMax })
  return stepBoss(exposed, { atMs: atMs + 1, parasiteAttachedMs: definition.rules.parasiteHoldMs })
}

function chooseMutation(choices: readonly MutationChoice[], policy: NonNullable<HeadlessRunOptions['policy']>): MutationChoice | undefined {
  const content = getContent()
  const desired = policy === 'speed' ? ['move']
    : policy === 'armor' ? ['defend', 'metabolism']
      : policy === 'stealth' ? ['sense', 'defend']
        : policy === 'parasite' ? ['feed', 'attack']
          : policy === 'swarm' ? ['reproduce', 'symbiosis']
            : ['metabolism', 'move', 'feed']
  return [...choices].sort((left, right) => {
    const leftOrgan = content.organelles.find((item) => item.id === left.organId)
    const rightOrgan = content.organelles.find((item) => item.id === right.organId)
    const leftScore = leftOrgan ? desired.indexOf(leftOrgan.category) : -1
    const rightScore = rightOrgan ? desired.indexOf(rightOrgan.category) : -1
    return (leftScore < 0 ? 99 : leftScore) - (rightScore < 0 ? 99 : rightScore) || right.resultingStability - left.resultingStability
  })[0]
}

function setPolicyIntent(
  engine: ReturnType<typeof createGameEngine>,
  elapsedMs: number,
  policy: NonNullable<HeadlessRunOptions['policy']>,
) {
  const policyOffset = ['balanced', 'speed', 'armor', 'stealth', 'parasite', 'swarm'].indexOf(policy) * 0.47
  const angle = elapsedMs / 4200 + policyOffset
  engine.input.move(
    { x: Math.cos(angle) * 120, y: Math.sin(angle) * 120 },
  )
}

function inspectNumbers(
  hud: ReturnType<ReturnType<typeof createGameEngine>['snapshot']>,
  entities: ReturnType<ReturnType<typeof createGameEngine>['renderSnapshot']>['entities'],
  issues: Set<string>,
) {
  for (const [key, value] of Object.entries(hud)) {
    if (typeof value === 'number' && !Number.isFinite(value)) issues.add(`hud.${key}`)
  }
  for (const entity of entities) {
    for (const [key, value] of Object.entries({
      x: entity.position.x,
      y: entity.position.y,
      radius: entity.body.radius,
      mass: entity.mass,
      membrane: entity.membrane,
      energy: entity.energy,
    })) {
      if (!Number.isFinite(value)) issues.add(`entity.${entity.id}.${key}`)
    }
  }
}
