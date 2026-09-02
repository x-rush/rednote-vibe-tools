import { describe, expect, it } from 'vitest'
import { WINDOW_PORTAL, crossesPortal, pointInConvexQuad, projectWindowLightCast } from './geometry'

describe('perspective window geometry', () => {
  it('projects the window as one continuous down-left light cast', () => {
    const cast = projectWindowLightCast(1)
    expect(cast.airBeams).toHaveLength(2)
    expect(cast.floorPanes).toHaveLength(2)
    expect(cast.frameShadows).toHaveLength(3)
    expect(cast.airBeams[0].topLeft).toEqual(WINDOW_PORTAL.topLeft)
    expect(cast.airBeams[0].topRight).toEqual(WINDOW_PORTAL.topRight)
    expect(cast.airBeams[0].bottomLeft).toEqual(cast.floorPanes[1].bottomLeft)
    expect(cast.airBeams[0].bottomRight).toEqual(cast.floorPanes[1].bottomRight)
    expect(cast.airBeams[1].bottomLeft).toEqual(cast.floorPanes[0].bottomLeft)
    expect(cast.airBeams[1].bottomRight).toEqual(cast.floorPanes[0].bottomRight)
    cast.airBeams.forEach((beam) => {
      expect(beam.bottomLeft.x).toBeLessThan(beam.topLeft.x)
      expect(beam.topRight.x - beam.bottomRight.x).toBeGreaterThan(60)
    })

    expect(cast.floorPanes[0].bottomLeft).toEqual(cast.floorPanes[1].topLeft)
    expect(cast.floorPanes[0].bottomRight).toEqual(cast.floorPanes[1].topRight)
    expect(cast.floorPanes[1].bottomLeft.x).toBeLessThan(cast.floorPanes[0].topLeft.x)
    expect(cast.floorPanes[1].bottomRight.x).toBeLessThan(cast.floorPanes[0].topRight.x)
    expect(cast.floorPanes[1].bottomLeft.y).toBeGreaterThan(cast.floorPanes[0].topLeft.y)
    expect(cast.floorPanes[1].bottomRight.y).toBeGreaterThan(cast.floorPanes[0].topRight.y)

    cast.floorPanes.forEach((pane) => {
      const width = {
        x: pane.topRight.x - pane.topLeft.x,
        y: pane.topRight.y - pane.topLeft.y,
      }
      const depth = {
        x: pane.bottomLeft.x - pane.topLeft.x,
        y: pane.bottomLeft.y - pane.topLeft.y,
      }
      expect(Math.abs(width.x * depth.x + width.y * depth.y)).toBeLessThan(1500)
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
