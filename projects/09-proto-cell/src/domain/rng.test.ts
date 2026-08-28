import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

describe('deterministic rng', () => {
  it('repeats and forks without sharing cursor state', () => {
    const a = createRng(727)
    const b = createRng(727)

    expect([a.next(), a.next()]).toEqual([b.next(), b.next()])
    expect(a.fork('organs').next()).toBe(createRng(727).fork('organs').next())
  })

  it('keeps float and integer results inside their requested bounds', () => {
    const rng = createRng(91)
    const floats = Array.from({ length: 32 }, () => rng.next())
    const integers = Array.from({ length: 32 }, () => rng.int(3, 8))

    expect(floats.every((value) => value >= 0 && value < 1)).toBe(true)
    expect(integers.every((value) => value >= 3 && value < 8 && Number.isInteger(value))).toBe(true)
  })
})
