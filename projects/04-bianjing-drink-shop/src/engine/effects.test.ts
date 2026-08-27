import { describe, expect, it } from 'vitest'
import type { EventEffect } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { advanceOperatingModifiers, applyEffects } from './effects'

describe('event effect application', () => {
  it('applies all finite effect kinds immutably and explains money', () => {
    const initial = makeState({ money: 20, reputation: 99, energy: 2, flags: ['old'] })
    const effects: EventEffect[] = [
      { type: 'money-delta', value: -7, labelId: 'repair' },
      { type: 'stat-delta', stat: 'reputation', value: 5, labelId: 'trust' },
      { type: 'stat-delta', stat: 'energy', value: -9, labelId: 'effort' },
      { type: 'inventory-delta', productId: 'drink-green-plum', value: -9, labelId: 'stock' },
      { type: 'add-flag', flag: 'new' },
      { type: 'remove-flag', flag: 'old' },
      { type: 'unlock-product', productId: 'drink-signature' },
      {
        type: 'set-modifier',
        modifierId: 'capacity',
        target: 'visitor-count',
        operation: 'add',
        value: 2,
        durationDays: 5,
        playerLabel: '熟客帮忙招徕，五日内每日客流增加',
      },
      { type: 'schedule-effect', delayDays: 2, effects: [{ type: 'money-delta', value: 4, labelId: 'later' }] },
      { type: 'start-chain', chainId: 'chain-poet' },
      { type: 'advance-chain', chainId: 'chain-poet', nodeId: 'poet-credit' },
    ]

    const result = applyEffects(initial, effects, { day: 10, sourceId: 'test-event' })

    expect(result.state.money).toBe(13)
    expect(result.state.reputation).toBe(100)
    expect(result.state.energy).toBe(0)
    expect(result.state.inventory['drink-green-plum']).toBe(0)
    expect(result.state.flags).toEqual(['new'])
    expect(result.state.unlockedProductIds).toContain('drink-signature')
    expect(result.state.modifiers[0]).toEqual({
      modifierId: 'capacity',
      target: 'visitor-count',
      operation: 'add',
      value: 2,
      expiresDay: 100,
      productId: undefined,
      playerLabel: '熟客帮忙招徕，五日内每日客流增加',
      durationBasis: 'operating',
      remainingOperatingDays: 5,
    })
    expect(result.activatedModifierIds).toEqual(['capacity'])
    expect(result.state.pendingEffects[0]?.dueDay).toBe(18)
    expect(result.state.chainProgress['chain-poet']?.status).toBe('active')
    expect(result.state.chainProgress['chain-poet']?.nodeIndex).toBe(0)
    expect(result.ledger).toEqual([{ kind: 'event', labelId: 'repair', amount: -7, entityId: 'test-event' }])
    expect(initial.money).toBe(20)
  })

  it('interrupts an active chain with a reason', () => {
    const state = makeState({ chainProgress: { 'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 1, startedDay: 4, lastAdvancedDay: 4 } } })
    const result = applyEffects(state, [{ type: 'interrupt-chain', chainId: 'chain-poet', reason: 'timeout' }], { day: 20, sourceId: 'chain-poet' })
    expect(result.state.chainProgress['chain-poet']).toMatchObject({ status: 'interrupted', reason: 'timeout' })
  })

  it('decrements operating modifiers only after a trading day', () => {
    const state = makeState({ modifiers: [{
      modifierId: 'pawn-effort', target: 'energy-cost', operation: 'add', value: 2, expiresDay: 100,
      playerLabel: '少一只铜壶', durationBasis: 'operating', remainingOperatingDays: 2,
    }] })
    expect(advanceOperatingModifiers(state, 'rest').modifiers[0]?.remainingOperatingDays).toBe(2)
    const afterFirst = advanceOperatingModifiers(state, 'half')
    expect(afterFirst.modifiers[0]?.remainingOperatingDays).toBe(1)
    expect(advanceOperatingModifiers(afterFirst, 'full').modifiers).toEqual([])
  })
})
