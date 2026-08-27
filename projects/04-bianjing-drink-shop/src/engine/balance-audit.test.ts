import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { runBalanceAudit } from './balance-audit'

describe('1,000-run authored balance audit', () => {
  const summary = runBalanceAudit(shopContent.content, 200)

  it('keeps sensible play viable without making the first ten operating turns an automatic windfall', () => {
    expect(summary.totalRuns).toBe(1000)
    expect(summary.turnTenMoneyMedians.steady).toBeGreaterThanOrEqual(130)
    expect(summary.turnTenMoneyMedians.steady).toBeLessThanOrEqual(260)
    expect(summary.bankruptcyRateByStrategy.steady).toBeLessThanOrEqual(0.12)
    expect(summary.bankruptcyRateByStrategy['balanced-rest']).toBeLessThanOrEqual(0.12)
    expect(summary.campaignSurvivorsByStrategy.steady).toBeGreaterThanOrEqual(180)
    expect(summary.campaignSurvivorsByStrategy['balanced-rest']).toBeGreaterThanOrEqual(180)
    expect(summary.averageEventsByStrategy.steady).toBeGreaterThanOrEqual(16)
    expect(summary.negativeDayRateByStrategy.steady).toBeGreaterThanOrEqual(0.25)
  })

  it('makes reckless pricing and overstock visibly costly instead of secretly optimal', () => {
    expect(summary.negativeDayRateByStrategy['max-price']).toBeGreaterThanOrEqual(0.30)
    expect(summary.routeMedians['max-price'].money).toBeLessThan(summary.routeMedians.steady.money)
    expect(summary.negativeDayRateByStrategy.overstock).toBeGreaterThanOrEqual(0.55)
    expect(summary.bankruptcyRateByStrategy.overstock).toBeGreaterThanOrEqual(0.25)
    expect(summary.campaignSurvivorsByStrategy['balanced-rest'])
      .toBeGreaterThan(summary.campaignSurvivorsByStrategy['aggressive-full'])
    expect(Object.keys(summary.endingDistributionByStrategy.steady).length).toBeGreaterThanOrEqual(2)
  })

  it('runs 200 stable seeds for every declared strategy and replays terminal states exactly', () => {
    expect(summary.routeTotals).toEqual({ steady: 200, 'max-price': 200, overstock: 200, 'aggressive-full': 200, 'balanced-rest': 200 })
    expect(summary.deterministicReplay).toBe(true)
    expect(Object.values(summary.endingDistribution).reduce((sum, count) => sum + count, 0)).toBe(1000)
  })
})
