import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { applyModifiers, dailySeed, decodeDishCode, encodeDishCode } from './challenges'

describe('daily dishes, codes, and modifiers', () => {
  it('derives a stable seed from local date plus content version', () => {
    expect(dailySeed(new Date(2026, 7, 29), '1.0.0')).toBe(dailySeed(new Date(2026, 7, 29), '1.0.0'))
    expect(dailySeed(new Date(2026, 7, 30), '1.0.0')).not.toBe(dailySeed(new Date(2026, 7, 29), '1.0.0'))
  })

  it('round-trips a checksummed dish code and rejects another release', () => {
    const value = { seed: 727, contentVersion: '1.0.0', route: ['env-algae-glow', 'env-fiber-maze'] as const }
    expect(decodeDishCode(encodeDishCode(value))).toEqual({ value, issues: [] })
    expect(decodeDishCode(encodeDishCode({ ...value, contentVersion: '9.0.0' }))).toMatchObject({
      value: undefined,
      issues: [{ code: 'content-version' }],
    })
  })

  it('refuses to sign an impossible route', () => {
    expect(() => encodeDishCode({ seed: 727, contentVersion: '1.0.0', route: ['env-clear-drop', 'env-abandoned-chamber'] })).toThrow(/route/)
  })

  it('combines all modifier contracts without reducing telegraph time', () => {
    const content = getContent()
    const result = applyModifiers(content.modifiers.map((item) => item.id), { baseTelegraphLeadMs: 1400 })
    expect(result.activeIds).toHaveLength(6)
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'excluded-pair' })]))
    expect(result.telegraphLeadMs).toBeGreaterThanOrEqual(1400)
    expect(result.rewardMultiplier).toBeGreaterThan(1)
  })
})
