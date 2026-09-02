export interface Point { readonly x: number; readonly y: number }
export interface Quad { readonly topLeft: Point; readonly topRight: Point; readonly bottomRight: Point; readonly bottomLeft: Point }

export const DESIGN_SIZE = { width: 390, height: 844 } as const
export const WINDOW_PORTAL: Quad = {
  topLeft: { x: 214, y: 152 }, topRight: { x: 348, y: 178 },
  bottomRight: { x: 348, y: 486 }, bottomLeft: { x: 214, y: 438 },
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (value: number) => value * value * (3 - 2 * value)

export interface WindowLightCast {
  readonly airBeams: readonly [Quad, Quad]
  readonly floorPanes: readonly [Quad, Quad]
  readonly frameShadows: readonly [Quad, Quad, Quad]
  readonly sashShadow: Quad
}

export function projectWindowLightCast(revealProgress: number): WindowLightCast {
  const amount = smoothstep(clamp(revealProgress))
  const reach = 0.88 + amount * 0.12
  const nearPane: Quad = {
    topLeft: { x: 150, y: 585 },
    topRight: { x: 341, y: 516 },
    bottomRight: { x: 370, y: 612 },
    bottomLeft: { x: 125, y: 704 },
  }
  const farPane: Quad = {
    topLeft: { x: 117, y: 718 },
    topRight: { x: 368, y: 625 },
    bottomRight: { x: 308, y: 782 + amount * 12 },
    bottomLeft: { x: 18, y: 748 + 76 * reach },
  }
  return {
    airBeams: [
      {
        topLeft: WINDOW_PORTAL.topLeft,
        topRight: WINDOW_PORTAL.topRight,
        bottomRight: nearPane.topRight,
        bottomLeft: nearPane.topLeft,
      },
      {
        topLeft: { x: 208, y: 286 },
        topRight: { x: 354, y: 322 },
        bottomRight: farPane.topRight,
        bottomLeft: farPane.topLeft,
      },
    ],
    floorPanes: [nearPane, farPane],
    frameShadows: [
      {
        topLeft: { x: 125, y: 704 }, topRight: { x: 134, y: 701 },
        bottomRight: { x: 30, y: 827 }, bottomLeft: { x: 17, y: 824 },
      },
      {
        topLeft: { x: 362, y: 609 }, topRight: { x: 372, y: 612 },
        bottomRight: { x: 316, y: 799 }, bottomLeft: { x: 306, y: 794 },
      },
      {
        topLeft: { x: 18, y: 824 }, topRight: { x: 308, y: 794 },
        bottomRight: { x: 314, y: 803 }, bottomLeft: { x: 12, y: 834 },
      },
    ],
    sashShadow: {
      topLeft: nearPane.bottomLeft,
      topRight: nearPane.bottomRight,
      bottomRight: farPane.topRight,
      bottomLeft: farPane.topLeft,
    },
  }
}

function cross(origin: Point, first: Point, second: Point) {
  return (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)
}

export function pointInConvexQuad(point: Point, quad: Quad) {
  const points = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft]
  const signs = points.map((origin, index) => cross(origin, points[(index + 1) % points.length] as Point, point))
  return signs.every((value) => value >= 0) || signs.every((value) => value <= 0)
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const abC = cross(a, b, c); const abD = cross(a, b, d)
  const cdA = cross(c, d, a); const cdB = cross(c, d, b)
  return abC * abD <= 0 && cdA * cdB <= 0
}

export function crossesPortal(previous: Point, next: Point, portal: Quad) {
  if (next.x >= previous.x || next.y <= previous.y) return false
  if (pointInConvexQuad(previous, portal) || pointInConvexQuad(next, portal)) return true
  const points = [portal.topLeft, portal.topRight, portal.bottomRight, portal.bottomLeft]
  return points.some((point, index) => segmentsIntersect(previous, next, point, points[(index + 1) % points.length] as Point))
}

export function quadPoints(quad: Quad) {
  return [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft].map(({ x, y }) => `${x},${y}`).join(' ')
}
