export interface Point { readonly x: number; readonly y: number }
export interface Quad { readonly topLeft: Point; readonly topRight: Point; readonly bottomRight: Point; readonly bottomLeft: Point }

export const DESIGN_SIZE = { width: 390, height: 844 } as const

interface Point3 { readonly x: number; readonly y: number; readonly z: number }

const CAMERA_POSITION: Point3 = { x: 5, y: 3, z: 7 }
const CAMERA_TARGET: Point3 = { x: 0, y: 2, z: 0 }
const CAMERA_LENS = 850
const CAMERA_CENTER = { x: 282, y: 340 } as const
const CAMERA_SHEAR = 0.22
const WORLD_UP: Point3 = { x: 0, y: 1, z: 0 }
const WINDOW_WORLD = { left: -0.8, right: 0.8, bottom: 0.7, sash: 2.35, top: 4 } as const
const FRAME_WORLD = { left: -0.95, right: 0.95, bottom: 0.55, top: 4.15 } as const
const MOONLIGHT = { xPerHeight: 0.3, zPerHeight: 0.85 } as const

const subtract3 = (first: Point3, second: Point3): Point3 => ({
  x: first.x - second.x,
  y: first.y - second.y,
  z: first.z - second.z,
})
const dot3 = (first: Point3, second: Point3) => first.x * second.x + first.y * second.y + first.z * second.z
const cross3 = (first: Point3, second: Point3): Point3 => ({
  x: first.y * second.z - first.z * second.y,
  y: first.z * second.x - first.x * second.z,
  z: first.x * second.y - first.y * second.x,
})
const normalize3 = (value: Point3): Point3 => {
  const magnitude = Math.hypot(value.x, value.y, value.z)
  return { x: value.x / magnitude, y: value.y / magnitude, z: value.z / magnitude }
}

const cameraForward = normalize3(subtract3(CAMERA_TARGET, CAMERA_POSITION))
const cameraRight = normalize3(cross3(cameraForward, WORLD_UP))
const cameraUp = cross3(cameraRight, cameraForward)

function projectScenePoint(point: Point3): Point {
  const relative = subtract3(point, CAMERA_POSITION)
  const depth = dot3(relative, cameraForward)
  const x = CAMERA_CENTER.x + CAMERA_LENS * dot3(relative, cameraRight) / depth
  const y = CAMERA_CENTER.y - CAMERA_LENS * dot3(relative, cameraUp) / depth
  return { x, y: y + CAMERA_SHEAR * (x - CAMERA_CENTER.x) }
}

function projectWindowRow(y: number, left: number = WINDOW_WORLD.left, right: number = WINDOW_WORLD.right) {
  return {
    left: projectScenePoint({ x: left, y, z: 0 }),
    right: projectScenePoint({ x: right, y, z: 0 }),
  }
}

function projectWindowRowToFloor(y: number, left: number = WINDOW_WORLD.left, right: number = WINDOW_WORLD.right) {
  const groundPoint = (x: number) => projectScenePoint({
    x: x + MOONLIGHT.xPerHeight * y,
    y: 0,
    z: MOONLIGHT.zPerHeight * y,
  })
  return { left: groundPoint(left), right: groundPoint(right) }
}

function quadFromRows(top: ReturnType<typeof projectWindowRow>, bottom: ReturnType<typeof projectWindowRow>): Quad {
  return { topLeft: top.left, topRight: top.right, bottomRight: bottom.right, bottomLeft: bottom.left }
}

const windowTop = projectWindowRow(WINDOW_WORLD.top)
const windowBottom = projectWindowRow(WINDOW_WORLD.bottom)
const frameTop = projectWindowRow(FRAME_WORLD.top, FRAME_WORLD.left, FRAME_WORLD.right)
const frameBottom = projectWindowRow(FRAME_WORLD.bottom, FRAME_WORLD.left, FRAME_WORLD.right)

export const WINDOW_PORTAL: Quad = quadFromRows(windowTop, windowBottom)
export const WINDOW_FRAME: Quad = quadFromRows(frameTop, frameBottom)
export const WINDOW_SASH = projectWindowRow(WINDOW_WORLD.sash)
export const WINDOW_SASH_FRAME = projectWindowRow(WINDOW_WORLD.sash, FRAME_WORLD.left, FRAME_WORLD.right)

const wallFloorFirst = projectScenePoint({ x: -5, y: 0, z: 0 })
const wallFloorSecond = projectScenePoint({ x: 5, y: 0, z: 0 })
const floorYAt = (x: number) => wallFloorFirst.y
  + (wallFloorSecond.y - wallFloorFirst.y) * (x - wallFloorFirst.x) / (wallFloorSecond.x - wallFloorFirst.x)
export const ROOM_FLOOR_EDGE = {
  left: { x: 0, y: floorYAt(0) },
  right: { x: DESIGN_SIZE.width, y: floorYAt(DESIGN_SIZE.width) },
} as const

export interface WindowLightCast {
  readonly airBeams: readonly [Quad, Quad]
  readonly floorPanes: readonly [Quad, Quad]
  readonly frameShadows: readonly [Quad, Quad, Quad]
  readonly sashShadow: Quad
}

export function projectWindowLightCast(_revealProgress: number): WindowLightCast {
  const bottomRow = projectWindowRowToFloor(WINDOW_WORLD.bottom)
  const sashRow = projectWindowRowToFloor(WINDOW_WORLD.sash)
  const topRow = projectWindowRowToFloor(WINDOW_WORLD.top)
  const outerBottomRow = projectWindowRowToFloor(WINDOW_WORLD.bottom, FRAME_WORLD.left, FRAME_WORLD.right)
  const outerTopRow = projectWindowRowToFloor(FRAME_WORLD.top, FRAME_WORLD.left, FRAME_WORLD.right)
  const sashNearRow = projectWindowRowToFloor(WINDOW_WORLD.sash - 0.07, FRAME_WORLD.left, FRAME_WORLD.right)
  const sashFarRow = projectWindowRowToFloor(WINDOW_WORLD.sash + 0.07, FRAME_WORLD.left, FRAME_WORLD.right)
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
        topLeft: outerBottomRow.left,
        topRight: bottomRow.left,
        bottomRight: topRow.left,
        bottomLeft: outerTopRow.left,
      },
      {
        topLeft: bottomRow.right,
        topRight: outerBottomRow.right,
        bottomRight: outerTopRow.right,
        bottomLeft: topRow.right,
      },
      {
        topLeft: outerTopRow.left,
        topRight: outerTopRow.right,
        bottomRight: topRow.right,
        bottomLeft: topRow.left,
      },
    ],
    sashShadow: {
      topLeft: sashNearRow.left,
      topRight: sashNearRow.right,
      bottomRight: sashFarRow.right,
      bottomLeft: sashFarRow.left,
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
