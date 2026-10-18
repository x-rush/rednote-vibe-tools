import type { GameEvent } from '../game/interactions'

/** Combat visuals and audio still update on their original frame. Only the DOM
 * counters wait for the existing 100 ms HUD timer; decisions and endings do not. */
export function needsImmediateHudRefresh(events: readonly GameEvent[]): boolean {
  return events.some((event) => event.type !== 'damaged' && event.type !== 'blocked' && event.type !== 'engulfed' && event.type !== 'trait-triggered' && event.type !== 'organ-triggered')
}
