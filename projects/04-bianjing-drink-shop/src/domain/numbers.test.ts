import { describe, expect, it } from 'vitest'
import { ceilEnergy, clampStat, floorMoney, roundVisitors } from './numbers'

describe('numeric rules', () => {
  it('clamps shop stats to the documented 0–100 range', () => {
    expect(clampStat(-2)).toBe(0)
    expect(clampStat(52.5)).toBe(52.5)
    expect(clampStat(104)).toBe(100)
  })

  it('uses explicit rounding for visitors, money, and energy', () => {
    expect(roundVisitors(8.49)).toBe(8)
    expect(roundVisitors(8.5)).toBe(9)
    expect(floorMoney(3.9)).toBe(3)
    expect(ceilEnergy(3.1)).toBe(4)
  })
})
