import { describe, expect, it } from 'vitest'
import { WINDOW_PORTAL, crossesPortal, pointInConvexQuad, projectWindowLightCast } from './geometry'

describe('perspective window geometry', () => {
  it('connects two volumetric light beams to separated perspective window panes', () => {
    const cast = projectWindowLightCast(1)
    expect(cast.airBeams).toHaveLength(2)
    expect(cast.floorPanes).toHaveLength(2)
    expect(cast.frameShadows).toHaveLength(3)
    expect(cast.airBeams[0].topLeft).toEqual(WINDOW_PORTAL.topLeft)
    expect(cast.airBeams[0].topRight).toEqual(WINDOW_PORTAL.topRight)
    expect(cast.airBeams[0].bottomLeft).toEqual(cast.floorPanes[0].topLeft)
    expect(cast.airBeams[0].bottomRight).toEqual(cast.floorPanes[0].topRight)
    expect(cast.airBeams[1].bottomLeft).toEqual(cast.floorPanes[1].topLeft)
    expect(cast.airBeams[1].bottomRight).toEqual(cast.floorPanes[1].topRight)
    expect(cast.floorPanes[1].topLeft.y).toBeGreaterThan(cast.floorPanes[0].bottomLeft.y)
    expect(cast.floorPanes[1].topRight.y).toBeGreaterThan(cast.floorPanes[0].bottomRight.y)
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
