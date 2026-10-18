import { describe, expect, it } from 'vitest'
import { fiberStrandPoints } from './fibers'

describe('living fiber presentation', () => {
  const from = { x: 0, y: 100 }
  const to = { x: 400, y: 100 }
  it('keeps the strand attached at both ends and bends only around the body', () => {
    const points = fiberStrandPoints(from, to, [{ position: { x: 200, y: 108 }, radius: 64 }])
    expect(points[0]).toEqual(from)
    expect(points.at(-1)).toEqual(to)
    expect(points[16]!.y).toBeLessThan(60)
    expect(points[3]!.y).toBe(100)
    expect(points).toHaveLength(33)
  })
  it('shows a mature body pushing the same strand farther than a juvenile', () => {
    const center = { x: 200, y: 108 }
    const small = fiberStrandPoints(from, to, [{ position: center, radius: 12 }])
    const large = fiberStrandPoints(from, to, [{ position: center, radius: 64 }])
    expect(100 - large[16]!.y).toBeGreaterThan((100 - small[16]!.y) * 2)
  })
  it('returns an undistorted strand after the body has left', () => {
    expect(fiberStrandPoints(from, to, [{ position: { x: 200, y: 400 }, radius: 40 }]).every((point) => point.y === 100)).toBe(true)
  })
  it('keeps zero-length strands and centered contact finite', () => {
    const points = fiberStrandPoints(from, from, [{ position: from, radius: 64 }])
    expect(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
  })
})
