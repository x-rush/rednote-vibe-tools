import type { EntityState } from '../domain/types'

export type RelationshipCue = 'edible' | 'danger' | 'neutral'

const CLEAR_MASS_RATIO = 1.18

export function relationshipCue(player: EntityState, target: EntityState): RelationshipCue {
  if (player.status !== 'active' || target.status !== 'active' || target.faction === 'player') return 'neutral'
  if (player.mass >= target.mass * CLEAR_MASS_RATIO) return 'edible'
  if (target.mass >= player.mass * CLEAR_MASS_RATIO) return 'danger'
  return 'neutral'
}

export function relationshipPulse(elapsedMs: number, reducedFlash: boolean): number {
  return reducedFlash ? 1 : 1 + Math.sin(elapsedMs / 120) * 0.035
}
