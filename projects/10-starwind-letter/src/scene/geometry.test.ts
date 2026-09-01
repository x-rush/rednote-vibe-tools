import { describe, expect, it } from 'vitest'
import { WINDOW_PORTAL, crossesPortal, pointInConvexQuad, projectSash } from './geometry'

describe('perspective window geometry', () => {
  it('keeps the right hinge edge fixed while the sash opens toward the viewer', () => {
    const closed = projectSash(0)
    const open = projectSash(1)
    expect(open.topRight).toEqual(closed.topRight)
    expect(open.bottomRight).toEqual(closed.bottomRight)
    expect(open.topLeft.x).toBeLessThan(closed.topLeft.x)
    expect(open.bottomLeft.y).toBeGreaterThan(closed.bottomLeft.y)
  })

  it('recognizes points in the slanted portal', () => {
    expect(pointInConvexQuad({ x: 280, y: 300 }, WINDOW_PORTAL)).toBe(true)
    expect(pointInConvexQuad({ x: 120, y: 300 }, WINDOW_PORTAL)).toBe(false)
  })

  it('detects a continuous outside-to-inside portal crossing', () => {
    expect(crossesPortal({ x: 308, y: 215 }, { x: 235, y: 390 }, WINDOW_PORTAL)).toBe(true)
    expect(crossesPortal({ x: 90, y: 220 }, { x: 120, y: 410 }, WINDOW_PORTAL)).toBe(false)
  })
})
