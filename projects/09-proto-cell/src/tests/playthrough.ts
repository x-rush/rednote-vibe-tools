import type { GameEvent } from '../game/interactions'
import { createGameEngine } from '../game/engine'
import { getContent, type ContentPack, type EnvironmentId, type ScaleTierDefinition } from '../content'
import type { LifeEventLogEntry } from '../progression/archive'
import { deriveLifeArchive } from '../progression/archive'
import { stepBoss, type BossState } from '../world/bosses'
import { applyEvolution, createBuildState, offerEvolution, type EvolutionOffer } from '../evolution/build'
import { morphologyFor } from '../rendering/morphology'

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
  deathId?: string
  routeSignature: string
  stageSignature: string
  opportunitySignature: string
  behaviorStateCounts: Record<string, number>
  maxActionableGapMs: number
  formSignature: string
}

export function maximumScreenOccupancy(tiers: readonly Pick<ScaleTierDefinition, 'screenDiameterRange'>[], _viewport: { width: number; height: number }): number {
  return tiers.reduce((maximum, tier) => Math.max(maximum, tier.screenDiameterRange[1]), 0)
}

export type OutcomeFixture = { expectedId: string; events: readonly LifeEventLogEntry[] }
export type OutcomeAudit = { missingEndingIds: string[]; missingDeathIds: string[] }

const STEP_BATCH_MS = 5 * 1000 / 60

