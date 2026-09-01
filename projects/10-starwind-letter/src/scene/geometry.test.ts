import { describe, expect, it } from 'vitest'
import { WINDOW_PORTAL, crossesPortal, pointInConvexQuad, splitMoonlightPolygons } from './geometry'

describe('perspective window geometry', () => {
  it('projects two rail-separated moonlight shapes into the room', () => {
    const [nearBeam, farBeam] = splitMoonlightPolygons(1)
    expect(nearBeam.topLeft.y).toBeGreaterThan(WINDOW_PORTAL.bottomLeft.y)
    expect(farBeam.bottomLeft.y).toBeLessThan(nearBeam.topLeft.y)
    expect(nearBeam.bottomLeft.x).toBeLessThan(WINDOW_PORTAL.bottomLeft.x)
    expect(nearBeam.topLeft.y - farBeam.bottomLeft.y).toBeGreaterThan(8)
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
