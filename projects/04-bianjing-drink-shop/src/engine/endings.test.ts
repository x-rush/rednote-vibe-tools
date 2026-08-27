import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { makeState } from '../tests/fixtures'
import { resolveEnding } from './endings'

describe('ending resolution', () => {
  const endings = shopContent.content.endings

  it('does not end the save before the unused recovery offer', () => {
    expect(resolveEnding(makeState({ day: 20, money: -1 }), endings)).toBeUndefined()
  })

  it('allows immediate closure after the recovery has already been used', () => {
    const state = makeState({ day: 20, money: -1, financialHealth: { phase: 'normal', rescueUsed: true } })
    expect(resolveEnding(state, endings)?.primary.endingId).toBe('ending-closed-early')
  })

  it('does not resolve a non-bankrupt game on day 99', () => {
    expect(resolveEnding(makeState({ day: 99, money: 0 }), endings)).toBeUndefined()
  })

  it('falls back to the basic hundred-day ending', () => {
    expect(resolveEnding(makeState({ day: 100, money: 20, reputation: 10, energy: 20, relationships: 10 }), endings)?.primary.endingId).toBe('ending-hundred-days')
  })

  it('chooses the highest-priority match and unlocks every matching ending', () => {
    const state = makeState({
      day: 100, money: 500, reputation: 90, energy: 80, relationships: 90,
      flags: ['shared-drain-cleared', 'signature-launched'],
      chainProgress: Object.fromEntries(['chain-poet','chain-festival','chain-apprentice','chain-signature'].map((chainId) => [chainId, { chainId, status: 'completed' as const, nodeIndex: 3, startedDay: 10, lastAdvancedDay: 80 }])),
    })
    const resolution = resolveEnding(state, endings)
    expect(resolution?.primary.endingId).toBe('ending-chain-master')
    expect(resolution?.unlocked.map((ending) => ending.endingId)).toEqual(expect.arrayContaining([
      'ending-hundred-days', 'ending-famous-cup', 'ending-neighbor-heart', 'ending-balanced-life', 'ending-chain-master',
    ]))
  })

  it.each([
    ['ending-closed-early', makeState({ day: 3, money: -1, financialHealth: { phase: 'normal', rescueUsed: true } })],
    ['ending-hundred-days', makeState({ day: 100, money: 20, reputation: 10, energy: 10, relationships: 10 })],
    ['ending-rich-shop', makeState({ day: 100, money: 500, reputation: 60, energy: 10, relationships: 10 })],
    ['ending-famous-cup', makeState({ day: 100, money: 20, reputation: 80, flags: ['signature-launched'], chainProgress: { 'chain-signature': { chainId: 'chain-signature', status: 'completed', nodeIndex: 3, startedDay: 40, lastAdvancedDay: 70 } } })],
    ['ending-neighbor-heart', makeState({ day: 100, money: 200, reputation: 10, relationships: 80, flags: ['shared-drain-cleared'] })],
    ['ending-balanced-life', makeState({ day: 100, money: 20, reputation: 10, energy: 80, relationships: 25 })],
    ['ending-chain-master', makeState({ day: 100, chainProgress: Object.fromEntries(['chain-poet','chain-festival','chain-apprentice','chain-official-order'].map((chainId) => [chainId, { chainId, status: 'completed' as const, nodeIndex: 3, startedDay: 10, lastAdvancedDay: 80 }])) })],
    ['ending-quiet-craft', makeState({ day: 100, money: 100, reputation: 40, energy: 20, relationships: 10, flags: ['stable-craft'] })],
  ])('makes %s reachable from an explicit qualifying state', (endingId, state) => {
    expect(resolveEnding(state, endings)?.unlocked.some((ending) => ending.endingId === endingId)).toBe(true)
  })

  it('does not call an unreleased completed signature drink famous', () => {
    const state = makeState({ day: 100, reputation: 100, flags: ['signature-shelved'], chainProgress: { 'chain-signature': { chainId: 'chain-signature', status: 'completed', nodeIndex: 2, startedDay: 40, lastAdvancedDay: 70 } } })
    expect(resolveEnding(state, endings)?.unlocked.some((ending) => ending.endingId === 'ending-famous-cup')).toBe(false)
  })
})
