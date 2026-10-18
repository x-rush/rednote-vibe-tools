import type { GameEvent } from '../game/interactions'
import { createGameEngine, type EcosystemProgressSnapshot } from '../game/engine'
import { getContent, type ContentPack, type EnvironmentId, type OrganelleId, type ScaleTierDefinition } from '../content'
import type { LifeEventLogEntry } from '../progression/archive'
import { deriveLifeArchive } from '../progression/archive'
import { stepBoss, type BossState } from '../world/bosses'
import { applyEvolution, createBuildState, offerEvolution, type EvolutionOffer } from '../evolution/build'
import { morphologyFor } from '../rendering/morphology'
import { createDefaultSave } from '../storage/codec'
import { physicalMembrane } from '../domain/membrane'
import { fullyContains } from '../game/containment'
import type { ContactDamageDefinition } from '../entities/factory'
import type { Vec2 } from '../domain/types'
import { fiberSections, type EnvironmentField } from '../world/environments'

export type HeadlessRunOptions = {
  seed: number
  durationMs?: number
  route?: readonly string[]
  policy?: 'balanced' | 'speed' | 'armor' | 'stealth' | 'parasite' | 'swarm'
  stopAfterTier?: number
  runOrdinal?: number
  unlockedIds?: readonly string[]
  lineageArchetypeId?: string
  inheritedOrganelleIds?: readonly OrganelleId[]
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
  finalEcosystem?: EcosystemProgressSnapshot
  fleeingCarryoverIds: string[]
  consumedCarryoverIds: string[]
  tierClearTimes: number[]
  initialRecipeId: string
  leviathanPhases: string[]
  finaleStartedAtMs?: number
  finaleMembraneStable: boolean
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
  const engine = createGameEngine({ seed: options.seed, environmentId: 'env-clear-drop', runOrdinal: options.runOrdinal ?? 0,
    lineageArchetypeId: options.lineageArchetypeId, inheritedOrganelleIds: options.inheritedOrganelleIds })
  const initialPlayer = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
  const initialRecipeId = 'visualRecipeId' in initialPlayer ? String(initialPlayer.visualRecipeId) : ''
  const unlockedTraitIds = availableRunTraits(options.unlockedIds)
  const keyEvents: GameEvent[] = []
  const invalidNumbers = new Set<string>()
  let maxEntities = 0
  let endingId: string | undefined
  let consumed = 0
  let simulatedMs = 0
  let terminal = false
  let buildState = createBuildState(engine.renderSnapshot().playerBuild)
  let recentTraitIds: BuildStateTraitIds = []
  const visitedStages = new Set<number>([1])
  const opportunityIds: string[] = []
  const behaviorStateCounts: Record<string, number> = {}
  let opportunityCueUntilMs = 0
  let lastActionableAtMs = 0
  let maxActionableGapMs = 0
  const fleeingCarryoverIds = new Set<string>()
  const leviathanPhases = new Set<string>()
  let finaleStartedAtMs: number | undefined
  let finaleMembrane: number | undefined
  let finaleMembraneStable = true

  engine.start()
  engine.input.start({ x: 0, y: 0 })
  while (simulatedMs + 0.000_001 < durationMs) {
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
      if (event.type === 'form-transition-ready') {
        engine.advanceForm()
        keyEvents.push(...engine.drainEvents())
      }
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
          unlockedTraitIds,
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
    if (hud.ecosystem?.leviathanPhase) leviathanPhases.add(hud.ecosystem.leviathanPhase)
    if (hud.finaleStartedAtMs !== undefined) {
      finaleStartedAtMs ??= hud.finaleStartedAtMs
      finaleMembrane ??= hud.membrane
      finaleMembraneStable &&= hud.membrane === finaleMembrane
    }
    visitedStages.add(engine.runSnapshot().stageIndex + 1)
    if (options.stopAfterTier !== undefined && engine.snapshot().tierIndex >= options.stopAfterTier) break
    for (const entity of world.entities) {
      if (entity.id.startsWith('carryover-') && entity.behaviorState === 'flee') fleeingCarryoverIds.add(entity.id)
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
  const finalEcosystem = engine.snapshot().ecosystem
  engine.destroy()

  return {
    leviathanPhases: [...leviathanPhases],
    finaleStartedAtMs,
    finaleMembraneStable,
    initialRecipeId,
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
    finalEcosystem,
    fleeingCarryoverIds: [...fleeingCarryoverIds],
    consumedCarryoverIds: keyEvents.flatMap((event) => event.type === 'engulfed' && event.predatorId === 'player' && event.preyId.startsWith('carryover-') ? [event.preyId] : []),
    tierClearTimes: keyEvents.filter((event) => event.type === 'form-transitioned' || event.type === 'ending-reached').map((event) => event.atMs),
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

export function availableRunTraits(unlockedIds: readonly string[] = createDefaultSave().progression.unlockedIds): BuildStateTraitIds {
  const content = getContent()
  const locked = new Set(content.geneNodes.flatMap((node) => node.unlockIds.filter((id) => id.startsWith('organelle-'))))
  return content.organelles.filter((organ) => !locked.has(organ.id) || unlockedIds.includes(organ.id)).map((organ) => organ.id)
}

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

export function setPolicyIntent(
  engine: ReturnType<typeof createGameEngine>,
  elapsedMs: number,
  policy: NonNullable<HeadlessRunOptions['policy']>,
) {
  const world = engine.renderSnapshot()
  const player = world.entities.find((entity) => entity.id === world.playerId)
  if (!player) return
  const swarm = engine.snapshot().swarm
  if (swarm && swarm.bodyCount > 1 && swarm.minimumRemainingMs <= 0) {
    engine.input.cancel()
    return
  }
  engine.input.start({ x: 0, y: 0 })
  const distances = world.entities.filter((entity) => entity.faction !== 'player').map((entity) => ({ entity, distance: Math.hypot(entity.position.x - player.position.x, entity.position.y - player.position.y) }))
  const membrane = physicalMembrane(player, world.lifecycle.formId, world.elapsedMs, world.playerBuild)
  const fitByEntity = new Map<typeof player, boolean>()
  const physicalBodies = new Map([[player, membrane]])
  const physicalBody = (entity: typeof player) => {
    let shape = physicalBodies.get(entity)
    if (!shape) {
      shape = physicalMembrane(entity, world.lifecycle.formId, world.elapsedMs)
      physicalBodies.set(entity, shape)
    }
    return shape
  }
  const centeredFit = (entity: typeof player) => {
    const cached = fitByEntity.get(entity)
    if (cached !== undefined) return cached
    const shape = physicalBody(entity)
    const offset = { x: player.position.x - entity.position.x, y: player.position.y - entity.position.y }
    const fits = fullyContains(membrane, { ...shape, center: { ...player.position }, contour: shape.contour.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y })) })
    fitByEntity.set(entity, fits)
    return fits
  }
  const canEngulfPlayer = (entity: typeof player) => {
    const shape = physicalBody(entity)
    const offset = { x: entity.position.x - player.position.x, y: entity.position.y - player.position.y }
    return fullyContains(shape, { ...membrane, center: { ...entity.position }, contour: membrane.contour.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y })) })
  }
  const contactWeapon = (entity: typeof player) => {
    const damage = 'contactDamage' in entity ? entity.contactDamage as ContactDamageDefinition | undefined : undefined
    // Spines keep pulsing during movement recovery: budget space for the next pulse too.
    return Boolean(damage && damage.amount > 0)
  }
  const danger = distances.filter(({ entity, distance }) => entity.faction === 'hostile' && distance < entity.body.radius + player.body.radius + 70 && !centeredFit(entity) && (canEngulfPlayer(entity) || contactWeapon(entity)))
    .sort((left, right) => left.distance - right.distance)[0]
  const edible = distances.filter(({ entity }) => entity.body.radius < player.body.radius * 0.84 && entity.role !== 'boss' && centeredFit(entity))
    .map((sample) => ({ ...sample, blocked: blockedHuntPath(player.position, sample.entity.position, player.body.radius, world.environmentField.obstacles) }))
    .sort((left, right) => {
      const priority = (sample: typeof left) => sample.entity.id.startsWith('encounter-') ? 0 : sample.entity.id.startsWith('carryover-') ? 1 : 2
      return Number(left.blocked) - Number(right.blocked) || priority(left) - priority(right) || left.distance - right.distance
    })[0]
  if (danger || edible) {
    const target = danger?.entity ?? edible!.entity
    const heading = target.behaviorDirection
    const relative = { x: player.position.x - target.position.x, y: player.position.y - target.position.y }
    const incoming = heading && heading.x * relative.x + heading.y * relative.y > 0
      && Math.abs(heading.x * relative.y - heading.y * relative.x) < player.body.radius + target.body.radius
    if (danger && heading && incoming && ['pursue', 'charge', 'ambush'].includes(target.behaviorState ?? '')) {
      const side = heading.x * (player.position.y - target.position.y) - heading.y * (player.position.x - target.position.x) >= 0 ? 1 : -1
      const awayX = player.position.x - target.position.x
      const awayY = player.position.y - target.position.y
      const distance = Math.max(1, Math.hypot(awayX, awayY))
      engine.input.move({ x: (-heading.y * side + awayX / distance * 0.2) * 120, y: (heading.x * side + awayY / distance * 0.2) * 120 })
      return
    }
    const direction = danger ? -1 : 1
    const x = (target.position.x + (danger ? 0 : target.velocity.x * 0.2) - player.position.x) * direction
    const y = (target.position.y + (danger ? 0 : target.velocity.y * 0.2) - player.position.y) * direction
    const length = Math.max(1, Math.hypot(x, y))
    engine.input.move({ x: x / length * 120, y: y / length * 120 })
    return
  }
  const policyOffset = ['balanced', 'speed', 'armor', 'stealth', 'parasite', 'swarm'].indexOf(policy) * 0.47
  const angle = elapsedMs / 4200 + policyOffset
  engine.input.move(
    { x: Math.cos(angle) * 120, y: Math.sin(angle) * 120 },
  )
}

