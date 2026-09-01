import type { JourneyStageDefinition } from '../content'
import type { BodyShape, EntityState, Vec2 } from '../domain/types'
import { mostlyContains } from './containment'

export type DamageSource = 'acid' | 'electric' | 'spine' | 'ram'

export type GameEvent =
  | { type: 'engulfed'; predatorId: string; preyId: string; predatorDefinitionId?: string; preyDefinitionId?: string; biomass: number; chain?: number; atMs: number }
  | { type: 'damaged'; targetId: string; amount: number; source: DamageSource; atMs: number }
  | { type: 'blocked'; targetId: string; amount: number; atMs: number }
  | { type: 'ruptured'; targetId: string; fragmentMasses: readonly number[]; atMs: number }
  | { type: 'organ-triggered'; entityId: string; organId: string; atMs: number }
  | { type: 'trait-triggered'; entityId: string; traitId: string; effectId: string; durationMs?: number; atMs: number }
  | { type: 'mutation-ready'; entityId: string; atMs: number }
  | { type: 'mutation-selected'; entityId: string; organId: string; action: string; atMs: number }
  | { type: 'event-phase'; eventId: string; phase: 'telegraph' | 'active' | 'expired'; atMs: number }
  | { type: 'collapse-warning'; stageIndex: number; atMs: number }
  | { type: 'migration-ready'; stageIndex: number; routes: JourneyStageDefinition['routeOffers']; atMs: number }
  | { type: 'migration-forced'; stageIndex: number; routeId: string; destinationEnvironmentId: string; atMs: number }
  | { type: 'route-selected'; routeId: string; environmentId: string; atMs: number }
  | { type: 'ecology-opportunity'; opportunityId: string; environmentId: string; atMs: number }
  | { type: 'boss-resolved'; bossId: string; path: 'combat' | 'environment' | 'stealth' | 'parasite'; atMs: number }
  | { type: 'player-died'; cause: string; defeatedByDefinitionId?: string; atMs: number }
  | { type: 'ending-reached'; endingId: string; atMs: number }

export type InteractionContext = {
  atMs: number
  engulfLocks: Set<string>
  ruptureLossFraction: number
  containmentTolerance?: number
  engulfCoverageThreshold?: number
  engulfMassGainFraction?: number
  engulfChain?: number
  contactDamage?: {
    source: DamageSource
    amount: number
    targetId: string
    blockedAmount?: number
  }
}

export type InteractionResult = {
  entities: readonly [EntityState, EntityState]
  fragments: readonly EntityState[]
  events: readonly GameEvent[]
  massBefore: number
  massAfter: number
}

