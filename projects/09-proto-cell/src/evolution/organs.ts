import { getContent, type AnchorSlot, type OrganelleId } from '../content'
import type { EntityState, Vec2 } from '../domain/types'

export type InstalledOrganelle = {
  id: OrganelleId
  stage: 'installed' | 'mature'
  anchor: AnchorSlot
  charges?: number
}

export type EvolvedEntityState = EntityState & {
  installedOrganelles: InstalledOrganelle[]
  stability: number
}

export type OrganPerception = {
  atMs: number
  containmentRatio: number
  hostileCount: number
  speedRatio: number
  sameDirectionMs: number
  msSinceDamage: number
  membraneMax: number
  collisionStrength: number
  incomingFatalDamage: boolean
  incomingDamage: number
  threatEscapeDirection: Vec2
  cooldownRemainingMs: Partial<Record<OrganelleId, number>>
}

export type OrganEffect = {
  type: 'organ-triggered'
  entityId: string
  organId: OrganelleId
  atMs: number
  effect: 'speed-boost' | 'escape-impulse' | 'block' | 'repair' | 'split' | 'colony-decoy'
  amount?: number
  energyCost?: number
  impulse?: Vec2
  consumesCharge?: boolean
}

export function applyOrganEffects(effects: readonly OrganEffect[]): { controlledEntityId: string; spawnedDecoys: Array<{ sourceEntityId: string; expiresAtMs: number }> } {
  const source = effects.find((effect) => effect.effect === 'colony-decoy')
  return {
    controlledEntityId: source?.entityId ?? 'player',
    spawnedDecoys: source ? [{ sourceEntityId: source.entityId, expiresAtMs: source.atMs + 2400 }] : [],
  }
}

type OrganBehavior = (entity: EvolvedEntityState, organ: InstalledOrganelle, perception: OrganPerception) => Omit<OrganEffect, 'type' | 'entityId' | 'organId' | 'atMs'> | undefined

export const CONTAINMENT_ESCAPE_COVERAGE = 0.55
export const FATAL_SPLIT_COVERAGE = 0.62

const behaviorRegistry: Record<string, OrganBehavior> = {
  'straight-line-boost': (_entity, organ, perception) => perception.sameDirectionMs >= 1200 && perception.speedRatio >= 0.7
    ? { effect: 'speed-boost', amount: organ.stage === 'mature' ? 1.4 : 1.25 }
    : undefined,
  'containment-escape': (entity, organ, perception) => perception.containmentRatio >= CONTAINMENT_ESCAPE_COVERAGE && entity.energy >= 18
    ? { effect: 'escape-impulse', amount: organ.stage === 'mature' ? 2.1 : 1.8, energyCost: 18, impulse: perception.threatEscapeDirection }
    : undefined,
  'collision-shell': (_entity, organ, perception) => perception.collisionStrength > 0
    ? { effect: 'block', amount: perception.collisionStrength * (organ.stage === 'mature' ? 0.55 : 0.35) }
    : undefined,
  'fatal-hit-guard': (entity, organ, perception) => {
    const energyCost = organ.stage === 'mature' ? 10 : 14
    return perception.incomingFatalDamage && perception.incomingDamage > 0 && (organ.charges ?? 0) > 0 && entity.energy >= energyCost
      ? { effect: 'block', amount: perception.incomingDamage, energyCost, consumesCharge: true }
      : undefined
  },
  'safe-energy-repair': (entity, organ, perception) => perception.msSinceDamage >= 3000 && entity.membrane < perception.membraneMax && entity.energy >= 8
    ? { effect: 'repair', amount: organ.stage === 'mature' ? 16 : 10, energyCost: 8 }
    : undefined,
  'mass-or-fatal-split': (entity, organ, perception) => entity.mass >= 320 || perception.containmentRatio >= FATAL_SPLIT_COVERAGE || perception.incomingFatalDamage
    ? { effect: 'split', amount: organ.stage === 'mature' ? 3 : 2 }
    : undefined,
}

export function evaluatePassiveOrgans(entity: EvolvedEntityState, perception: OrganPerception): OrganEffect[] {
  const definitions = new Map(getContent().organelles.map((definition) => [definition.id, definition]))
  return entity.installedOrganelles.flatMap((organ) => {
    if ((perception.cooldownRemainingMs[organ.id] ?? 0) > 0) return []
    const definition = definitions.get(organ.id)
    const effect = definition ? behaviorRegistry[definition.behaviorId]?.(entity, organ, perception) : undefined
    return effect ? [{
      type: 'organ-triggered' as const,
      entityId: entity.id,
      organId: organ.id,
      atMs: perception.atMs,
      ...effect,
    }] : []
  })
}
