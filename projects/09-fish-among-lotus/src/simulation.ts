import { SpatialGrid } from './spatial-grid.ts'

export type Point = { x: number; y: number }
export type Bounds = { width: number; height: number }
export type PointerState = Point & { active: boolean; strength: number; trail: Point[] }
export type Fish = Point & {
  vx: number
  vy: number
  size: number
  phase: number
  tone: number
  wander?: number
  turnBias?: number
  responsiveness?: number
  avoidSide?: -1 | 1
  avoidLock?: number
  heading?: number
  follow?: number
}
export type Leaf = Point & {
  radius: number
  collisionRadius?: number
  aspect?: number
  notch: number
  rotation: number
  flower: boolean
  tone?: number
  light?: number
  vein?: number
  drift?: number
}

type IndexedFish = Fish & { index: number }
type StepOptions = { leafGrid?: SpatialGrid<Leaf>; maxLeafCollisionRadius?: number }
type Avoidance = Point & { side: -1 | 1; threat: number }

const TAU = Math.PI * 2
const EPSILON = 0.0001

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function getLeafCollisionRadius(leaf: Leaf) {
  return leaf.collisionRadius ?? leaf.radius * 0.64
}

function normalSample(random: () => number) {
  return (random() + random() + random() + random() - 2) * 0.5
}

export function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

export function createFish(count: number, bounds: Bounds, random = Math.random): Fish[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = random() * TAU
    const speed = 24 + random() * 18
    return {
      x: bounds.width * (0.08 + random() * 0.84),
      y: bounds.height * (0.15 + random() * 0.7),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2.7 + random() * 2,
      phase: random() * TAU,
      tone: index % 7,
      wander: angle,
      turnBias: random() * 2 - 1,
      responsiveness: 0.72 + random() * 0.55,
      avoidSide: random() < 0.5 ? -1 : 1,
      avoidLock: 0,
      heading: angle,
      follow: 0,
    }
  })
}

export function createLeaves(count: number, bounds: Bounds, random = Math.random): Leaf[] {
  const leaves: Leaf[] = []
  const minSize = Math.min(bounds.width, bounds.height)

  for (let index = 0; index < count; index += 1) {
    const distribution = random()
    let x: number
    let y: number

    if (distribution < 0.78) {
      x = bounds.width * 0.53 + normalSample(random) * bounds.width * 0.7
      y = bounds.height * 0.44 + normalSample(random) * bounds.height * 0.5
    } else if (distribution < 0.94) {
      const rightCluster = random() > 0.48
      x = bounds.width * (rightCluster ? 0.72 : 0.3) + normalSample(random) * bounds.width * 0.28
      y = bounds.height * (rightCluster ? 0.61 : 0.35) + normalSample(random) * bounds.height * 0.22
    } else {
      x = bounds.width * (-0.02 + random() * 1.04)
      y = bounds.height * (0.12 + random() * 0.76)
    }

    const tier = random()
    const radius = tier < 0.46
      ? minSize * (0.018 + random() * 0.012)
      : tier < 0.85
        ? minSize * (0.031 + random() * 0.017)
        : minSize * (0.052 + random() * 0.026)
    const aspect = 0.7 + random() * 0.25
    const safeX = clamp(x, -radius * 0.15, bounds.width + radius * 0.15)
    const safeY = clamp(y, bounds.height * 0.11, bounds.height * 0.86)

    leaves.push({
      x: safeX,
      y: safeY,
      radius,
      collisionRadius: radius * (0.5 + random() * 0.13),
      aspect,
      notch: 0.2 + random() * 0.42,
      rotation: random() * TAU,
      flower: radius > minSize * 0.045 && random() < 0.12,
      tone: Math.floor(random() * 5),
      light: random() * 2 - 1,
      vein: random() * 2 - 1,
      drift: 0.65 + random() * 0.85,
    })
  }

  return leaves
}

