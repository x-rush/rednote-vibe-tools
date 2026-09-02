import { describe, expect, it } from 'vitest'
import { WINDOW_PORTAL, WINDOW_SASH, crossesPortal, pointInConvexQuad, projectWindowLightCast } from './geometry'

const vector = (from: { x: number; y: number }, to: { x: number; y: number }) => ({
  x: to.x - from.x,
  y: to.y - from.y,
})

const cross = (first: { x: number; y: number }, second: { x: number; y: number }) => (
  first.x * second.y - first.y * second.x
)

const length = (value: { x: number; y: number }) => Math.hypot(value.x, value.y)

function lineIntersection(
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
) {
  const first = vector(firstStart, firstEnd)
  const second = vector(secondStart, secondEnd)
  const denominator = cross(first, second)
  if (Math.abs(denominator) < 1e-8) return undefined
  const time = cross(vector(firstStart, secondStart), second) / denominator
  return { x: firstStart.x + first.x * time, y: firstStart.y + first.y * time }
}

function expectLinePointsTo(
  start: { x: number; y: number },
  end: { x: number; y: number },
  vanishingPoint: { x: number; y: number },
) {
  const direction = vector(start, end)
  const towardVanishingPoint = vector(start, vanishingPoint)
  expect(Math.abs(cross(direction, towardVanishingPoint)) / length(direction)).toBeLessThan(0.001)
}

describe('perspective window geometry', () => {
  it('projects every window row through one coherent 3D light field', () => {
    const cast = projectWindowLightCast(1)

    expect(cast.airBeams).toHaveLength(2)
    expect(cast.floorPanes).toHaveLength(2)
    expect(cast.frameShadows).toHaveLength(3)

    expect(cast.airBeams[0].topLeft).toEqual(WINDOW_PORTAL.topLeft)
    expect(cast.airBeams[0].topRight).toEqual(WINDOW_PORTAL.topRight)
    expect(cast.airBeams[0].bottomLeft).toEqual(cast.floorPanes[1].bottomLeft)
    expect(cast.airBeams[0].bottomRight).toEqual(cast.floorPanes[1].bottomRight)
    expect(cast.airBeams[1].topLeft).toEqual(WINDOW_SASH.left)
    expect(cast.airBeams[1].topRight).toEqual(WINDOW_SASH.right)
    expect(cast.airBeams[1].bottomLeft).toEqual(cast.floorPanes[1].topLeft)
    expect(cast.airBeams[1].bottomRight).toEqual(cast.floorPanes[1].topRight)

    cast.airBeams.forEach((beam) => {
      expect(beam.bottomLeft.x).toBeLessThan(beam.topLeft.x)
      expect(beam.bottomLeft.y).toBeGreaterThan(beam.topLeft.y)
    })

    expect(cast.floorPanes[0].bottomLeft).toEqual(cast.floorPanes[1].topLeft)
    expect(cast.floorPanes[0].bottomRight).toEqual(cast.floorPanes[1].topRight)
    expect(cast.floorPanes[1].bottomLeft.y).toBeGreaterThan(cast.floorPanes[0].topLeft.y)
    expect(cast.floorPanes[1].bottomRight.y).toBeGreaterThan(cast.floorPanes[0].topRight.y)

    const horizontalVanishingPoint = lineIntersection(
      WINDOW_PORTAL.topLeft, WINDOW_PORTAL.topRight,
      WINDOW_SASH.left, WINDOW_SASH.right,
    )
    expect(horizontalVanishingPoint).toBeDefined()
    if (!horizontalVanishingPoint) return
    expectLinePointsTo(WINDOW_PORTAL.bottomLeft, WINDOW_PORTAL.bottomRight, horizontalVanishingPoint)
    cast.floorPanes.forEach((pane) => {
      expectLinePointsTo(pane.topLeft, pane.topRight, horizontalVanishingPoint)
      expectLinePointsTo(pane.bottomLeft, pane.bottomRight, horizontalVanishingPoint)
    })

    const lightVanishingPoint = lineIntersection(
      cast.airBeams[0].topLeft, cast.airBeams[0].bottomLeft,
      cast.airBeams[0].topRight, cast.airBeams[0].bottomRight,
    )
    expect(lightVanishingPoint).toBeDefined()
    if (!lightVanishingPoint) return
    expectLinePointsTo(cast.airBeams[1].topLeft, cast.airBeams[1].bottomLeft, lightVanishingPoint)
    expectLinePointsTo(cast.airBeams[1].topRight, cast.airBeams[1].bottomRight, lightVanishingPoint)

    const farWindowSide = length(vector(WINDOW_PORTAL.topLeft, WINDOW_PORTAL.bottomLeft))
    const nearWindowSide = length(vector(WINDOW_PORTAL.topRight, WINDOW_PORTAL.bottomRight))
    expect(nearWindowSide).toBeGreaterThan(farWindowSide * 1.04)

    const farFloorWidth = length(vector(cast.floorPanes[0].topLeft, cast.floorPanes[0].topRight))
    const nearFloorWidth = length(vector(cast.floorPanes[1].bottomLeft, cast.floorPanes[1].bottomRight))
    expect(nearFloorWidth).toBeGreaterThan(farFloorWidth * 1.2)
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
