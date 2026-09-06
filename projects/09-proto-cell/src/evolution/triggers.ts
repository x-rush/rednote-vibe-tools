import type { EnvironmentId, OrganelleId } from '../content'
import type { BuildState } from './build'

export type TriggerFrame = {
  atMs: number
  elapsedMs: number
  movement: { speed: number; directionHeldMs: number; pursuitMs: number; closingSpeed: number }
  proximity?: { nearestThreatId?: string; nearestEdibleId?: string; schoolCount?: number }
  nearMiss?: { threatId: string; clearance: number }
  containment?: { coveredRatio: number; approach: 'front' | 'side' | 'rear' }
  engulf?: { preyId: string; chain: number; approach: 'front' | 'side' | 'rear' }
  damage?: { source: 'acid' | 'electric' | 'spine' | 'ram'; remainingMembraneRatio: number }
  collision?: { sourceId: string; strength: number }
  current?: { strength: number; alignment: number }
  environmentId: EnvironmentId
}

export type TriggerSignal =
  | 'pursuit'
  | 'near-miss'
  | 'engulf-chain'
  | 'rear-containment'
  | 'collision'
  | 'low-membrane'
  | 'damage'
  | 'school-proximity'
  | 'current-assist'

export type TriggerOutcome = {
  traitId: OrganelleId
  triggerId: TriggerSignal
  effectId: string
  durationMs?: number
  magnitude?: number
  cooldownMs: number
}

type TriggerRule = (frame: TriggerFrame) => Omit<TriggerOutcome, 'traitId'> | undefined

const triggerRules: Partial<Record<OrganelleId, TriggerRule>> = {
  'organelle-flagellum': (frame) => frame.movement.pursuitMs >= 2000 && frame.movement.closingSpeed > 0
    ? outcome('pursuit', 'pursuit-burst', 2400, 900, 1.35)
    : undefined,
  'organelle-transparent-membrane': (frame) => frame.nearMiss && frame.nearMiss.clearance <= 6
    ? outcome('near-miss', 'near-miss-camouflage', 4800, 1600)
    : undefined,
  'organelle-wide-mouth': (frame) => (frame.engulf?.chain ?? 0) >= 3
    ? outcome('engulf-chain', 'engulf-vortex', 4200, 1100, 1.18)
    : undefined,
  'organelle-needle-mouth': (frame) => frame.containment?.approach === 'rear' && frame.containment.coveredRatio >= 0.45
    ? outcome('rear-containment', 'rear-containment-bonus', 1800, 700, 1.12)
    : undefined,
  'organelle-mucus-coat': (frame) => (frame.collision?.strength ?? 0) > 0
    ? outcome('collision', 'collision-acid-trail', 3200, 1800)
    : undefined,
  'organelle-repair-vacuole': (frame) => (frame.damage?.remainingMembraneRatio ?? 1) <= 0.3
    ? outcome('low-membrane', 'low-membrane-molt', 9000, 1400, 12)
    : undefined,
  'organelle-division-ring': (frame) => frame.damage
    ? outcome('damage', 'damage-split', 12_000, 600)
    : undefined,
  'organelle-recombination-core': (frame) => (frame.proximity?.schoolCount ?? 0) >= 2
    ? outcome('school-proximity', 'school-proximity-heal', 3000, 900, 4)
    : undefined,
  'organelle-filter-gill': (frame) => (frame.current?.strength ?? 0) >= 0.25 && (frame.current?.alignment ?? 0) >= 0.65
    ? outcome('current-assist', 'current-assisted-acceleration', 1600, 700, 1.18)
    : undefined,
}

export function evaluateTriggers(build: BuildState, frame: TriggerFrame): TriggerOutcome[] {
  return build.traitIds.flatMap((traitId) => {
    const result = triggerRules[traitId]?.(frame)
    return result ? [{ traitId, ...result }] : []
  })
}

function outcome(
  triggerId: TriggerSignal,
  effectId: string,
  cooldownMs: number,
  durationMs?: number,
  magnitude?: number,
): Omit<TriggerOutcome, 'traitId'> {
  return { triggerId, effectId, cooldownMs, durationMs, magnitude }
}