export function resolveLeafCollision(fish: Fish, leaf: Leaf, padding = 2): Fish {
  const dx = fish.x - leaf.x
  const dy = fish.y - leaf.y
  const distance = Math.hypot(dx, dy)
  const limit = getLeafCollisionRadius(leaf) + fish.size * 0.7 + padding
  if (distance >= limit) return fish

  const fallbackAngle = fish.heading ?? Math.atan2(fish.vy, fish.vx) + Math.PI
  const nx = distance > EPSILON ? dx / distance : Math.cos(fallbackAngle)
  const ny = distance > EPSILON ? dy / distance : Math.sin(fallbackAngle)
  const inwardSpeed = fish.vx * nx + fish.vy * ny
  const correction = limit - distance + 0.02
  const side = fish.avoidSide ?? 1
  const tangentNudge = Math.min(6, Math.hypot(fish.vx, fish.vy) * 0.08)

  return {
    ...fish,
    x: fish.x + nx * correction,
    y: fish.y + ny * correction,
    vx: fish.vx - Math.min(inwardSpeed, 0) * nx + -ny * side * tangentNudge,
    vy: fish.vy - Math.min(inwardSpeed, 0) * ny + nx * side * tangentNudge,
  }
}

export function findSafeTarget(target: Point, from: Point, leaves: readonly Leaf[]): Point {
  let x = target.x
  let y = target.y

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false
    for (const leaf of leaves) {
      const radius = getLeafCollisionRadius(leaf) + 7
      const dx = x - leaf.x
      const dy = y - leaf.y
      const distance = Math.hypot(dx, dy)
      if (distance >= radius) continue
      const fallbackX = from.x - leaf.x
      const fallbackY = from.y - leaf.y
      const fallbackLength = Math.hypot(fallbackX, fallbackY)
      const nx = distance > EPSILON ? dx / distance : fallbackLength > EPSILON ? fallbackX / fallbackLength : 1
      const ny = distance > EPSILON ? dy / distance : fallbackLength > EPSILON ? fallbackY / fallbackLength : 0
      x = leaf.x + nx * radius
      y = leaf.y + ny * radius
      changed = true
    }
    if (!changed) break
  }

  return { x, y }
}

function pointerStrength(pointer: Point | PointerState | null) {
  if (!pointer) return 0
  return 'strength' in pointer ? clamp(pointer.strength, 0, 1) : 1
}

function pointerTrail(pointer: Point | PointerState) {
  return 'trail' in pointer && pointer.trail.length > 0 ? pointer.trail : [pointer]
}

export function computeLeafAvoidance(fish: Fish, leaves: readonly Leaf[], preferredSide: -1 | 1, sideLocked = false): Avoidance {
  const speed = Math.max(18, Math.hypot(fish.vx, fish.vy))
  const directionX = fish.vx / speed
  const directionY = fish.vy / speed
  const lookAhead = clamp(speed * 1.12, 52, 94)
  let ax = 0
  let ay = 0
  let strongest = 0
  let selectedSide = preferredSide

  for (const leaf of leaves) {
    const dx = leaf.x - fish.x
    const dy = leaf.y - fish.y
    const forward = dx * directionX + dy * directionY
    if (forward < -4 || forward > lookAhead) continue
    const cross = directionX * dy - directionY * dx
    const clearance = getLeafCollisionRadius(leaf) + fish.size + 8
    const lateral = Math.abs(cross)
    if (lateral >= clearance) continue

    const threat = (1 - clamp(forward / (lookAhead + clearance), 0, 1)) * (1 - lateral / clearance)
    if (threat <= 0) continue
    const awaySide: -1 | 1 = sideLocked ? preferredSide : Math.abs(cross) > 1.5 ? (cross > 0 ? -1 : 1) : preferredSide
    if (threat > strongest) {
      strongest = threat
      selectedSide = awaySide
    }
    const tangentX = -directionY * awaySide
    const tangentY = directionX * awaySide
    const force = 54 + threat * 125
    ax += tangentX * force * threat
    ay += tangentY * force * threat
    const brake = Math.max(0, 1 - forward / Math.max(clearance, 1)) * 26
    ax -= directionX * brake
    ay -= directionY * brake
  }

  const magnitude = Math.hypot(ax, ay)
  if (magnitude > 175) {
    ax = (ax / magnitude) * 175
    ay = (ay / magnitude) * 175
  }
  return { x: ax, y: ay, side: selectedSide, threat: strongest }
}

