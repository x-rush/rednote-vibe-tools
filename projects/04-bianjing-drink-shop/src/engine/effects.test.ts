import { describe, expect, it } from 'vitest'
import type { EventEffect } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { applyEffects } from './effects'

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
      { type: 'set-modifier', modifierId: 'capacity', value: 2, durationDays: 5 },
      { type: 'schedule-effect', delayDays: 2, effects: [{ type: 'money-delta', value: 4, labelId: 'later' }] },
      { type: 'advance-chain', chainId: 'chain-poet', nodeId: 'poet-credit' },
    ]

    const result = applyEffects(initial, effects, { day: 10, sourceId: 'test-event' })

    expect(result.state.money).toBe(13)
    expect(result.state.reputation).toBe(100)
    expect(result.state.energy).toBe(0)
    expect(result.state.inventory['drink-green-plum']).toBe(0)
    expect(result.state.flags).toEqual(['new'])
    expect(result.state.unlockedProductIds).toContain('drink-signature')
    expect(result.state.modifiers[0]).toEqual({ modifierId: 'capacity', value: 2, expiresDay: 15 })
    expect(result.state.pendingEffects[0]?.dueDay).toBe(12)
    expect(result.state.chainProgress['chain-poet']?.status).toBe('active')
    expect(result.ledger).toEqual([{ kind: 'event', labelId: 'repair', amount: -7, entityId: 'test-event' }])
    expect(initial.money).toBe(20)
  })

  it('interrupts an active chain with a reason', () => {
    const state = makeState({ chainProgress: { 'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 1, startedDay: 4, lastAdvancedDay: 4 } } })
    const result = applyEffects(state, [{ type: 'interrupt-chain', chainId: 'chain-poet', reason: 'timeout' }], { day: 20, sourceId: 'chain-poet' })
    expect(result.state.chainProgress['chain-poet']).toMatchObject({ status: 'interrupted', reason: 'timeout' })
  })
})