function blockedHuntPath(from: Vec2, to: Vec2, radius: number, obstacles: EnvironmentField['obstacles']): boolean {
  const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x
  const path = { x: to.x - from.x, y: to.y - from.y }
  return obstacles.flatMap((obstacle) => obstacle.kind === 'chamber-wall' ? fiberSections(obstacle) : []).some((obstacle) => {
    const wall = { x: obstacle.to.x - obstacle.from.x, y: obstacle.to.y - obstacle.from.y }
    const offset = { x: obstacle.from.x - from.x, y: obstacle.from.y - from.y }
    const denominator = cross(path, wall)
    if (Math.abs(denominator) > 0.000001) {
      const alongPath = cross(offset, wall) / denominator
      const alongWall = cross(offset, path) / denominator
      if (alongPath >= 0 && alongPath <= 1 && alongWall >= 0 && alongWall <= 1) return true
    }
    // Slightly inside the collision capsule avoids flagging an outward route from its surface.
    const clearance = Math.max(0, radius - 1)
    const distance = Math.min(segmentDistanceSquared(from, obstacle.from, obstacle.to), segmentDistanceSquared(to, obstacle.from, obstacle.to), segmentDistanceSquared(obstacle.from, from, to), segmentDistanceSquared(obstacle.to, from, to))
    return distance < clearance * clearance
  })
}

function segmentDistanceSquared(point: Vec2, from: Vec2, to: Vec2): number {
  const x = to.x - from.x
  const y = to.y - from.y
  const lengthSquared = x * x + y * y
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * x + (point.y - from.y) * y) / lengthSquared))
  return (point.x - from.x - x * along) ** 2 + (point.y - from.y - y * along) ** 2
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
