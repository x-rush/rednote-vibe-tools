import type { GameEvent } from '../game/interactions'

/** Real time, never simulation time: holding a simulation clock cannot expire itself. */
export function impactHoldUntil(currentUntil: number, now: number, events: readonly GameEvent[], reducedMotion: boolean, reducedShake: boolean): number {
  if (reducedMotion || reducedShake || !Number.isFinite(now)) return currentUntil
  const duration = events.some((event) => event.type === 'engulfed' && event.predatorId === 'player' && event.finisher) ? 100
    : events.some((event) => event.type === 'engulfed' && event.predatorId === 'player' && event.reversal) ? 70
    : events.some((event) => event.type === 'terrain-broken') ? 35 : 0
  return duration ? Math.max(currentUntil, now + duration) : currentUntil
}

export function engulfRecoilScale(ageMs: number, reducedMotion: boolean): number {
  if (reducedMotion || !Number.isFinite(ageMs) || ageMs < 0 || ageMs >= 180) return 1
  return 1 - Math.sin(ageMs / 180 * Math.PI) * 0.07
}
