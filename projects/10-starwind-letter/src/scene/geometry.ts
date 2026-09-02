export interface Point { readonly x: number; readonly y: number }
export interface Quad { readonly topLeft: Point; readonly topRight: Point; readonly bottomRight: Point; readonly bottomLeft: Point }

export const DESIGN_SIZE = { width: 390, height: 844 } as const
export const WINDOW_PORTAL: Quad = {
  topLeft: { x: 214, y: 152 }, topRight: { x: 348, y: 188 },
  bottomRight: { x: 348, y: 474 }, bottomLeft: { x: 214, y: 438 },
}
export const WINDOW_SASH = {
  left: { x: 214, y: 286 },
  right: { x: 348, y: 322 },
} as const

const WINDOW_AXIS = { x: 134, y: 36 } as const
const WALL_FLOOR_ORIGIN = { x: 214, y: 488 } as const
const GROUND_LIGHT_PER_HEIGHT = { x: -0.63, y: 0.84 } as const

function add(point: Point, offset: Point): Point {
  return { x: point.x + offset.x, y: point.y + offset.y }
}

function projectWindowRowToFloor(leftY: number) {
  const height = WALL_FLOOR_ORIGIN.y - leftY
  const left = {
    x: WALL_FLOOR_ORIGIN.x + GROUND_LIGHT_PER_HEIGHT.x * height,
    y: WALL_FLOOR_ORIGIN.y + GROUND_LIGHT_PER_HEIGHT.y * height,
  }
  return { left, right: add(left, WINDOW_AXIS) }
}

export interface WindowLightCast {
  readonly airBeams: readonly [Quad, Quad]
  readonly floorPanes: readonly [Quad, Quad]
  readonly frameShadows: readonly [Quad, Quad, Quad]
  readonly sashShadow: Quad
}

export function projectWindowLightCast(_revealProgress: number): WindowLightCast {
  const bottomRow = projectWindowRowToFloor(WINDOW_PORTAL.bottomLeft.y)
  const sashRow = projectWindowRowToFloor(WINDOW_SASH.left.y)
  const topRow = projectWindowRowToFloor(WINDOW_PORTAL.topLeft.y)
  const nearPane: Quad = {
    topLeft: bottomRow.left,
    topRight: bottomRow.right,
    bottomRight: sashRow.right,
    bottomLeft: sashRow.left,
  }
  const farPane: Quad = {
    topLeft: sashRow.left,
    topRight: sashRow.right,
    bottomRight: topRow.right,
    bottomLeft: topRow.left,
  }
  const frameWidth = { x: WINDOW_AXIS.x * 0.055, y: WINDOW_AXIS.y * 0.055 }
  const sashDepth = { x: GROUND_LIGHT_PER_HEIGHT.x * 6, y: GROUND_LIGHT_PER_HEIGHT.y * 6 }
  return {
    airBeams: [
      {
        topLeft: WINDOW_PORTAL.topLeft,
        topRight: WINDOW_PORTAL.topRight,
        bottomRight: topRow.right,
        bottomLeft: topRow.left,
      },
      {
        topLeft: WINDOW_SASH.left,
        topRight: WINDOW_SASH.right,
        bottomRight: sashRow.right,
        bottomLeft: sashRow.left,
      },
    ],
    floorPanes: [nearPane, farPane],
    frameShadows: [
      {
        topLeft: bottomRow.left,
        topRight: add(bottomRow.left, frameWidth),
        bottomRight: add(topRow.left, frameWidth),
        bottomLeft: topRow.left,
      },
      {
        topLeft: add(bottomRow.right, { x: -frameWidth.x, y: -frameWidth.y }),
        topRight: bottomRow.right,
        bottomRight: topRow.right,
        bottomLeft: add(topRow.right, { x: -frameWidth.x, y: -frameWidth.y }),
      },
      {
        topLeft: topRow.left,
        topRight: topRow.right,
        bottomRight: add(topRow.right, sashDepth),
        bottomLeft: add(topRow.left, sashDepth),
      },
    ],
    sashShadow: {
      topLeft: add(sashRow.left, { x: -sashDepth.x, y: -sashDepth.y }),
      topRight: add(sashRow.right, { x: -sashDepth.x, y: -sashDepth.y }),
      bottomRight: add(sashRow.right, sashDepth),
      bottomLeft: add(sashRow.left, sashDepth),
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
