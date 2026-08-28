import { describe, expect, it } from 'vitest'
import * as bounds from './bounds'

describe('accessible world bounds', () => {
  it('keeps edible targets far enough from a corner for the player to engulf them', () => {
    expect('engulfAccessMargin' in bounds).toBe(true)
    if (!('engulfAccessMargin' in bounds)) return

    expect(bounds.engulfAccessMargin(5, [20])).toBe(20)
    expect(bounds.engulfAccessMargin(24, [20])).toBe(24)
  })

  it('removes velocity pressing into a wall so reversing responds immediately', () => {
    expect('constrainWorldMotion' in bounds).toBe(true)
    if (!('constrainWorldMotion' in bounds)) return

    expect(bounds.constrainWorldMotion(
      { x: 18, y: 300 },
      { x: -80, y: 12 },
      { width: 640, height: 1100, margin: 20 },
    )).toEqual({ position: { x: 20, y: 300 }, velocity: { x: 0, y: 12 } })
  })
})
