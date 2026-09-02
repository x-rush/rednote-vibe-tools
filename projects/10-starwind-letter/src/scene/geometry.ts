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
  const nearPane: Quad = {
    topLeft: { x: 150, y: 585 },
    topRight: { x: 325, y: 520 },
    bottomRight: { x: 285, y: 625 },
    bottomLeft: { x: 82, y: 702 },
  }
  const farPane: Quad = {
    topLeft: nearPane.bottomLeft,
    topRight: nearPane.bottomRight,
    bottomRight: { x: 240, y: 735 + amount * 12 },
    bottomLeft: { x: 15, y: 811 + amount * 24 },
  }
  return {
    airBeams: [
      {
        topLeft: WINDOW_PORTAL.topLeft,
        topRight: WINDOW_PORTAL.topRight,
        bottomRight: farPane.bottomRight,
        bottomLeft: farPane.bottomLeft,
      },
      {
        topLeft: { x: 208, y: 286 },
        topRight: { x: 354, y: 322 },
        bottomRight: nearPane.bottomRight,
        bottomLeft: nearPane.bottomLeft,
      },
    ],
    floorPanes: [nearPane, farPane],
    frameShadows: [
      {
        topLeft: { x: 150, y: 585 }, topRight: { x: 158, y: 589 },
        bottomRight: { x: 25, y: 836 }, bottomLeft: { x: 15, y: 835 },
      },
      {
        topLeft: { x: 317, y: 523 }, topRight: { x: 325, y: 520 },
        bottomRight: { x: 240, y: 747 }, bottomLeft: { x: 231, y: 744 },
      },
      {
        topLeft: { x: 15, y: 829 }, topRight: { x: 240, y: 741 },
        bottomRight: { x: 242, y: 749 }, bottomLeft: { x: 15, y: 839 },
      },
    ],
    sashShadow: {
      topLeft: { x: 80, y: 696 },
      topRight: { x: 286, y: 619 },
      bottomRight: { x: 284, y: 631 },
      bottomLeft: { x: 84, y: 708 },
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
