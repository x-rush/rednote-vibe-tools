import { describe, expect, it } from 'vitest'
import { createTestEngine } from '../tests/fixtures'

describe('game engine lifecycle', () => {
  it('does not advance while paused', () => {
    const engine = createTestEngine()
    engine.pause('visibility')
    engine.advance(1000)

    expect(engine.snapshot().elapsedMs).toBe(0)
  })

  it('advances in fixed steps only after start and resume', () => {
    const engine = createTestEngine()
    engine.advance(1000 / 30)
    const elapsed = engine.snapshot().elapsedMs
    engine.pause('user')
    engine.advance(100)
    engine.resume('user')
    engine.advance(1000 / 60)

    expect(elapsed).toBeCloseTo(1000 / 30)
    expect(engine.snapshot().elapsedMs).toBeCloseTo(50)
  })
})
