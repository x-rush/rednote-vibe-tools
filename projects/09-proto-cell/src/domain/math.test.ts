import { describe, expect, it } from 'vitest'
import { add, length, lerp, normalize, scale } from './math'

describe('vector math', () => {
  it('normalizes a zero vector safely', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('combines and interpolates vectors without mutating inputs', () => {
    const left = { x: 3, y: 4 }
    const right = { x: -1, y: 2 }

    expect(length(left)).toBe(5)
    expect(add(left, right)).toEqual({ x: 2, y: 6 })
    expect(scale(left, 2)).toEqual({ x: 6, y: 8 })
    expect(lerp(left, right, 0.25)).toEqual({ x: 2, y: 3.5 })
    expect(left).toEqual({ x: 3, y: 4 })
  })
})
