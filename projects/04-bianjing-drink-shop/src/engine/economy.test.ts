import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DayContext, Product } from '../domain/types'
import { seedRng } from '../domain/rng'
import { basicDecision, makeState } from '../tests/fixtures'
import { allocateDemand, calculateTrading, calculateVisitors, settleSales, validateDecision } from './economy'

const clearDay: DayContext = { day: 10, weatherId: 'weather-clear', seasonId: 'season-early-spring', eventVisitorDelta: 0, activeTags: [] }

describe('deterministic daily economy', () => {
  it('calculates visitors with capped reputation growth and weather', () => {
    const { balance, weather } = shopContent.content
    expect(calculateVisitors(makeState({ day: 10, reputation: 20 }), clearDay, balance, weather)).toBe(10)
    expect(calculateVisitors(makeState({ day: 10, reputation: 80 }), clearDay, balance, weather)).toBe(16)
    expect(calculateVisitors(makeState({ day: 10, reputation: 20 }), { ...clearDay, weatherId: 'weather-rain' }, balance, weather)).toBe(8)
  })

  it('allocates literal demand without losing visitor units', () => {
    const products: Product[] = ['drink-a', 'drink-b', 'drink-c'].map((productId) => ({
      productId, name: productId, flavor: '', unitCost: 1, basePrice: 5, complexity: 1,
      preferenceTags: [], keepRate: 0, initiallyUnlocked: true, assetId: `${productId}-asset`,
    }))
    const menu = products.map((product) => ({ productId: product.productId, prepare: 5, price: 5 }))
    expect(allocateDemand(8, menu, products, makeState(), clearDay, shopContent.content.balance)).toEqual({ 'drink-a': 3, 'drink-b': 3, 'drink-c': 2 })
  })

  it('reads purchase-score weights from content rather than code constants', () => {
    const products: Product[] = ['drink-a', 'drink-b'].map((productId) => ({ productId, name: productId, flavor: '', unitCost: 1, basePrice: 10, complexity: 1, preferenceTags: [], keepRate: 0, initiallyUnlocked: true, assetId: `${productId}-asset` }))
    const priceOnly = { ...shopContent.content.balance, price: { ...shopContent.content.balance.price, weight: 1 }, preferenceWeight: 0, reputationWeight: 0, serviceWeight: 0 }
    expect(allocateDemand(4, [{ productId: 'drink-a', prepare: 4, price: 10 }, { productId: 'drink-b', prepare: 4, price: 14 }], products, makeState(), clearDay, priceOnly)).toEqual({ 'drink-a': 4, 'drink-b': 0 })
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
    expect(result.moneyDelta).toBe(9)
    expect(result.ledger.reduce((sum, line) => sum + line.amount, 0)).toBe(9)
    expect(result.sales).toEqual([
      { productId: 'drink-green-plum', prepared: 4, demand: 3, sold: 3, unsold: 1, price: 7 },
      { productId: 'drink-ginger-honey', prepared: 2, demand: 1, sold: 1, unsold: 1, price: 9 },
    ])
    expect(result.energyCost).toBe(5)
  })

  it('applies active daily money and energy modifiers', () => {
    const content = shopContent.content
    const state = makeState({ modifiers: [
      { modifierId: 'stage-money', value: 3, expiresDay: 20 },
      { modifierId: 'apprentice-energy', value: 2, expiresDay: 20 },
    ] })
    const demand = Object.fromEntries(basicDecision.menu.map((item) => [item.productId, 0]))
    const baseline = calculateTrading(makeState(), clearDay, basicDecision, content, seedRng('modifier'), demand)
    const modified = calculateTrading(state, clearDay, basicDecision, content, seedRng('modifier'), demand)
    expect(modified.moneyDelta).toBe(baseline.moneyDelta + 3)
    expect(modified.energyCost).toBe(baseline.energyCost - 2)
    expect(modified.ledger).toContainEqual({ kind: 'event', labelId: 'modifier-stage-money', amount: 3, entityId: 'stage-money' })
  })

  it('rejects menus outside preparation and price boundaries', () => {
    const products = shopContent.content.drinks
    expect(validateDecision(basicDecision, products)).toEqual([])
    expect(validateDecision({ ...basicDecision, menu: basicDecision.menu.slice(0, 2) }, products)).toContain('menu: 今日须上架 3–5 种饮子')
    expect(validateDecision({ ...basicDecision, menu: basicDecision.menu.map((item, index) => index === 0 ? { ...item, prepare: 13 } : item) }, products)).toContain('drink-green-plum.prepare: 备货量须为 0–12 的整数')
    expect(validateDecision({ ...basicDecision, menu: basicDecision.menu.map((item, index) => index === 0 ? { ...item, price: 3 } : item) }, products)).toContain('drink-green-plum.price: 售价须在基准价 80%–140% 的整数范围')
  })
})
