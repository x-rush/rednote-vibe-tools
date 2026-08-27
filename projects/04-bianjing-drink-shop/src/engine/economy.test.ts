import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DayContext, DemandResolution, Product } from '../domain/types'
import { seedRng } from '../domain/rng'
import { basicDecision, makeState } from '../tests/fixtures'
import { allocateDemand, calculateTrading, calculateVisitors, estimateOpeningBudget, settleSales, validateDecision } from './economy'

const clearDay: DayContext = { day: 10, operatingDay: 4, weatherId: 'weather-clear', seasonId: 'season-early-spring', eventVisitorDelta: 0, activeTags: [] }

describe('deterministic daily economy', () => {
  it('shows stock and every fixed cost before opening', () => {
    const state = makeState({ money: 120 })
    const estimate = estimateOpeningBudget(state, basicDecision, state.dayForecast!, shopContent.content)
    expect(estimate).toMatchObject({ stockCost: 39, rentCost: 4, operatingCost: 6, cashAfterOpening: 71 })
    expect(estimate.cashAfterOpening).toBe(state.money - estimate.stockCost - estimate.rentCost - estimate.operatingCost)
    expect(estimate.projectedMaximum).toBeGreaterThanOrEqual(estimate.projectedMinimum)
    expect(['safe', 'possible-debt', 'certain-debt']).toContain(estimate.risk)
  })

  it('calculates visitors with capped reputation growth and weather', () => {
    const { balance, weather } = shopContent.content
    expect(calculateVisitors(makeState({ day: 10, reputation: 20 }), clearDay, balance, weather)).toBe(10)
    expect(calculateVisitors(makeState({ day: 10, reputation: 80 }), clearDay, balance, weather)).toBe(16)
    expect(calculateVisitors(makeState({ day: 10, reputation: 20 }), { ...clearDay, weatherId: 'weather-rain' }, balance, weather)).toBe(8)
  })

  it('applies visitor-count modifiers before rounding', () => {
    const { balance, weather } = shopContent.content
    const state = makeState({
      day: 10,
      reputation: 20,
      modifiers: [{
        modifierId: 'street-praise', target: 'visitor-count', operation: 'add', value: 2,
        expiresDay: 12, playerLabel: 'street-praise',
      }],
    })
    expect(calculateVisitors(state, clearDay, balance, weather)).toBe(12)
  })

  it('allocates literal demand without losing visitor units', () => {
    const products: Product[] = ['drink-a', 'drink-b', 'drink-c'].map((productId) => ({
      productId, name: productId, flavor: '', unitCost: 1, basePrice: 5, complexity: 1,
      preferenceTags: [], shelfClass: 'brewed', keepRate: 0, initiallyUnlocked: true, assetId: `${productId}-asset`,
    }))
    const menu = products.map((product) => ({ productId: product.productId, prepare: 5, price: 5 }))
    expect(allocateDemand(8, menu, products, makeState(), clearDay, shopContent.content.balance)).toEqual({ 'drink-a': 3, 'drink-b': 3, 'drink-c': 2 })
  })

  it('reads purchase-score weights from content rather than code constants', () => {
    const products: Product[] = ['drink-a', 'drink-b'].map((productId) => ({ productId, name: productId, flavor: '', unitCost: 1, basePrice: 10, complexity: 1, preferenceTags: [], shelfClass: 'brewed', keepRate: 0, initiallyUnlocked: true, assetId: `${productId}-asset` }))
    const priceOnly = { ...shopContent.content.balance, price: { ...shopContent.content.balance.price, weight: 1 }, preferenceWeight: 0, reputationWeight: 0, serviceWeight: 0 }
    expect(allocateDemand(4, [{ productId: 'drink-a', prepare: 4, price: 10 }, { productId: 'drink-b', prepare: 4, price: 14 }], products, makeState(), clearDay, priceOnly)).toEqual({ 'drink-a': 4, 'drink-b': 0 })
  })

  it('applies product-specific demand before allocating visitors', () => {
    const products: Product[] = ['drink-a', 'drink-b'].map((productId) => ({
      productId, name: productId, flavor: '', unitCost: 1, basePrice: 5, complexity: 1,
      preferenceTags: [], shelfClass: 'brewed', keepRate: 0, initiallyUnlocked: true, assetId: `${productId}-asset`,
    }))
    const menu = products.map((product) => ({ productId: product.productId, prepare: 5, price: 5 }))
    const state = makeState({ modifiers: [{
      modifierId: 'drink-a-demand', target: 'product-demand', operation: 'add', value: 1,
      expiresDay: 12, productId: 'drink-a', playerLabel: 'drink-a-demand',
    }] })
    const demand = allocateDemand(8, menu, products, state, clearDay, shopContent.content.balance)
    expect(demand['drink-a']).toBeGreaterThan(demand['drink-b'])
    expect(Object.values(demand).reduce((sum, value) => sum + value, 0)).toBe(8)
  })

  it('never sells above demand or prepared inventory', () => {
    expect(settleSales(
      [{ productId: 'drink-a', prepare: 2, price: 7 }, { productId: 'drink-b', prepare: 4, price: 9 }],
      { 'drink-a': 8, 'drink-b': 1 },
    )).toEqual([
      { productId: 'drink-a', prepared: 2, demand: 8, sold: 2, unsold: 0, price: 7 },
      { productId: 'drink-b', prepared: 4, demand: 1, sold: 1, unsold: 3, price: 9 },
    ])
  })

  it('produces an explainable ledger whose lines equal the money delta', () => {
    const content = shopContent.content
    const decision = { ...basicDecision, menu: [
      { productId: 'drink-green-plum', prepare: 4, price: 7 },
      { productId: 'drink-ginger-honey', prepare: 2, price: 9 },
    ] }
    const result = calculateTrading(makeState(), clearDay, decision, content, seedRng('ledger'), { 'drink-green-plum': 3, 'drink-ginger-honey': 1 })
    expect(result.moneyDelta).toBe(1)
    expect(result.ledger.reduce((sum, line) => sum + line.amount, 0)).toBe(1)
    expect(result.sales).toEqual([
      { productId: 'drink-green-plum', prepared: 4, demand: 3, directSold: 3, substituteSold: 0, sold: 3, stockoutLost: 0, unsold: 1, price: 7 },
      { productId: 'drink-ginger-honey', prepared: 2, demand: 1, directSold: 1, substituteSold: 0, sold: 1, stockoutLost: 0, unsold: 1, price: 9 },
    ])
    expect(result.energyCost).toBe(6)
  })

  it('applies active daily money and energy modifiers', () => {
    const content = shopContent.content
    const state = makeState({ modifiers: [
      { modifierId: 'stage-money', target: 'fixed-cost', operation: 'add', value: -2, expiresDay: 20, playerLabel: '固定成本降低' },
      { modifierId: 'apprentice-energy', target: 'energy-cost', operation: 'add', value: -2, expiresDay: 20, playerLabel: '体力成本降低' },
    ] })
    const demand = Object.fromEntries(basicDecision.menu.map((item) => [item.productId, 0]))
    const baseline = calculateTrading(makeState(), clearDay, basicDecision, content, seedRng('modifier'), demand)
    const modified = calculateTrading(state, clearDay, basicDecision, content, seedRng('modifier'), demand)
    expect(modified.moneyDelta).toBe(baseline.moneyDelta + 2)
    expect(modified.energyCost).toBe(baseline.energyCost - 2)
    expect(modified.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-rent', amount: -4 })
    expect(modified.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-operating-cost', amount: -4 })
  })

  it('routes income, waste, fixed-cost, and energy modifiers into trading lines', () => {
    const state = makeState({ modifiers: [
      { modifierId: 'income', target: 'sales-income', operation: 'multiply', value: 2, expiresDay: 20, playerLabel: 'income' },
      { modifierId: 'waste', target: 'waste-return', operation: 'add', value: 1, expiresDay: 20, playerLabel: 'waste' },
      { modifierId: 'rent', target: 'fixed-cost', operation: 'add', value: 1, expiresDay: 20, playerLabel: 'rent' },
      { modifierId: 'effort', target: 'energy-cost', operation: 'add', value: 2, expiresDay: 20, playerLabel: 'effort' },
    ] })
    const decision = { ...basicDecision, menu: [{ productId: 'drink-green-plum', prepare: 2, price: 7 }] }
    const result = calculateTrading(state, clearDay, decision, shopContent.content, seedRng('targets'), { 'drink-green-plum': 1 })

    expect(result.ledger).toContainEqual({ kind: 'income', labelId: 'sales-income', amount: 14, entityId: 'drink-green-plum' })
    expect(result.ledger).toContainEqual({ kind: 'waste-return', labelId: 'waste-return', amount: 1, entityId: 'drink-green-plum' })
    expect(result.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-rent', amount: -4 })
    expect(result.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-operating-cost', amount: -7 })
    expect(result.moneyDelta).toBe(-2)
    expect(result.energyCost).toBe(7)
  })

  it('uses the content shelf return for every shelf class', () => {
    const ids = ['drink-green-plum', 'drink-perilla', 'drink-cinnamon', 'drink-lychee-paste']
    const decision = {
      ...basicDecision,
      menu: ids.map((productId) => {
        const product = shopContent.content.drinks.find((item) => item.productId === productId)!
        return { productId, prepare: 1, price: product.basePrice }
      }),
    }
    const demand: DemandResolution = {
      potentialBuyers: 0,
      servedCustomers: 0,
      losses: { stockout: 0, menuMismatch: 0, price: 0, service: 0 },
      products: ids.map((productId) => ({
        productId, directDemand: 0, directSold: 0, substituteSold: 0, prepared: 1, unsold: 1, stockoutLost: 0,
      })),
    }
    const result = calculateTrading(makeState(), clearDay, decision, shopContent.content, demand)

    ids.forEach((productId) => {
      const product = shopContent.content.drinks.find((item) => item.productId === productId)!
      const expected = Math.floor(product.unitCost * shopContent.content.balance.shelfReturnRates[product.shelfClass])
      const actual = result.ledger.find((line) => line.kind === 'waste-return' && line.entityId === productId)?.amount ?? 0
      expect(actual).toBe(expected)
    })
    expect(result.ledger.reduce((sum, line) => sum + line.amount, 0)).toBe(result.moneyDelta)
  })

  it('rejects menus outside preparation and price boundaries', () => {
    const products = shopContent.content.drinks
    expect(validateDecision(basicDecision, products)).toEqual([])
    expect(validateDecision({ ...basicDecision, menu: basicDecision.menu.slice(0, 2) }, products)).toContain('menu: 今日须上架 3–5 种饮子')
    expect(validateDecision({ ...basicDecision, menu: basicDecision.menu.map((item, index) => index === 0 ? { ...item, prepare: 13 } : item) }, products)).toContain('drink-green-plum.prepare: 备货量须为 0–12 的整数')
    expect(validateDecision({ ...basicDecision, menu: basicDecision.menu.map((item, index) => index === 0 ? { ...item, price: 3 } : item) }, products)).toContain('drink-green-plum.price: 售价须在基准价 80%–140% 的整数范围')
  })
})
