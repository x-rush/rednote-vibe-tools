import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { DailyDecision } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { resolveOperatingMode } from './operating-mode'
import { openDay, resolveDay } from './simulator'

const menu: DailyDecision['menu'] = [
  { productId: 'drink-green-plum', prepare: 4, price: 7 },
  { productId: 'drink-ginger-honey', prepare: 4, price: 9 },
  { productId: 'drink-perilla', prepare: 4, price: 11 },
]

describe('operating modes', () => {
  it('uses the explicit full, half, or rest mode', () => {
    expect(resolveOperatingMode({ menu, operatingMode: 'full', strategyId: 'full' })).toBe('full')
    expect(resolveOperatingMode({ menu, operatingMode: 'half', strategyId: 'half' })).toBe('half')
    expect(resolveOperatingMode({ menu: [], operatingMode: 'rest', strategyId: 'rest' })).toBe('rest')
  })

  it('forbids every selling mode when energy has reached zero', () => {
    const state = makeState({ energy: 0 })
    const full: DailyDecision = { menu, operatingMode: 'full', strategyId: 'full' }
    const half: DailyDecision = { menu, operatingMode: 'half', strategyId: 'half' }

    expect(() => openDay(state, full, shopContent.content)).toThrow('体力见底，今日只能休息')
    expect(() => openDay(state, half, shopContent.content)).toThrow('体力见底，今日只能休息')
  })

  it('advances a real rest day with rent, no sales, and recovered energy', () => {
    const state = makeState({ day: 10, energy: 0, money: 120 })
    const decision: DailyDecision = { menu: [], operatingMode: 'rest', strategyId: 'rest' }
    const opened = openDay(state, decision, shopContent.content)

    expect(opened.selection.kind).toBe('none')
    expect(opened.state.pendingOpening).toMatchObject({
      operatingMode: 'rest',
      footTraffic: 0,
      buyers: 0,
      sales: [],
      energyDelta: 18,
    })

    const result = resolveDay(opened.state, undefined, shopContent.content)
    expect(result.nextState).toMatchObject({ operatingDay: 5, day: 14 })
    expect(result.nextState.energy).toBe(18)
    expect(result.nextState.money).toBe(116)
    expect(result.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-rent', amount: -4 })
  })

  it('gives half-day trade lower traffic and lower energy cost than a full day', () => {
    const state = makeState({ day: 10, energy: 80 })
    const full = openDay(state, { menu, operatingMode: 'full', strategyId: 'full' }, shopContent.content).state.pendingOpening!
    const half = openDay(state, { menu, operatingMode: 'half', strategyId: 'half' }, shopContent.content).state.pendingOpening!

    expect(half.footTraffic).toBeLessThan(full.footTraffic!)
    expect(half.energyDelta).toBeGreaterThan(full.energyDelta!)
  })

  it('separates unavoidable rent from mode-specific operating cost', () => {
    const state = makeState({ day: 10, energy: 80 })
    const full = openDay(state, { menu, operatingMode: 'full', strategyId: 'full' }, shopContent.content).state.pendingOpening!
    const half = openDay(state, { menu, operatingMode: 'half', strategyId: 'half' }, shopContent.content).state.pendingOpening!

    expect(full.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-rent', amount: -4 })
    expect(full.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-operating-cost', amount: -6 })
    expect(half.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-rent', amount: -4 })
    expect(half.ledger).toContainEqual({ kind: 'fixed-cost', labelId: 'daily-operating-cost', amount: -1 })
  })
})
