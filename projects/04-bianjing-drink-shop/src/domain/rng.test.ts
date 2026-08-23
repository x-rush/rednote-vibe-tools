import { describe, expect, it } from 'vitest'
import { nextRandom, seedRng } from './rng'

describe('serializable seeded rng', () => {
  it('replays the same sequence from the same seed', () => {
    const first = seedRng('shop-seed-1')
    const a = nextRandom(first)
    const b = nextRandom(a.state)
    const replayA = nextRandom(seedRng('shop-seed-1'))
    const replayB = nextRandom(replayA.state)

    expect([a.value, b.value]).toEqual([replayA.value, replayB.value])
    expect(a.state).toEqual(replayA.state)
  })

  it('continues exactly from a persisted uint32 state', () => {
    const first = nextRandom(seedRng('persist-me'))
    const expected = nextRandom(first.state)
    const restored = nextRandom({ value: first.state.value })

    expect(restored).toEqual(expected)
  })

  it('separates different seeds', () => {
    expect(nextRandom(seedRng('seed-a')).value).not.toBe(nextRandom(seedRng('seed-b')).value)
  })
})
