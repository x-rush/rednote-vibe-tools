import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DailyDecision, DayContext, DayForecast, MenuDecision } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { calculateDemandFunnel, estimateProductDemandBands, resolveDemand } from './demand'

const content = shopContent.content
const context: DayContext = {
  day: 10,
  operatingDay: 4,
  weatherId: 'weather-hot',
  seasonId: 'season-early-spring',
  eventVisitorDelta: 0,
  activeTags: ['weather-hot', 'season-early-spring', 'spring'],
}
const productIds = ['drink-green-plum', 'drink-mint', 'drink-perilla']
const menuAt = (ratio: number): MenuDecision[] => productIds.map((productId) => {
  const product = content.drinks.find((item) => item.productId === productId)!
  return { productId, prepare: 8, price: Math.round(product.basePrice * ratio) }
})

describe('customer conversion and product demand', () => {
  it('lets visitors leave when every listed price is high', () => {
    const state = makeState({ reputation: 10, energy: 80 })
    const base = calculateDemandFunnel(12, menuAt(1), content.drinks, state, context, content.balance)
    const expensive = calculateDemandFunnel(12, menuAt(1.4), content.drinks, state, context, content.balance)

    expect(base.buyers).toBeLessThanOrEqual(base.footTraffic)
    expect(expensive.buyers).toBeLessThan(base.buyers)
    expect(Object.values(expensive.productDemand).reduce((sum, value) => sum + value, 0)).toBe(expensive.buyers)
  })

  it('records customers lost to low service capacity', () => {
    const healthy = calculateDemandFunnel(24, menuAt(1), content.drinks, makeState({ energy: 100 }), context, content.balance)
    const exhausted = calculateDemandFunnel(24, menuAt(1), content.drinks, makeState({ energy: 5 }), context, content.balance)

    expect(exhausted.unserved).toBeGreaterThan(healthy.unserved)
    expect(exhausted.buyers).toBeLessThan(healthy.buyers)
  })

  it('rewards a menu that fits the weather without exceeding foot traffic', () => {
    const state = makeState({ reputation: 10, energy: 100 })
    const matched = calculateDemandFunnel(12, menuAt(1), content.drinks, state, context, content.balance)
    const mismatched = calculateDemandFunnel(12, menuAt(1), content.drinks, state, { ...context, weatherId: 'weather-cold', activeTags: ['weather-cold', 'winter'] }, content.balance)

    expect(matched.buyers).toBeGreaterThan(mismatched.buyers)
    expect(matched.conversionRate).toBeLessThanOrEqual(1)
  })

  it('returns an empty deterministic funnel when nobody passes the shop', () => {
    expect(calculateDemandFunnel(0, menuAt(1), content.drinks, makeState(), context, content.balance)).toEqual({
      footTraffic: 0,
      buyers: 0,
      unserved: 0,
      conversionRate: 0,
      productDemand: Object.fromEntries(productIds.map((productId) => [productId, 0])),
    })
  })
})

const forecastFor = (segmentId: string, actualCustomers: number, expectedCustomers = actualCustomers): DayForecast => ({
  forecastId: `forecast-${segmentId}-${actualCustomers}`,
  day: 10,
  operatingDay: 4,
  weatherId: 'weather-clear',
  seasonId: 'season-early-spring',
  marketSignalId: 'signal-quiet-lane',
  activeTags: ['weather-clear', 'season-early-spring', 'spring', 'quiet-market'],
  demandGroups: content.demandSegments.map((segment) => ({
    segmentId: segment.segmentId,
    expectedCustomers: segment.segmentId === segmentId ? expectedCustomers : 0,
    actualCustomers: segment.segmentId === segmentId ? actualCustomers : 0,
  })),
})

const menuDecision = (items: Array<[string, number, number?]>): DailyDecision => ({
  operatingMode: 'full',
  strategyId: 'demand-test',
  menu: items.map(([productId, prepare, ratio = 1]) => {
    const product = content.drinks.find((item) => item.productId === productId)!
    return { productId, prepare, price: Math.round(product.basePrice * ratio) }
  }),
})

function expectConserved(result: ReturnType<typeof resolveDemand>) {
  expect(
    result.servedCustomers
    + result.losses.stockout
    + result.losses.menuMismatch
    + result.losses.price
    + result.losses.service,
  ).toBe(result.potentialBuyers)
  expect(result.products.every((item) => item.directSold + item.substituteSold <= item.prepared)).toBe(true)
}

