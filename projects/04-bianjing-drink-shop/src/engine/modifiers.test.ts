import { describe, expect, it } from 'vitest'
import type { ActiveModifier, ModifierTarget } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { modifierAdd, modifierFactor } from './modifiers'

const modifier = (
  modifierId: string,
  target: ModifierTarget,
  operation: ActiveModifier['operation'],
  value: number,
  productId?: string,
): ActiveModifier => ({
  modifierId,
  target,
  operation,
  value,
  expiresDay: 20,
  productId,
  playerLabel: modifierId,
})

describe('generic long-term modifiers', () => {
  it('aggregates additive values for every supported target', () => {
    const state = makeState({ modifiers: [
      modifier('visitors', 'visitor-count', 'add', 3),
      modifier('energy', 'energy-cost', 'add', -2),
      modifier('rent', 'fixed-cost', 'add', 1),
      modifier('income', 'sales-income', 'add', 2),
      modifier('waste', 'waste-return', 'add', 1),
      modifier('plum-demand', 'product-demand', 'add', 2, 'drink-green-plum'),
    ] })

    expect(modifierAdd(state, 'visitor-count', 12)).toBe(3)
    expect(modifierAdd(state, 'energy-cost', 12)).toBe(-2)
    expect(modifierAdd(state, 'fixed-cost', 12)).toBe(1)
    expect(modifierAdd(state, 'sales-income', 12)).toBe(2)
    expect(modifierAdd(state, 'waste-return', 12)).toBe(1)
    expect(modifierAdd(state, 'product-demand', 12, 'drink-green-plum')).toBe(2)
    expect(modifierAdd(state, 'product-demand', 12, 'drink-ginger-honey')).toBe(0)
  })

  it('multiplies factors and ignores expired modifiers', () => {
    const state = makeState({ modifiers: [
      modifier('income-a', 'sales-income', 'multiply', 0.9),
      modifier('income-b', 'sales-income', 'multiply', 0.8),
      { ...modifier('expired', 'visitor-count', 'add', 99), expiresDay: 11 },
    ] })

    expect(modifierFactor(state, 'sales-income', 12)).toBeCloseTo(0.72)
    expect(modifierFactor(state, 'visitor-count', 12)).toBe(1)
    expect(modifierAdd(state, 'visitor-count', 12)).toBe(0)
  })

})
