import { describe, expect, it } from 'vitest'
import { impactHoldUntil, engulfRecoilScale } from './combat-feel'
describe('earned impact pacing', () => {
  const meal = { type: 'engulfed' as const, predatorId: 'player', preyId: 'old-enemy', biomass: 100, atMs: 500, reversal: true }
  it('adds a bounded real-time hold for an actual reversal but never for ordinary food', () => {
    expect(impactHoldUntil(0, 1000, [meal], false, false)).toBe(1070)
    expect(impactHoldUntil(0, 1000, [{ ...meal, finisher: true }], false, false)).toBe(1100)
    expect(impactHoldUntil(0, 1000, [{ ...meal, reversal: false }], false, false)).toBe(0)
    expect(impactHoldUntil(1100, 1000, [meal], false, false)).toBe(1100)
    expect(impactHoldUntil(0, 1000, [meal], true, false)).toBe(0)
    expect(impactHoldUntil(0, 1000, [meal], false, true)).toBe(0)
  })
  it('keeps the membrane recoil local, brief and optional', () => {
    expect(engulfRecoilScale(70, false)).toBeLessThan(1)
    expect(engulfRecoilScale(200, false)).toBe(1)
    expect(engulfRecoilScale(70, true)).toBe(1)
    expect(engulfRecoilScale(Number.NaN, false)).toBe(1)
  })
})