function advanceFish(
  item: Fish,
  index: number,
  fishGrid: SpatialGrid<IndexedFish>,
  leafGrid: SpatialGrid<Leaf>,
  bounds: Bounds,
  pointer: Point | PointerState | null,
  dt: number,
  speedScale: number,
  maxLeafCollisionRadius: number,
): Fish {
  const currentSpeed = Math.hypot(item.vx, item.vy)
  const velocityAngle = currentSpeed > EPSILON ? Math.atan2(item.vy, item.vx) : item.heading ?? item.wander ?? 0
  const currentHeading = item.heading ?? velocityAngle
  const turnBias = item.turnBias ?? Math.sin(index * 5.17) * 0.7
  const nextWander = (item.wander ?? velocityAngle) + (Math.sin(item.phase * 0.19 + index * 1.73) * 0.3 + turnBias * 0.075) * dt
  const cruiseSpeed = (28 + (index % 5) * 2.8) * speedScale
  let ax = (Math.cos(nextWander) * cruiseSpeed - item.vx) * 0.72
  let ay = (Math.sin(nextWander) * cruiseSpeed - item.vy) * 0.72

  const nearbyFish = fishGrid.query(item.x, item.y, 28)
  for (const other of nearbyFish) {
    if (other.index === index) continue
    let dx = item.x - other.x
    let dy = item.y - other.y
    let distance = Math.hypot(dx, dy)
    if (distance < EPSILON) {
      const sign = index < other.index ? -1 : 1
      dx = sign
      dy = sign * 0.63
      distance = Math.hypot(dx, dy)
    }
    if (distance >= 25) continue
    const force = (25 - distance) * 3.1
    ax += (dx / distance) * force
    ay += (dy / distance) * force
  }

  const influence = pointerStrength(pointer)
  if (pointer && influence > 0.001) {
    const trail = pointerTrail(pointer)
    const lag = Math.min(trail.length - 1, (index * 3) % Math.max(1, trail.length))
    const point = trail[trail.length - 1 - lag]
    const orbitAngle = item.phase * 0.22 + index * 2.399
    const orbitRadius = 10 + (index % 5) * 4.5
    const roughTarget = {
      x: point.x + Math.cos(orbitAngle) * orbitRadius,
      y: point.y + Math.sin(orbitAngle) * orbitRadius,
    }
    const localLeaves = leafGrid.query(roughTarget.x, roughTarget.y, maxLeafCollisionRadius + 8)
    const target = findSafeTarget(roughTarget, item, localLeaves)
    const dx = target.x - item.x
    const dy = target.y - item.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const response = item.responsiveness ?? (0.78 + (index % 7) * 0.07)
    const distanceGain = clamp((distance - 18) / 135, 0.18, 1)
    const pull = (24 + Math.min(68, distance * 0.34)) * influence * response * distanceGain
    ax += (dx / distance) * pull
    ay += (dy / distance) * pull
    if (distance < 58) {
      const orbit = (1 - distance / 58) * 62 * influence
      ax += (-dy / distance) * orbit * (index % 2 ? -1 : 1)
      ay += (dx / distance) * orbit * (index % 2 ? -1 : 1)
    }
  }

  const edgeMargin = clamp(Math.min(bounds.width, bounds.height) * 0.15, 54, 76)
  if (item.x < edgeMargin) ax += (edgeMargin - item.x) * 5.2
  if (item.x > bounds.width - edgeMargin) ax -= (item.x - bounds.width + edgeMargin) * 5.2
  if (item.y < edgeMargin) ay += (edgeMargin - item.y) * 5.2
  if (item.y > bounds.height - edgeMargin) ay -= (item.y - bounds.height + edgeMargin) * 5.2

  const obstacleRange = Math.max(clamp(currentSpeed * 1.2 + 48, 76, 138), maxLeafCollisionRadius + item.size + 8)
  const nearbyLeaves = leafGrid.query(item.x, item.y, obstacleRange)
  const sideLocked = (item.avoidLock ?? 0) > 0
  const lockedSide = sideLocked ? item.avoidSide ?? 1 : item.avoidSide ?? (index % 2 ? -1 : 1)
  const avoidance = computeLeafAvoidance(item, nearbyLeaves, lockedSide, sideLocked)
  ax += avoidance.x
  ay += avoidance.y

  const acceleration = Math.hypot(ax, ay)
  if (acceleration > 210) {
    ax = (ax / acceleration) * 210
    ay = (ay / acceleration) * 210
  }

  let vx = item.vx + ax * dt
  let vy = item.vy + ay * dt
  const maxSpeed = (influence > 0.05 ? 82 : 48) * speedScale
  const speed = Math.hypot(vx, vy)
  if (speed > maxSpeed) {
    vx = (vx / speed) * maxSpeed
    vy = (vy / speed) * maxSpeed
  }
  const targetHeading = Math.atan2(vy, vx)
  const headingDelta = Math.atan2(Math.sin(targetHeading - currentHeading), Math.cos(targetHeading - currentHeading))
  const maxHeadingTurn = dt * (influence > 0.05 ? 4.6 : 3.2)

  let next: Fish = {
    ...item,
    x: clamp(item.x + vx * dt, 2, bounds.width - 2),
    y: clamp(item.y + vy * dt, 2, bounds.height - 2),
    vx,
    vy,
    phase: item.phase + dt * (2.3 + Math.hypot(vx, vy) * 0.065),
    wander: nextWander,
    avoidSide: avoidance.threat > 0.05 ? avoidance.side : item.avoidSide,
    avoidLock: avoidance.threat > 0.05 ? 0.42 : Math.max(0, (item.avoidLock ?? 0) - dt),
    heading: currentHeading + clamp(headingDelta, -maxHeadingTurn, maxHeadingTurn),
    follow: influence,
  }

  const collisionCandidates = leafGrid.query(next.x, next.y, maxLeafCollisionRadius + item.size + 3)
  for (let pass = 0; pass < 2; pass += 1) {
    for (const leaf of collisionCandidates) next = resolveLeafCollision(next, leaf)
  }
  return next
}

