import { describe, expect, it } from 'vitest'
import { transition } from './machine'

describe('experience state machine', () => {
  it('accepts only the first select click', () => {
    const spinning = { tag: 'spinning', run: 0 } as const
    const slowing = transition(spinning, { type: 'select', messageId: 'calm-01' })
    expect(slowing).toEqual({ tag: 'slowing', run: 0, messageId: 'calm-01' })
    expect(transition(slowing, { type: 'select', messageId: 'hope-01' })).toBe(slowing)
  })

  it('allows only the documented automatic state order', () => {
    const slowing = { tag: 'slowing', run: 2, messageId: 'calm-01' } as const
    const selected = transition(slowing, { type: 'advance' })
    expect(selected.tag).toBe('selected')
    expect(transition(selected, { type: 'replay' })).toBe(selected)

    const wind = transition(selected, { type: 'advance' })
    const opening = transition(wind, { type: 'advance' })
    const stars = transition(opening, { type: 'advance' })
    const result = transition(stars, { type: 'advance' })
    expect([wind.tag, opening.tag, stars.tag, result.tag]).toEqual([
      'wind', 'window-opening', 'stars-entering', 'result',
    ])
  })

  it('locks replay and increments the run only after reset completes', () => {
    const result = { tag: 'result', run: 4, messageId: 'dream-12' } as const
    const resetting = transition(result, { type: 'replay' })
    expect(resetting).toEqual({ tag: 'resetting', run: 4, previousMessageId: 'dream-12' })
    expect(transition(resetting, { type: 'replay' })).toBe(resetting)
    expect(transition(resetting, { type: 'reset-complete' })).toEqual({ tag: 'spinning', run: 5 })
  })
})