export function resolveInteraction(
  first: EntityState,
  second: EntityState,
  context: InteractionContext,
): InteractionResult {
  const massBefore = first.mass + second.mass
  const containment = findContainment(first, second, context.engulfCoverageThreshold ?? 0.7)

  if (containment) {
    const lockKey = `${containment.predator.id}\u0000${containment.prey.id}`
    if (!context.engulfLocks.has(lockKey)) {
      context.engulfLocks.add(lockKey)
      const massGainFraction = Math.max(0, context.engulfMassGainFraction ?? 1)
      const predator = {
        ...containment.predator,
        mass: containment.predator.mass + containment.prey.mass * massGainFraction,
      }
      const prey = {
        ...containment.prey,
        mass: 0,
        membrane: 0,
        energy: 0,
        status: 'engulfed' as const,
      }
      const entities = containment.predator === first
        ? [predator, prey] as const
        : [prey, predator] as const

      return {
        entities,
        fragments: [],
        events: [{
          type: 'engulfed',
          predatorId: containment.predator.id,
          preyId: containment.prey.id,
          ...('definitionId' in containment.predator ? { predatorDefinitionId: String(containment.predator.definitionId) } : {}),
          ...('definitionId' in containment.prey ? { preyDefinitionId: String(containment.prey.definitionId) } : {}),
          biomass: containment.prey.mass,
          chain: Math.max(1, Math.floor(context.engulfChain ?? 1)),
          atMs: context.atMs,
        }],
        massBefore,
        massAfter: entities[0].mass + entities[1].mass,
      }
    }
  }

  const damage = context.contactDamage
  if (!damage || damage.amount <= 0 || !bodiesOverlap(first.body, second.body)) {
    return unchanged(first, second, massBefore)
  }

  const targetIndex = first.id === damage.targetId ? 0 : second.id === damage.targetId ? 1 : -1
  if (targetIndex === -1) return unchanged(first, second, massBefore)

  const target = targetIndex === 0 ? first : second
  if (target.status !== 'active') return unchanged(first, second, massBefore)

  const blocked = Math.min(damage.amount, Math.max(0, damage.blockedAmount ?? 0))
  const applied = damage.amount - blocked
  const events: GameEvent[] = []
  if (blocked > 0) events.push({ type: 'blocked', targetId: target.id, amount: blocked, atMs: context.atMs })
  if (applied <= 0) {
    return { ...unchanged(first, second, massBefore), events }
  }

  let damagedTarget: EntityState = {
    ...target,
    membrane: Math.max(0, target.membrane - applied),
  }
  events.push({ type: 'damaged', targetId: target.id, amount: applied, source: damage.source, atMs: context.atMs })

  let fragments: EntityState[] = []
  if (damagedTarget.membrane === 0) {
    const lossFraction = Math.min(1, Math.max(0, context.ruptureLossFraction))
    const retainedMass = damagedTarget.mass * (1 - lossFraction)
    fragments = createFragments(damagedTarget, retainedMass)
    damagedTarget = { ...damagedTarget, mass: 0, energy: 0, status: 'ruptured' }
    events.push({
      type: 'ruptured',
      targetId: target.id,
      fragmentMasses: fragments.map((fragment) => fragment.mass),
      atMs: context.atMs,
    })
  }

  const entities = targetIndex === 0
    ? [damagedTarget, second] as const
    : [first, damagedTarget] as const
  const fragmentMass = fragments.reduce((total, fragment) => total + fragment.mass, 0)

  return {
    entities,
    fragments,
    events,
    massBefore,
    massAfter: entities[0].mass + entities[1].mass + fragmentMass,
  }
}

function findContainment(first: EntityState, second: EntityState, minimumCoveredRatio: number) {
  if (first.status === 'active' && second.status === 'active' && mostlyContains(first.body, second.body, minimumCoveredRatio)) {
    return { predator: first, prey: second }
  }
  if (first.status === 'active' && second.status === 'active' && mostlyContains(second.body, first.body, minimumCoveredRatio)) {
    return { predator: second, prey: first }
  }
  return undefined
}

function bodiesOverlap(first: BodyShape, second: BodyShape): boolean {
  return Math.hypot(first.center.x - second.center.x, first.center.y - second.center.y) <= first.radius + second.radius
}

function unchanged(first: EntityState, second: EntityState, massBefore: number): InteractionResult {
  return {
    entities: [first, second],
    fragments: [],
    events: [],
    massBefore,
    massAfter: massBefore,
  }
}

function createFragments(target: EntityState, retainedMass: number): EntityState[] {
  if (retainedMass <= 0) return []

  return Array.from({ length: 3 }, (_, index) => {
    const mass = retainedMass / 3
    const radius = Math.sqrt(mass)
    const angle = index / 3 * Math.PI * 2
    const position = {
      x: target.position.x + Math.cos(angle) * target.body.radius * 0.45,
      y: target.position.y + Math.sin(angle) * target.body.radius * 0.45,
    }
    return {
      id: `${target.id}-fragment-${index + 1}`,
      body: circleBody(position, radius),
      position,
      velocity: { x: Math.cos(angle), y: Math.sin(angle) },
      mass,
      membrane: 1,
      energy: 0,
      faction: 'neutral',
      role: 'fragment',
      status: 'active',
    }
  })
}

function circleBody(center: Vec2, radius: number): BodyShape {
  return {
    center,
    radius,
    contour: Array.from({ length: 12 }, (_, index) => {
      const angle = index / 12 * Math.PI * 2
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      }
    }),
  }
}