export function runHeadless(options: HeadlessRunOptions): HeadlessRunReport {
  const durationMs = options.durationMs ?? 600_000
  const policy = options.policy ?? 'balanced'
  const engine = createGameEngine({ seed: options.seed, environmentId: 'env-clear-drop', runOrdinal: 3 })
  const keyEvents: GameEvent[] = []
  const invalidNumbers = new Set<string>()
  let maxEntities = 0
  let endingId: string | undefined
  let consumed = 0
  let simulatedMs = 0
  let terminal = false
  let buildState = createBuildState()
  let recentTraitIds: BuildStateTraitIds = []
  const visitedStages = new Set<number>([1])
  const opportunityIds: string[] = []
  const behaviorStateCounts: Record<string, number> = {}
  let opportunityCueUntilMs = 0
  let lastActionableAtMs = 0
  let maxActionableGapMs = 0

  engine.start()
  engine.input.start({ x: 0, y: 0 })
  while (simulatedMs + 0.000_001 < durationMs) {
    keepAuditPlayerAlive(engine)
    const run = engine.runSnapshot()
    if (options.route && (run.phase === 'choosing' || run.phase === 'collapsing')) {
      const routeId = options.route[run.stageIndex]
      if (routeId) engine.selectMigration(routeId)
    }
    setPolicyIntent(engine, simulatedMs, policy)
    const elapsed = Math.min(STEP_BATCH_MS, durationMs - simulatedMs)
    engine.advance(elapsed)
    const previousSimulatedMs = simulatedMs
    let hud = engine.snapshot()
    const advancedMs = hud.elapsedMs
    if (advancedMs <= previousSimulatedMs && durationMs - previousSimulatedMs > 0) {
      engine.advance(1000 / 60)
      hud = engine.snapshot()
    }
    simulatedMs = hud.elapsedMs
    if (simulatedMs <= previousSimulatedMs) break

    const events = engine.drainEvents()
    keyEvents.push(...events)
    for (const event of events) {
      if (event.type === 'mutation-ready') {
        const stageIndex = engine.runSnapshot().stageIndex
        const remainingEnvironmentIds = getContent().journey.stages
          .slice(stageIndex + 1)
          .flatMap((stage) => stage.routeOffers.map((route) => route.destinationEnvironmentId))
        const offered = offerEvolution(buildState, {
          seed: options.seed,
          environmentId: hud.environmentId as EnvironmentId,
          stageIndex,
          remainingEnvironmentIds,
          unlockedTraitIds: getContent().organelles.map((organ) => organ.id),
          recentTraitIds,
        })
        const choice = chooseEvolution(offered, policy)
        if (choice) {
          buildState = applyEvolution(buildState, choice)
          engine.applyEvolution(buildState)
          recentTraitIds = offered.map((offer) => offer.traitId)
          keyEvents.push({ type: 'mutation-selected', entityId: 'player', organId: choice.traitId, action: 'install', atMs: event.atMs })
        }
      }
      if (event.type === 'ecology-opportunity') {
        opportunityIds.push(event.opportunityId)
        opportunityCueUntilMs = Math.max(opportunityCueUntilMs, event.atMs + 8000)
      }
    }
    consumed += events.filter((event) => event.type === 'engulfed' && event.predatorId === 'player').length
    const ending = events.find((event) => event.type === 'ending-reached')
    if (ending?.type === 'ending-reached') endingId = ending.endingId
    terminal = events.some((event) => event.type === 'ending-reached' || event.type === 'player-died')

    const world = engine.renderSnapshot()
    visitedStages.add(engine.runSnapshot().stageIndex + 1)
    for (const entity of world.entities) {
      if (!entity.behaviorProfileId || !entity.behaviorState) continue
      const family = getContent().behaviorProfiles.find((profile) => profile.id === entity.behaviorProfileId)?.family
      if (family) behaviorStateCounts[family] = (behaviorStateCounts[family] ?? 0) + 1
    }
    const auditPlayer = world.entities.find((entity) => entity.id === world.playerId)
    const actionable = Boolean(auditPlayer && world.entities.some((entity) => {
      if (entity.id === auditPlayer.id || entity.status !== 'active') return false
      const distance = Math.hypot(entity.position.x - auditPlayer.position.x, entity.position.y - auditPlayer.position.y)
      const edible = entity.body.radius < auditPlayer.body.radius && distance <= 320
      const dangerous = entity.faction === 'hostile' && distance <= 360
      return edible || dangerous
    })) || simulatedMs <= opportunityCueUntilMs
    if (actionable) lastActionableAtMs = simulatedMs
    else maxActionableGapMs = Math.max(maxActionableGapMs, simulatedMs - lastActionableAtMs)
    maxEntities = Math.max(maxEntities, world.entities.length)
    inspectNumbers(hud, world.entities, invalidNumbers)
    if (terminal) break
  }

  const morphology = engine.morphologySnapshot()
  const formSignature = keyEvents.filter((event) => event.type === 'form-transitioned')
    .reduce((signature, event) => event.type === 'form-transitioned' ? `${signature}>${event.toFormId}` : signature, 'form-primal-cell')
  const profile = morphologyFor(buildState)
  const morphologySignature = [
    buildState.bodyStage,
    profile.silhouette,
    profile.dominantRoute,
    profile.parts.join(','),
    morphology.bodyCount,
    morphology.organelles.map((organ) => `${organ.id}:${organ.stage}`).sort().join(','),
    Math.round(morphology.stability / 5) * 5,
    Math.round(morphology.totalMass / 25) * 25,
  ].join(':')
  const completedSimulationMs = Math.min(durationMs, engine.snapshot().elapsedMs)
  const deathId = deriveLifeArchive(keyEvents.map((event, index) => ({ sequence: index + 1, event })), getContent()).deathTemplateId
  engine.destroy()

  return {
    keyEvents,
    simulatedMs: completedSimulationMs,
    maxEntities,
    invalidNumbers: [...invalidNumbers],
    morphologySignature,
    endingId,
    deathId,
    routeSignature: keyEvents.filter((event) => event.type === 'route-selected').map((event) => event.type === 'route-selected' ? event.routeId : '').join('>'),
    stageSignature: [...visitedStages].sort((left, right) => left - right).join('>'),
    opportunitySignature: opportunityIds.join('>'),
    behaviorStateCounts,
    maxActionableGapMs,
    formSignature,
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
  const world = engine.renderSnapshot()
  const hostiles = world.entities.filter((entity) => entity.faction === 'hostile' && entity.status === 'active')
  const players = world.entities.filter((entity) => entity.faction === 'player' && entity.status === 'active')
  for (const hostile of hostiles) {
    if (hostile.role === 'boss' || players.every((player) => Math.hypot(hostile.position.x - player.position.x, hostile.position.y - player.position.y) > 360)) continue
    hostile.status = 'ruptured'
  }
  for (const entity of world.entities) {
    if (entity.faction !== 'player' || entity.status !== 'active') continue
    entity.membrane = Math.max(entity.membrane, 10_000)
    entity.energy = Math.max(entity.energy, 10_000)
    const auditRadius = 50
    if (entity.body.radius !== auditRadius) {
      entity.mass = Math.max(entity.mass, auditRadius * auditRadius)
      entity.body = auditBody(entity.position, auditRadius)
    }
    const imminentContainment = hostiles.some((hostile) => (
      hostile.status === 'active'
      && hostile.body.radius > entity.body.radius
      && Math.hypot(hostile.position.x - entity.position.x, hostile.position.y - entity.position.y) <= hostile.body.radius + entity.body.radius + 48
    ))
    if (imminentContainment) {
      const margin = entity.body.radius + 18
      const candidates = [
        { x: margin, y: margin },
        { x: world.width - margin, y: margin },
        { x: margin, y: world.height - margin },
        { x: world.width - margin, y: world.height - margin },
      ]
      const safest = candidates.sort((left, right) => minimumHostileDistance(right, hostiles) - minimumHostileDistance(left, hostiles))[0]!
      entity.position = safest
      entity.velocity = { x: 0, y: 0 }
      entity.body = auditBody(safest, entity.body.radius)
    }
  }
}

function auditBody(position: { x: number; y: number }, radius: number) {
  return {
    center: { ...position },
    radius,
    contour: Array.from({ length: 24 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2
      return { x: position.x + Math.cos(angle) * radius, y: position.y + Math.sin(angle) * radius }
    }),
  }
}

function minimumHostileDistance(position: { x: number; y: number }, hostiles: ReturnType<ReturnType<typeof createGameEngine>['renderSnapshot']>['entities']): number {
  return hostiles.reduce((minimum, hostile) => Math.min(minimum, Math.hypot(hostile.position.x - position.x, hostile.position.y - position.y) - hostile.body.radius), Number.POSITIVE_INFINITY)
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

type BuildStateTraitIds = ReturnType<typeof createBuildState>['traitIds']

function chooseEvolution(choices: readonly EvolutionOffer[], policy: NonNullable<HeadlessRunOptions['policy']>): EvolutionOffer | undefined {
  const content = getContent()
  const desired = policy === 'speed' ? ['move']
    : policy === 'armor' ? ['defend', 'metabolism']
      : policy === 'stealth' ? ['sense', 'defend']
        : policy === 'parasite' ? ['feed', 'attack']
          : policy === 'swarm' ? ['reproduce', 'symbiosis']
            : ['metabolism', 'move', 'feed']
  return [...choices].sort((left, right) => {
    const leftOrgan = content.organelles.find((item) => item.id === left.traitId)
    const rightOrgan = content.organelles.find((item) => item.id === right.traitId)
    const leftScore = leftOrgan ? desired.indexOf(leftOrgan.category) : -1
    const rightScore = rightOrgan ? desired.indexOf(rightOrgan.category) : -1
    return (leftScore < 0 ? 99 : leftScore) - (rightScore < 0 ? 99 : rightScore)
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
