import { describe, expect, it } from 'vitest'
import { transition } from './machine'

describe('experience state machine', () => {
  it('starts once and advances only through the wind narrative', () => {
    const idle = { tag: 'idle', run: 0 } as const
    const wind = transition(idle, { type: 'begin', messageId: 'calm-01' })
    expect(wind).toEqual({ tag: 'wind', run: 0, messageId: 'calm-01' })
    expect(transition(wind, { type: 'begin', messageId: 'hope-01' })).toBe(wind)

    const curtain = transition(wind, { type: 'advance' })
    const stars = transition(curtain, { type: 'advance' })
    const result = transition(stars, { type: 'advance' })
    expect([curtain.tag, stars.tag, result.tag]).toEqual([
      'curtain-opening', 'stars-and-letters', 'result',
    ])
  })

  it('returns to idle only after reset completes', () => {
    const result = { tag: 'result', run: 4, messageId: 'dream-12' } as const
    const resetting = transition(result, { type: 'replay' })
    expect(resetting).toEqual({ tag: 'resetting', run: 4, previousMessageId: 'dream-12' })
    expect(transition(resetting, { type: 'replay' })).toBe(resetting)
    expect(transition(resetting, { type: 'reset-complete' })).toEqual({ tag: 'idle', run: 5 })
  })
})