describe('conserved preference-group demand', () => {
  it('serves a direct primary-tag match', () => {
    const result = resolveDemand(
      makeState({ energy: 100 }),
      forecastFor('segment-cool-sour', 4),
      menuDecision([['drink-green-plum', 5], ['drink-ginger-honey', 3], ['drink-perilla', 3]]),
      content,
    )
    expect(result).toMatchObject({ potentialBuyers: 4, servedCustomers: 4, losses: { stockout: 0, menuMismatch: 0, price: 0, service: 0 } })
    expect(result.products.find((item) => item.productId === 'drink-green-plum')).toMatchObject({ directDemand: 4, directSold: 4 })
    expectConserved(result)
  })

  it('distinguishes menu mismatch from high-price rejection', () => {
    const state = makeState({ energy: 100 })
    const mismatch = resolveDemand(
      state,
      forecastFor('segment-novel-signature', 3),
      menuDecision([['drink-perilla', 5], ['drink-fragrant-bean', 5], ['drink-lotus', 5]]),
      content,
    )
    const tooExpensive = resolveDemand(
      state,
      forecastFor('segment-cool-sour', 3),
      menuDecision([['drink-green-plum', 5, 1.4], ['drink-ginger-honey', 5], ['drink-perilla', 5]]),
      content,
    )
    expect(mismatch.losses.menuMismatch).toBe(3)
    expect(tooExpensive.losses.price).toBe(3)
    expectConserved(mismatch)
    expectConserved(tooExpensive)
  })

  it('tries exactly one acceptable substitute after the first choice sells out without forcing every customer to switch', () => {
    const result = resolveDemand(
      makeState({ energy: 100 }),
      forecastFor('segment-cool-sour', 4),
      menuDecision([['drink-green-plum', 1], ['drink-ginger-honey', 3], ['drink-perilla', 3]]),
      content,
    )
    expect(result.products.find((item) => item.productId === 'drink-green-plum')).toMatchObject({ directDemand: 4, directSold: 1 })
    const switched = result.products.find((item) => item.productId === 'drink-ginger-honey')?.substituteSold ?? 0
    expect(switched).toBeGreaterThan(0)
    expect(switched).toBeLessThan(3)
    expect(result.losses.stockout).toBe(3 - switched)
    expectConserved(result)
  })

  it('offers an acceptable alternative even when the preferred drink is absent from the menu', () => {
    const result = resolveDemand(
      makeState({ energy: 100, reputation: 40 }),
      forecastFor('segment-cool-sour', 6),
      menuDecision([['drink-ginger-honey', 6], ['drink-perilla', 6], ['drink-date', 6]]),
      content,
    )
    const switched = result.products.find((item) => item.productId === 'drink-ginger-honey')?.substituteSold ?? 0
    expect(switched).toBeGreaterThan(0)
    expect(switched).toBeLessThan(6)
    expect(result.losses.menuMismatch).toBe(6 - switched)
    expectConserved(result)
  })

  it('records a rejected substitute once without chaining to a third product', () => {
    const result = resolveDemand(
      makeState({ energy: 100 }),
      forecastFor('segment-cool-sour', 3),
      menuDecision([['drink-green-plum', 0], ['drink-ginger-honey', 3, 1.4], ['drink-perilla', 3]]),
      content,
    )
    expect(result.losses.price).toBe(3)
    expect(result.servedCustomers).toBe(0)
    expect(result.products.find((item) => item.productId === 'drink-perilla')?.substituteSold).toBe(0)
    expectConserved(result)
  })

  it('conserves zero-stock and service-capacity losses', () => {
    const zeroStock = resolveDemand(
      makeState({ energy: 100 }),
      forecastFor('segment-cool-sour', 3),
      menuDecision([['drink-green-plum', 0], ['drink-mint', 0], ['drink-cinnamon', 0]]),
      content,
    )
    const exhausted = resolveDemand(
      makeState({ energy: 0 }),
      forecastFor('segment-sweet-warm', 10),
      menuDecision([['drink-ginger-honey', 12], ['drink-cinnamon', 12], ['drink-date', 12]]),
      content,
    )
    expect(zeroStock.losses.stockout).toBe(3)
    expect(exhausted.losses.service).toBe(6)
    expectConserved(zeroStock)
    expectConserved(exhausted)
  })

  it('builds forecast bands from expected counts without revealing actual counts', () => {
    const state = makeState({ energy: 100 })
    const decision = menuDecision([['drink-green-plum', 4], ['drink-ginger-honey', 4], ['drink-perilla', 4]])
    const lowActual = estimateProductDemandBands(state, forecastFor('segment-cool-sour', 1, 6), decision, content)
    const highActual = estimateProductDemandBands(state, forecastFor('segment-cool-sour', 12, 6), decision, content)

    expect(lowActual).toEqual(highActual)
    expect(lowActual['drink-green-plum']).toMatchObject({ minimum: expect.any(Number), maximum: expect.any(Number), tendency: expect.stringMatching(/^(hot|steady|quiet)$/) })
    expect(lowActual['drink-green-plum'].maximum).toBeGreaterThanOrEqual(lowActual['drink-green-plum'].minimum)
  })

  it('scales half-day forecast bands by the same visitor multiplier as actual trade', () => {
    const state = makeState({ energy: 100 })
    const full = menuDecision([['drink-green-plum', 12], ['drink-ginger-honey', 12], ['drink-perilla', 12]])
    const half = { ...full, operatingMode: 'half' as const }
    const forecast = forecastFor('segment-cool-sour', 10, 10)
    const fullBands = estimateProductDemandBands(state, forecast, full, content)
    const halfBands = estimateProductDemandBands(state, forecast, half, content)
    expect(halfBands['drink-green-plum'].maximum).toBeLessThan(fullBands['drink-green-plum'].maximum)
  })
})
