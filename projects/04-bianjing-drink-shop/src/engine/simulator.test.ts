import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DailyDecision } from '../domain/types'
import { basicDecision, makeState } from '../tests/fixtures'
import { createNewGame, openDay, resolveDay, simulateDay } from './simulator'

describe('complete deterministic day settlement', () => {
  const content = shopContent.content

  it('creates an isolated documented initial state', () => {
    const state = createNewGame('new-seed', 'save-new', content)
    expect(state).toMatchObject({ day: 1, money: 120, reputation: 10, energy: 80, relationships: 5, saveId: 'save-new', seed: 'new-seed', page: 'morning' })
    expect(state.unlockedProductIds).toHaveLength(9)
    expect(state.eventHistory).toEqual([])
  })

  it('runs sales, a deterministic day-one event, effects, and the ledger in order', () => {
    const initial = createNewGame('day-one-seed', 'save-day-one', content)
    const opened = openDay(initial, basicDecision, content)
    expect(opened.selection).toMatchObject({ kind: 'event', eventId: 'event-first-customer' })

    const result = resolveDay(opened.state, 'a', content)
    expect(result.eventId).toBe('event-first-customer')
    expect(result.choiceId).toBe('a')
    expect(result.ledger.reduce((sum, line) => sum + line.amount, 0)).toBe(result.moneyDelta)
    expect(result.nextState.money - initial.money).toBe(result.moneyDelta)
    expect(result.nextState.day).toBe(2)
    expect(result.nextState.inventory).toEqual(expect.objectContaining({ 'drink-green-plum': 0 }))
    expect(Object.values(result.nextState.inventory).every((value) => value >= 0)).toBe(true)
  })

  it('applies due scheduled effects and removes them from the queue', () => {
    const initial = createNewGame('scheduled', 'save-scheduled', content)
    initial.pendingEffects = [{ scheduledEffectId: 'due', dueDay: 1, effects: [{ type: 'money-delta', value: 6, labelId: 'scheduled-income' }] }]
    const result = simulateDay(initial, basicDecision, () => 'b', content)
    expect(result.ledger).toContainEqual({ kind: 'scheduled', labelId: 'scheduled-income', amount: 6, entityId: 'due' })
    expect(result.nextState.pendingEffects).toEqual([])
  })

  it('resolves bankruptcy after explainable daily costs', () => {
    const expensive: DailyDecision = {
      menu: content.drinks.slice(0, 5).map((product) => ({ productId: product.productId, prepare: 12, price: Math.ceil(product.basePrice * 0.8) })),
      closeEarly: false,
      strategyId: 'aggressive-loss',
    }
    const initial = createNewGame('bankrupt', 'save-bankrupt', content)
    initial.money = 1
    const result = simulateDay(initial, expensive, () => 'a', content)
    expect(result.nextState.page).toBe('bankruptcy')
    expect(result.endingId).toBe('ending-closed-early')
  })

  it('resolves day 100 and applies ending priority', () => {
    const initial = makeState({ day: 100, money: 500, reputation: 80, energy: 80, page: 'morning' })
    const result = simulateDay(initial, basicDecision, () => 'b', content)
    expect(result.nextState.page).toBe('finalEnding')
    expect(result.endingId).toBeDefined()
    expect(result.nextState.day).toBe(100)
  })

  it('routes milestone days and rejects a second resolution', () => {
    const initial = makeState({ day: 10, money: 200, page: 'morning' })
    const opened = openDay(initial, basicDecision, content)
    const result = resolveDay(opened.state, opened.selection.kind === 'none' ? undefined : 'b', content)
    expect(result.nextState.page).toBe('milestone')
    expect(() => resolveDay(result.nextState, 'b', content)).toThrow('没有待结算的营业日')
  })

  it('requires half-day protection after energy reaches zero', () => {
    expect(() => openDay(makeState({ energy: 0 }), basicDecision, content)).toThrow('体力为 0 时必须提前打烊休息半日')
  })
})