export function stepFish(
  fish: Fish[],
  leaves: Leaf[],
  bounds: Bounds,
  pointer: Point | PointerState | null,
  dt: number,
  speedScale: number,
  options: StepOptions = {},
): Fish[] {
  if (fish.length === 0) return []
  const safeDt = clamp(Number.isFinite(dt) ? dt : 0, 0.001, 0.5)
  const steps = Math.max(1, Math.ceil(safeDt / (1 / 30)))
  const substep = safeDt / steps
  const leafGrid = options.leafGrid ?? new SpatialGrid<Leaf>(64)
  if (!options.leafGrid) leafGrid.insertAll(leaves)
  const maxLeafCollisionRadius = options.maxLeafCollisionRadius
    ?? leaves.reduce((maximum, leaf) => Math.max(maximum, getLeafCollisionRadius(leaf)), 0)
  let current = fish.map((item) => ({ ...item }))

  for (let step = 0; step < steps; step += 1) {
    const indexedFish: IndexedFish[] = current.map((item, index) => ({ ...item, index }))
    const fishGrid = new SpatialGrid<IndexedFish>(32)
    fishGrid.insertAll(indexedFish)
    current = current.map((item, index) => advanceFish(
      item,
      index,
      fishGrid,
      leafGrid,
      bounds,
      pointer,
      substep,
      speedScale,
      maxLeafCollisionRadius,
    ))
  }

  return current
}
