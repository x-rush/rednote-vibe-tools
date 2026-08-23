import { describe, expect, it } from 'vitest'
import type { EventCondition } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { conditionsMatch, evaluateCondition } from './conditions'

describe('finite event conditions', () => {
  const state = makeState({
    day: 42, money: 30, reputation: 55, flags: ['trusted'],
    triggeredEventIds: ['event-signboard'],
    chainProgress: { 'chain-poet': { chainId: 'chain-poet', status: 'completed', nodeIndex: 3, startedDay: 4, lastAdvancedDay: 12 } },
  })

  it.each<[EventCondition, boolean]>([
    [{ type: 'day-range', min: 40, max: 50 }, true],
    [{ type: 'stat-at-least', stat: 'reputation', value: 55 }, true],
    [{ type: 'stat-at-most', stat: 'relationships', value: 14 }, false],
    [{ type: 'money-at-least', value: 30 }, true],
    [{ type: 'money-at-most', value: 29 }, false],
    [{ type: 'has-flag', flag: 'trusted' }, true],
    [{ type: 'lacks-flag', flag: 'missing' }, true],
    [{ type: 'event-seen', eventId: 'event-signboard' }, true],
    [{ type: 'event-not-seen', eventId: 'event-signboard' }, false],
    [{ type: 'chain-status', chainId: 'chain-poet', status: 'completed' }, true],
    [{ type: 'completed-chain-count-at-least', value: 1 }, true],
    [{ type: 'inventory-at-least', productId: 'drink-green-plum', value: 2 }, true],
  ])('evaluates %o as %s', (condition, expected) => {
    expect(evaluateCondition(condition, state)).toBe(expected)
  })

  it('supports nested all, any, and not without expression strings', () => {
    expect(conditionsMatch([{ type: 'all', conditions: [
      { type: 'has-flag', flag: 'trusted' },
      { type: 'any', conditions: [{ type: 'money-at-most', value: 10 }, { type: 'not', condition: { type: 'money-at-most', value: 10 } }] },
    ] }], state)).toBe(true)
  })
})
