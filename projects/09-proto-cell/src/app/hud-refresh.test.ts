import { expect, it } from 'vitest'
import { needsImmediateHudRefresh } from './hud-refresh'

it('lets the existing 100 ms HUD timer absorb routine combat bursts', () => {
  expect(needsImmediateHudRefresh([
    { type: 'damaged', targetId: 'player', source: 'ram', amount: 1, atMs: 0 },
    { type: 'engulfed', predatorId: 'player', preyId: 'meal', biomass: 8, atMs: 0 },
  ])).toBe(false)
})
it('refreshes immediately when a combat burst also ends the run', () => {
  expect(needsImmediateHudRefresh([
    { type: 'damaged', targetId: 'player', source: 'ram', amount: 1, atMs: 0 },
    { type: 'player-died', cause: 'engulfed', atMs: 0 },
  ])).toBe(true)
})
