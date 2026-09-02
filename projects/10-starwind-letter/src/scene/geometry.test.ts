import { describe, expect, it } from 'vitest'
import { WINDOW_PORTAL, WINDOW_SASH, crossesPortal, pointInConvexQuad, projectWindowLightCast } from './geometry'

const vector = (from: { x: number; y: number }, to: { x: number; y: number }) => ({
  x: to.x - from.x,
  y: to.y - from.y,
})

const cross = (first: { x: number; y: number }, second: { x: number; y: number }) => (
  first.x * second.y - first.y * second.x
)

describe('perspective window geometry', () => {
  it('projects every window row through one coherent 3D light field', () => {
    const cast = projectWindowLightCast(1)
    const windowTop = vector(WINDOW_PORTAL.topLeft, WINDOW_PORTAL.topRight)
    const windowBottom = vector(WINDOW_PORTAL.bottomLeft, WINDOW_PORTAL.bottomRight)
    const windowSash = vector(WINDOW_SASH.left, WINDOW_SASH.right)

    expect(cast.airBeams).toHaveLength(2)
    expect(cast.floorPanes).toHaveLength(2)
    expect(cast.frameShadows).toHaveLength(3)

    expect(windowBottom).toEqual(windowTop)
    expect(windowSash).toEqual(windowTop)
    expect(cast.airBeams[0].topLeft).toEqual(WINDOW_PORTAL.topLeft)
    expect(cast.airBeams[0].topRight).toEqual(WINDOW_PORTAL.topRight)
    expect(cast.airBeams[0].bottomLeft).toEqual(cast.floorPanes[1].bottomLeft)
    expect(cast.airBeams[0].bottomRight).toEqual(cast.floorPanes[1].bottomRight)
    expect(cast.airBeams[1].topLeft).toEqual(WINDOW_SASH.left)
    expect(cast.airBeams[1].topRight).toEqual(WINDOW_SASH.right)
    expect(cast.airBeams[1].bottomLeft).toEqual(cast.floorPanes[1].topLeft)
    expect(cast.airBeams[1].bottomRight).toEqual(cast.floorPanes[1].topRight)

    const topLeftRay = vector(cast.airBeams[0].topLeft, cast.airBeams[0].bottomLeft)
    const topRightRay = vector(cast.airBeams[0].topRight, cast.airBeams[0].bottomRight)
    const sashLeftRay = vector(cast.airBeams[1].topLeft, cast.airBeams[1].bottomLeft)
    const sashRightRay = vector(cast.airBeams[1].topRight, cast.airBeams[1].bottomRight)
    expect(topRightRay.x).toBeCloseTo(topLeftRay.x, 8)
    expect(topRightRay.y).toBeCloseTo(topLeftRay.y, 8)
    expect(sashRightRay.x).toBeCloseTo(sashLeftRay.x, 8)
    expect(sashRightRay.y).toBeCloseTo(sashLeftRay.y, 8)
    cast.airBeams.forEach((beam) => {
      expect(beam.bottomLeft.x).toBeLessThan(beam.topLeft.x)
      expect(beam.bottomLeft.y).toBeGreaterThan(beam.topLeft.y)
    })

    expect(cast.floorPanes[0].bottomLeft).toEqual(cast.floorPanes[1].topLeft)
    expect(cast.floorPanes[0].bottomRight).toEqual(cast.floorPanes[1].topRight)
    expect(cast.floorPanes[1].bottomLeft.y).toBeGreaterThan(cast.floorPanes[0].topLeft.y)
    expect(cast.floorPanes[1].bottomRight.y).toBeGreaterThan(cast.floorPanes[0].topRight.y)

    cast.floorPanes.forEach((pane) => {
      expect(cross(windowSash, vector(pane.topLeft, pane.topRight))).toBeCloseTo(0, 8)
      expect(cross(windowSash, vector(pane.bottomLeft, pane.bottomRight))).toBeCloseTo(0, 8)
    })
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
