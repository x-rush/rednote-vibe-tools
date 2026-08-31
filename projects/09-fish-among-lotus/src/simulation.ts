export type Point = { x: number; y: number }
export type Fish = Point & { vx: number; vy: number; size: number; phase: number; tone: number }
export type Leaf = Point & { radius: number; notch: number; rotation: number; flower: boolean }
export type Bounds = { width: number; height: number }

const TAU = Math.PI * 2

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
    const speed = 18 + random() * 20
    return {
      x: bounds.width * (0.15 + random() * 0.7),
      y: bounds.height * (0.2 + random() * 0.6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5.5 + random() * 4.5,
      phase: random() * TAU,
      tone: index % 5,
    }
  })
}

export function createLeaves(count: number, bounds: Bounds, random = Math.random): Leaf[] {
  const leaves: Leaf[] = []
  const minSize = Math.min(bounds.width, bounds.height)
  for (let attempts = 0; leaves.length < count && attempts < count * 24; attempts += 1) {
    const radius = minSize * (0.035 + random() * 0.035)
    const candidate: Leaf = {
      x: radius + random() * (bounds.width - radius * 2),
      y: bounds.height * 0.16 + random() * (bounds.height * 0.72),
      radius,
      notch: 0.25 + random() * 0.28,
      rotation: random() * TAU,
      flower: random() < 0.13,
    }
    if (leaves.every((leaf) => Math.hypot(leaf.x - candidate.x, leaf.y - candidate.y) > (leaf.radius + radius) * 0.72)) {
      leaves.push(candidate)
    }
  }
  return leaves
}

export function resolveLeafCollision(fish: Fish, leaf: Leaf, padding = 3): Fish {
  const dx = fish.x - leaf.x
  const dy = fish.y - leaf.y
  const distance = Math.hypot(dx, dy)
  const limit = leaf.radius + fish.size * 0.7 + padding
  if (distance >= limit) return fish
  const nx = distance > 0.001 ? dx / distance : 1
  const ny = distance > 0.001 ? dy / distance : 0
  const dot = fish.vx * nx + fish.vy * ny
  return {
    ...fish,
    x: leaf.x + nx * limit,
    y: leaf.y + ny * limit,
    vx: fish.vx - Math.min(dot, 0) * 1.7 * nx,
    vy: fish.vy - Math.min(dot, 0) * 1.7 * ny,
  }
}

export function stepFish(
  fish: Fish[],
  leaves: Leaf[],
  bounds: Bounds,
  pointer: Point | null,
  dt: number,
  speedScale: number,
): Fish[] {
  return fish.map((item, index) => {
    let ax = Math.sin(item.phase + index * 1.9) * 5
    let ay = Math.cos(item.phase * 0.8 + index) * 5

    if (pointer) {
      const dx = pointer.x - item.x
      const dy = pointer.y - item.y
      const distance = Math.max(24, Math.hypot(dx, dy))
      const pull = Math.min(76, distance * 0.55)
      ax += (dx / distance) * pull
      ay += (dy / distance) * pull
    }

    for (let otherIndex = 0; otherIndex < fish.length; otherIndex += 1) {
      if (otherIndex === index) continue
      const other = fish[otherIndex]
      const dx = item.x - other.x
      const dy = item.y - other.y
      const distance = Math.hypot(dx, dy)
      if (distance > 0 && distance < 24) {
        ax += (dx / distance) * (24 - distance) * 1.6
        ay += (dy / distance) * (24 - distance) * 1.6
      }
    }

    const margin = 28
    if (item.x < margin) ax += (margin - item.x) * 3
    if (item.x > bounds.width - margin) ax -= (item.x - bounds.width + margin) * 3
    if (item.y < margin) ay += (margin - item.y) * 3
    if (item.y > bounds.height - margin) ay -= (item.y - bounds.height + margin) * 3

    let vx = item.vx + ax * dt
    let vy = item.vy + ay * dt
    const maxSpeed = (pointer ? 92 : 54) * speedScale
    const speed = Math.hypot(vx, vy)
    if (speed > maxSpeed) {
      vx = (vx / speed) * maxSpeed
      vy = (vy / speed) * maxSpeed
    }
    let next: Fish = {
      ...item,
      x: item.x + vx * dt,
      y: item.y + vy * dt,
      vx,
      vy,
      phase: item.phase + dt * (4 + speed * 0.04),
    }
    for (const leaf of leaves) next = resolveLeafCollision(next, leaf)
    return next
  })
}
