import { describe, expect, it } from 'vitest'
import { createFixedClock } from './clock'

describe('fixed-step clock', () => {
  it('caps catch-up work after a long pause and discards the excess', () => {
    const clock = createFixedClock({ stepMs: 1000 / 60, maxSteps: 5 })
    let steps = 0

    const first = clock.advance(5000, () => { steps += 1 })
    const next = clock.advance(0, () => { steps += 1 })

    expect(first.steps).toBe(5)
    expect(next.steps).toBe(0)
    expect(steps).toBe(5)
  })

  it('returns interpolation alpha for the unconsumed fraction and resets it', () => {
    const clock = createFixedClock({ stepMs: 10, maxSteps: 5 })

    expect(clock.advance(15, () => undefined)).toEqual({ steps: 1, alpha: 0.5 })
    clock.reset()
    expect(clock.advance(0, () => undefined)).toEqual({ steps: 0, alpha: 0 })
  })
})
