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
    topLeft: { x: 25, y: 640 },
    topRight: { x: 270, y: 565 },
    bottomRight: { x: 292, y: 637 },
    bottomLeft: { x: 47, y: 712 },
  }
  const farPane: Quad = {
    topLeft: nearPane.bottomLeft,
    topRight: nearPane.bottomRight,
    bottomRight: { x: 314, y: 697 + amount * 12 },
    bottomLeft: { x: 69, y: 772 + amount * 12 },
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
        topLeft: { x: 25, y: 640 }, topRight: { x: 33, y: 641 },
        bottomRight: { x: 77, y: 786 }, bottomLeft: { x: 69, y: 784 },
      },
      {
        topLeft: { x: 262, y: 568 }, topRight: { x: 270, y: 565 },
        bottomRight: { x: 314, y: 709 }, bottomLeft: { x: 306, y: 708 },
      },
      {
        topLeft: { x: 69, y: 778 }, topRight: { x: 314, y: 703 },
        bottomRight: { x: 316, y: 713 }, bottomLeft: { x: 69, y: 790 },
      },
    ],
    sashShadow: {
      topLeft: { x: 45, y: 705 },
      topRight: { x: 290, y: 630 },
      bottomRight: { x: 294, y: 644 },
      bottomLeft: { x: 49, y: 719 },
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
