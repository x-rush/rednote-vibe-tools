import { describe, expect, it, vi } from 'vitest'
import type { BodyShape } from '../domain/types'
import { circleBody } from '../tests/fixtures'
import * as containment from './containment'

const polygon = (points: number[][], center = { x: 0, y: 0 }, radius = 30): BodyShape => ({ center, radius, contour: points.map(([x, y]) => ({ x: x!, y: y! })) })

describe('exact full membrane containment', () => {
  it('avoids a square-root walk over every vertex pair for deeply enclosed food', () => {
    const outer = circleBody({ x: 0, y: 0 }, 100)
    const inner = circleBody({ x: 8, y: 4 }, 5)
    const hypot = vi.spyOn(Math, 'hypot')
    try {
      expect(containment.fullyContains(outer, inner)).toBe(true)
      expect(hypot.mock.calls.length).toBeLessThanOrEqual(2)
    } finally { hypot.mockRestore() }
  })

  it('rejects the open notch when the declared center is outside a concave contour', () => {
    const notch = polygon([[0, 0], [10, 0], [10, 10], [7, 10], [7, 3], [3, 3], [3, 10], [0, 10]], { x: 5, y: 6 })
    expect(containment.fullyContains(notch, circleBody({ x: 5, y: 6 }, 0.5))).toBe(false)
    expect(containment.fullyContains(notch, circleBody({ x: 1.5, y: 6 }, 0.5))).toBe(true)
    notch.center = { x: 1.5, y: 6 }
    expect(containment.fullyContains(notch, circleBody({ x: 5, y: 6 }, 0.5))).toBe(false)
  })

  it('preserves coincident boundaries and exact explicit edge tolerance', () => {
    const square = polygon([[-10, -10], [10, -10], [10, 10], [-10, 10]])
    expect(containment.fullyContains(square, { ...square, contour: [...square.contour] })).toBe(true)
    const touching = polygon([[10.125, -1], [10.125, 1], [9, 0]], { x: 10, y: 0 }, 2)
    expect(containment.fullyContains(square, touching)).toBe(false)
    expect(containment.fullyContains(square, touching, 0.125)).toBe(true)
    expect(containment.fullyContains(square, touching, 0.124)).toBe(false)
    expect(containment.fullyContains(square, touching, -1)).toBe(false)
  })

  it('keeps a rotated thin body exact and never caches mutable contour geometry', () => {
    const rootHalf = Math.SQRT1_2
    const thin = polygon([[-12, -2], [12, -2], [12, 2], [-12, 2]].map(([x, y]) => [(x! - y!) * rootHalf, (x! + y!) * rootHalf]))
    expect(containment.fullyContains(thin, circleBody({ x: 8, y: 0 }, 0.5))).toBe(false)
    expect(containment.fullyContains(thin, circleBody({ x: 5, y: 5 }, 0.5))).toBe(true)
    thin.contour = polygon([[-1, -1], [1, -1], [1, 1], [-1, 1]]).contour
    expect(containment.fullyContains(thin, circleBody({ x: 5, y: 5 }, 0.5))).toBe(false)
  })
})

describe('majority geometric containment', () => {
  it('accepts a larger cell after covering at least seventy percent of the target', () => {
    expect('coveredRatio' in containment).toBe(true)
    if (!('coveredRatio' in containment)) return
    const predator = circleBody({ x: 0, y: 0 }, 20)
    const prey = circleBody({ x: 18, y: 0 }, 5)

    expect(containment.coveredRatio(predator, prey)).toBeGreaterThan(0.7)
    expect(containment.mostlyContains(predator, prey, 0.7)).toBe(true)
  })

  it('rejects overlap below seventy percent', () => {
    const predator = circleBody({ x: 0, y: 0 }, 20)
    const prey = circleBody({ x: 19, y: 0 }, 5)

    expect(containment.mostlyContains(predator, prey, 0.7)).toBe(false)
  })

  it('rejects a container that is not larger than its target', () => {
    const sameSize = circleBody({ x: 0, y: 0 }, 10)
    const target = circleBody({ x: 0, y: 0 }, 10)

    expect(containment.mostlyContains(sameSize, target, 0.7)).toBe(false)
  })
})
