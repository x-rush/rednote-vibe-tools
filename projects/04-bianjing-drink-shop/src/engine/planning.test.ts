import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DailyDecision } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { estimateOpeningBudget, validateDecision } from './economy'
import { recommendDecision, reuseLastDecision } from './planning'

const content = shopContent.content

describe('preparation plan helpers', () => {
  it('recommends three base-price drinks without spending cash below zero', () => {
    const state = makeState({ money: 30 })
    const plan = recommendDecision(state, state.dayForecast!, content)
    const estimate = estimateOpeningBudget(state, plan, state.dayForecast!, content)

    expect(plan.menu).toHaveLength(3)
    expect(estimate.cashAfterOpening).toBeGreaterThanOrEqual(0)
    expect(plan.menu.every((item) => item.price === content.drinks.find((drink) => drink.productId === item.productId)?.basePrice)).toBe(true)
    expect(plan.menu.every((item) => item.prepare >= 1 && item.prepare <= 6)).toBe(true)
    expect(validateDecision(plan, content.drinks)).toEqual([])
  })

  it('rests when energy is zero or even three single units are unaffordable', () => {
    expect(recommendDecision(makeState({ energy: 0 }), makeState().dayForecast!, content)).toMatchObject({ operatingMode: 'rest', menu: [] })
    expect(recommendDecision(makeState({ money: 4 }), makeState().dayForecast!, content)).toMatchObject({ operatingMode: 'rest', menu: [] })
  })

  it('reuses a copied plan while removing locked items and clamping current rules', () => {
    const previous: DailyDecision = {
      operatingMode: 'full',
      strategyId: 'player',
      menu: [
        { productId: 'drink-green-plum', prepare: 99, price: 99 },
        { productId: 'drink-ginger-honey', prepare: -4, price: 1 },
        { productId: 'drink-perilla', prepare: 4, price: 11 },
        { productId: 'drink-lychee-paste', prepare: 4, price: 13 },
      ],
    }
    const state = makeState({
      lastDecision: previous,
      unlockedProductIds: ['drink-green-plum', 'drink-ginger-honey', 'drink-perilla'],
    })
    const reused = reuseLastDecision(state, content)

    expect(reused?.menu.map((item) => item.productId)).toEqual(['drink-green-plum', 'drink-ginger-honey', 'drink-perilla'])
    expect(reused?.menu[0]).toMatchObject({ prepare: 12, price: 9 })
    expect(reused?.menu[1]).toMatchObject({ prepare: 0, price: 8 })
    expect(reused).not.toBe(previous)
    expect(reused?.menu).not.toBe(previous.menu)
    expect(validateDecision(reused!, content.drinks)).toEqual([])
  })

  it('returns undefined when fewer than three prior products remain valid', () => {
    const state = makeState({
      lastDecision: {
        operatingMode: 'full', strategyId: 'player', menu: [
          { productId: 'drink-green-plum', prepare: 3, price: 7 },
          { productId: 'drink-ginger-honey', prepare: 3, price: 9 },
          { productId: 'drink-perilla', prepare: 3, price: 11 },
        ],
      },
      unlockedProductIds: ['drink-green-plum', 'drink-ginger-honey'],
    })
    expect(reuseLastDecision(state, content)).toBeUndefined()
  })
})
