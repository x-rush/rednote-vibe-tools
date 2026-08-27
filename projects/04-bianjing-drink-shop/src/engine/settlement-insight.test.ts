import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DailyResult, ProductSale, SettlementReason } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { deriveSettlementReason } from './settlement-insight'

const product = shopContent.content.drinks.find((item) => item.productId === 'drink-green-plum')!
const sale = (overrides: Partial<ProductSale> = {}): ProductSale => ({
  productId: product.productId,
  prepared: 4,
  demand: 4,
  sold: 4,
  unsold: 0,
  price: product.basePrice,
  ...overrides,
})
const result = (overrides: Partial<DailyResult> = {}): DailyResult => ({
  day: 10,
  operatingDay: 4,
  weatherId: 'weather-clear',
  visitors: 10,
  operatingMode: 'full',
  footTraffic: 10,
  buyers: 7,
  unserved: 0,
  conversionRate: 0.7,
  energyDelta: -5,
  sales: [sale()],
  ledger: [],
  moneyDelta: 10,
  chainInterruptions: [],
  nextState: makeState(),
  ...overrides,
})

const losses = (overrides: Partial<NonNullable<DailyResult['demandResolution']>['losses']> = {}) => ({
  potentialBuyers: 4,
  servedCustomers: 4,
  losses: { stockout: 0, menuMismatch: 0, price: 0, service: 0, ...overrides },
  products: [],
})

describe('primary settlement insight', () => {
  it.each([
    ['rested', result({ operatingMode: 'rest', moneyDelta: -4, sales: [], unserved: 3 })],
    ['low-energy', result({ unserved: 3, sales: [sale({ price: 9 })] })],
    ['price-high', result({ conversionRate: 0.4, sales: [sale({ price: 9 })] })],
    ['stockout', result({ sales: [sale({ demand: 7, sold: 4 })] })],
    ['waste', result({ sales: [sale({ prepared: 8, demand: 2, sold: 2, unsold: 6 })] })],
    ['poor-fit', result({ conversionRate: 0.3 })],
    ['loss', result({ moneyDelta: -2 })],
    ['profitable', result()],
  ] as Array<[SettlementReason, DailyResult]>)('returns %s from literal result facts', (expected, dailyResult) => {
    expect(deriveSettlementReason(dailyResult, shopContent.content.drinks)).toBe(expected)
  })

  it('is stable when product sales arrive in a different order', () => {
    const second = sale({ productId: 'drink-ginger-honey', price: 12, demand: 3, sold: 3 })
    const firstOrder = result({ conversionRate: 0.4, sales: [sale({ price: 9 }), second] })
    const secondOrder = { ...firstOrder, sales: [...firstOrder.sales].reverse() }

    expect(deriveSettlementReason(secondOrder, shopContent.content.drinks)).toBe('price-high')
    expect(deriveSettlementReason(secondOrder, shopContent.content.drinks)).toBe(deriveSettlementReason(firstOrder, shopContent.content.drinks))
  })

  it.each([
    ['loss', result({ moneyDelta: -1, demandResolution: losses({ price: 2, stockout: 2 }) })],
    ['price-high', result({ demandResolution: losses({ price: 2 }) })],
    ['poor-fit', result({ demandResolution: losses({ menuMismatch: 2 }) })],
    ['low-energy', result({ demandResolution: losses({ service: 2 }) })],
    ['stockout', result({ demandResolution: losses({ stockout: 2 }) })],
    ['waste', result({ demandResolution: losses(), sales: [sale({ prepared: 8, sold: 2, unsold: 6 })] })],
    ['profitable', result({ demandResolution: losses() })],
  ] as Array<[SettlementReason, DailyResult]>)('uses structured demand precedence for %s', (expected, dailyResult) => {
    expect(deriveSettlementReason(dailyResult, shopContent.content.drinks)).toBe(expected)
  })
})
