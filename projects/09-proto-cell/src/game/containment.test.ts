import { describe, expect, it } from 'vitest'
import { circleBody } from '../tests/fixtures'
import { fullyContains } from './containment'

describe('complete geometric containment', () => {
  it('does not engulf on partial overlap', () => {
    const predator = circleBody({ x: 0, y: 0 }, 20)
    const prey = circleBody({ x: 18, y: 0 }, 5)

    expect(fullyContains(predator, prey, 0.5)).toBe(false)
  })

  it('accepts a target only when every contour point is inside', () => {
    const predator = circleBody({ x: 0, y: 0 }, 20)
    const prey = circleBody({ x: 6, y: 2 }, 5)

    expect(fullyContains(predator, prey, 0.5)).toBe(true)
  })
})
