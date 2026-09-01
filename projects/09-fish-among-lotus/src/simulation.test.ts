import { describe, expect, it } from 'vitest'
import {
  createEnteringFish,
  createFish,
  createLeaves,
  resolveLeafCollision,
  seededRandom,
  stepFish,
  stepLeaves,
} from './simulation.ts'
import type { Fish, Leaf } from './simulation.ts'

const bounds = { width: 390, height: 844 }

function makeFish(overrides: Partial<Fish> = {}): Fish {
  return {
    x: 70,
    y: 300,
    vx: 42,
    vy: 0,
    size: 4,
    phase: Math.PI / 2,
    tone: 0,
    ...overrides,
  }
}

function makeLeaf(overrides: Partial<Leaf> = {}): Leaf {
  return {
    x: 120,
    y: 300,
    radius: 24,
    notch: 0.3,
    rotation: 0,
    flower: false,
    ...overrides,
  }
}

describe('pond simulation', () => {
  it('creates repeatable clustered scenery with varied size tiers', () => {
    const first = createLeaves(112, bounds, seededRandom(8))
    const second = createLeaves(112, bounds, seededRandom(8))
    const clustered = first.filter((leaf) => {
      const nx = (leaf.x - bounds.width * 0.53) / (bounds.width * 0.47)
      const ny = (leaf.y - bounds.height * 0.45) / (bounds.height * 0.35)
      return nx * nx + ny * ny <= 1
    })
    const radii = first.map((leaf) => leaf.radius)

    expect(first).toEqual(second)
    expect(first).toHaveLength(112)
    expect(clustered.length).toBeGreaterThanOrEqual(78)
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(2.2)
  })

  it('uses a smaller collision body than the visible lotus disk', () => {
    const fish = makeFish({ x: 105, y: 100, vx: -20, size: 5 })
    const leaf = makeLeaf({ x: 100, y: 100, radius: 28, collisionRadius: 15 })
    const result = resolveLeafCollision(fish, leaf, 0)
    const distance = Math.hypot(result.x - leaf.x, result.y - leaf.y)

    expect(distance).toBeGreaterThanOrEqual(18.4)
    expect(distance).toBeLessThan(21)
    expect(result.vx).toBeGreaterThan(fish.vx)
  })

  it('moves a lotus leaf away when a fish strikes it', () => {
    const leaf = makeLeaf({ x: 120, y: 300, homeX: 120, homeY: 300, collisionRadius: 16 })
    const fish = makeFish({ x: 99, y: 300, vx: 64, vy: 0, follow: 1 })
    const next = stepLeaves([leaf], [fish], bounds, 1 / 30)[0]

    expect(next.x).toBeGreaterThan(120)
    expect(next.vx).toBeGreaterThan(0)
  })

  it('moves a small leaf more than a large leaf under the same impact', () => {
    const fish = makeFish({ x: 99, y: 300, vx: 64, vy: 0, follow: 1 })
    const small = makeLeaf({ x: 120, y: 300, homeX: 120, homeY: 300, radius: 14, collisionRadius: 16 })
    const large = makeLeaf({ x: 120, y: 300, homeX: 120, homeY: 300, radius: 42, collisionRadius: 16 })

    const movedSmall = stepLeaves([small], [fish], bounds, 1 / 30)[0]
    const movedLarge = stepLeaves([large], [fish], bounds, 1 / 30)[0]

    expect(movedSmall.x - small.x).toBeGreaterThan((movedLarge.x - large.x) * 1.5)
  })

  it('drifts a displaced leaf back toward its original cluster position', () => {
    let leaf = makeLeaf({ x: 150, y: 300, homeX: 120, homeY: 300, vx: 0, vy: 0 })

    for (let frame = 0; frame < 120; frame += 1) {
      leaf = stepLeaves([leaf], [], bounds, 1 / 60)[0]
    }

    expect(leaf.x).toBeLessThan(145)
    expect(leaf.x).toBeGreaterThan(115)
  })

  it('gives an off-center fish impact a subtle leaf rotation', () => {
    const leaf = makeLeaf({ x: 120, y: 300, homeX: 120, homeY: 300, collisionRadius: 16 })
    const fish = makeFish({ x: 99, y: 294, vx: 64, vy: 0, follow: 1 })
    const next = stepLeaves([leaf], [fish], bounds, 1 / 30)[0]

    expect(Math.abs(next.rotation - leaf.rotation)).toBeGreaterThan(0)
    expect(Math.abs(next.angularVelocity ?? 0)).toBeGreaterThan(0)
    expect(Math.abs(next.angularVelocity ?? 0)).toBeLessThan(0.7)
  })

  it('keeps a strongly pushed leaf finite and inside the water field', () => {
    const leaf = makeLeaf({
      x: 382,
      y: 770,
      homeX: 320,
      homeY: 700,
      vx: 2400,
      vy: 1800,
      angularVelocity: 20,
    })
    const next = stepLeaves([leaf], [], bounds, 1)[0]

    expect(Number.isFinite(next.x)).toBe(true)
    expect(Number.isFinite(next.y)).toBe(true)
    expect(Number.isFinite(next.vx)).toBe(true)
    expect(Number.isFinite(next.vy)).toBe(true)
    expect(next.x).toBeLessThanOrEqual(bounds.width + leaf.radius * 0.2)
    expect(next.y).toBeLessThanOrEqual(bounds.height * 0.92)
    expect(Math.hypot(next.vx ?? 0, next.vy ?? 0)).toBeLessThanOrEqual(120)
  })

  it('opens a visible passage under sustained pointer-follow pressure', () => {
    const pointer = { x: 220, y: 300, active: true, strength: 1, trail: [{ x: 220, y: 300 }] }
    let fish = Array.from({ length: 4 }, (_, index) => makeFish({
      x: 55 - index * 6,
      y: 287 + index * 8,
      vx: 44,
      vy: 0,
      heading: 0,
      wander: 0,
      responsiveness: 1.2,
      phase: 1 + index * 0.7,
      tone: index,
      avoidSide: index % 2 ? -1 : 1,
    }))
    let leaves = [makeLeaf({
      x: 130,
      y: 300,
      homeX: 130,
      homeY: 300,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
      radius: 28,
      collisionRadius: 19,
    })]
    let farthestLeafX = leaves[0].x

    for (let frame = 0; frame < 180; frame += 1) {
      fish = stepFish(fish, leaves, bounds, pointer, 1 / 60, 1)
      leaves = stepLeaves(leaves, fish, bounds, 1 / 60)
      farthestLeafX = Math.max(farthestLeafX, leaves[0].x)
    }

    expect(farthestLeafX - 130).toBeGreaterThan(10)
  })

  it('adds a lateral component before an approaching fish reaches a leaf', () => {
    const fish = makeFish()
    const next = stepFish([fish], [makeLeaf()], bounds, null, 0.12, 1)

    expect(next[0].x).toBeLessThan(120)
    expect(Math.abs(next[0].vy)).toBeGreaterThan(2)
  })

  it('keeps finite bounded velocity between adjacent leaves', () => {
    const fish = makeFish({ x: 112, y: 300, vx: 56, vy: 2 })
    const leaves = [makeLeaf({ x: 130, y: 290 }), makeLeaf({ x: 130, y: 310 }), makeLeaf({ x: 145, y: 300 })]
    const next = stepFish([fish], leaves, bounds, null, 0.42, 1.3)[0]

    expect(Number.isFinite(next.x)).toBe(true)
    expect(Number.isFinite(next.y)).toBe(true)
    expect(Number.isFinite(next.vx)).toBe(true)
    expect(Number.isFinite(next.vy)).toBe(true)
    expect(Math.hypot(next.vx, next.vy)).toBeLessThanOrEqual(108)
  })

  it('does not leave any fish stalled in a dense moving lotus cluster', () => {
    const random = seededRandom(9182)
    let leaves = createLeaves(112, bounds, random)
    let fish = createFish(44, bounds, random)
    const stalledFrames = fish.map(() => 0)
    let longestStall = 0

    for (let frame = 0; frame < 300; frame += 1) {
      const previous = fish
      fish = stepFish(fish, leaves, bounds, null, 1 / 60, 1)
      leaves = stepLeaves(leaves, fish, bounds, 1 / 60)
      fish.forEach((item, index) => {
        const movement = Math.hypot(item.x - previous[index].x, item.y - previous[index].y)
        stalledFrames[index] = movement < 0.12 ? stalledFrames[index] + 1 : 0
        longestStall = Math.max(longestStall, stalledFrames[index])
      })
    }

    expect(longestStall).toBeLessThan(120)
  })

  it('keeps the chosen avoidance side while its lock is active', () => {
    const fish = makeFish({ avoidSide: 1, avoidLock: 0.4 })
    const leaf = makeLeaf({ x: 110, y: 310 })
    const next = stepFish([fish], [leaf], bounds, null, 0.05, 1)[0]

    expect(next.avoidSide).toBe(1)
    expect(next.avoidLock).toBeGreaterThan(0)
  })

  it('corrects penetration when a large leaf center is outside the old query radius', () => {
    const leaf = makeLeaf({ x: 120, y: 300, radius: 90, collisionRadius: 70 })
    const fish = makeFish({ x: 180, y: 300, vx: 0, vy: 0, size: 4 })
    const next = stepFish([fish], [leaf], bounds, null, 1 / 60, 1)[0]

    expect(Math.hypot(next.x - leaf.x, next.y - leaf.y)).toBeGreaterThanOrEqual(74.7)
  })

  it('does not pull a fish into a leaf when the pointer is inside it', () => {
    const leaf = makeLeaf({ x: 170, y: 320, radius: 30, collisionRadius: 18 })
    const pointer = { x: leaf.x, y: leaf.y, active: true, strength: 1, trail: [{ x: leaf.x, y: leaf.y }] }
    let fish = makeFish({ x: 115, y: 320, vx: 24, vy: 0 })

    for (let frame = 0; frame < 30; frame += 1) {
      fish = stepFish([fish], [leaf], bounds, pointer, 1 / 30, 1)[0]
    }

    expect(Math.hypot(fish.x - leaf.x, fish.y - leaf.y)).toBeGreaterThanOrEqual(21)
    expect(Number.isFinite(fish.vx)).toBe(true)
  })

  it('does not tunnel straight through a leaf at a large dt', () => {
    const leaf = makeLeaf({ x: 130, y: 300, radius: 28, collisionRadius: 19 })
    const fish = makeFish({ x: 55, y: 300, vx: 54, vy: 0 })
    const next = stepFish([fish], [leaf], bounds, null, 2, 1)[0]
    const passedStraightThrough = next.x > 153 && Math.abs(next.y - leaf.y) < 23

    expect(passedStraightThrough).toBe(false)
    expect(Math.hypot(next.x - leaf.x, next.y - leaf.y)).toBeGreaterThanOrEqual(22)
  })

  it('separates coincident fish instead of collapsing at the pointer', () => {
    const pointer = { x: 200, y: 330, active: true, strength: 1, trail: [{ x: 190, y: 330 }, { x: 200, y: 330 }] }
    let fish = [makeFish({ x: 140, y: 330, vx: 20 }), makeFish({ x: 140, y: 330, vx: 20, tone: 1 })]

    for (let frame = 0; frame < 45; frame += 1) {
      fish = stepFish(fish, [], bounds, pointer, 1 / 60, 1)
    }

    expect(Math.hypot(fish[0].x - fish[1].x, fish[0].y - fish[1].y)).toBeGreaterThan(4)
  })

  it('limits visible turning while following through a dense leaf cluster', () => {
    const random = seededRandom(9182)
    const leaves = createLeaves(112, bounds, random)
    let fish = createFish(27, bounds, random)
    const pointer = { x: 195, y: 422, active: true, strength: 1, trail: [{ x: 195, y: 422 }] }
    let largestTurn = 0

    for (let frame = 0; frame < 240; frame += 1) {
      const previous = fish
      fish = stepFish(fish, leaves, bounds, pointer, 1 / 60, 1)
      fish.forEach((item, index) => {
        const before = previous[index].heading ?? Math.atan2(previous[index].vy, previous[index].vx)
        const after = item.heading ?? Math.atan2(item.vy, item.vx)
        const turn = Math.abs(Math.atan2(Math.sin(after - before), Math.cos(after - before)))
        largestTurn = Math.max(largestTurn, turn)
      })
    }

    expect(largestTurn).toBeLessThan(0.13)
  })

  it('turns before reaching a hard canvas edge', () => {
    const fish = makeFish({ x: 34, y: 420, vx: -34, vy: 0 })
    const next = stepFish([fish], [], bounds, null, 0.2, 1)[0]

    expect(next.vx).toBeGreaterThan(-25)
    expect(next.x).toBeGreaterThan(24)
  })

  it('creates deterministic fish characteristics', () => {
    const first = createFish(8, bounds, seededRandom(12))
    const second = createFish(8, bounds, seededRandom(12))
    expect(first).toEqual(second)
  })

  it('stages a deterministic school fully outside the left edge before entering', () => {
    const first = createEnteringFish(18, bounds, seededRandom(42))
    const second = createEnteringFish(18, bounds, seededRandom(42))

    expect(first).toEqual(second)
    expect(first).toHaveLength(18)
    expect(first.every((fish) => fish.x + fish.size * 4 < 0)).toBe(true)
    expect(first.every((fish) => (fish.entryDelay ?? 0) >= 0.55)).toBe(true)
    expect(first.every((fish) => fish.vx > 50 && fish.entering)).toBe(true)
    expect(new Set(first.map((fish) => Math.round((fish.entryDelay ?? 0) * 10))).size).toBeGreaterThan(2)
  })

  it('keeps the staged school offscreen during the opening leaf-only beat', () => {
    let fish = createEnteringFish(18, bounds, seededRandom(17))

    for (let frame = 0; frame < 27; frame += 1) {
      fish = stepFish(fish, [], bounds, null, 1 / 60, 1)
    }

    expect(fish.every((item) => item.x + item.size * 4 < 0)).toBe(true)
  })

  it('moves an entering school through dense leaves without prolonged stalls or spinning', () => {
    const random = seededRandom(9182)
    let leaves = createLeaves(112, bounds, random)
    let fish = createEnteringFish(44, bounds, random)
    const stalledFrames = fish.map(() => 0)
    let longestStall = 0
    let largestTurn = 0

    for (let frame = 0; frame < 540; frame += 1) {
      const previous = fish
      fish = stepFish(fish, leaves, bounds, null, 1 / 60, 1)
      leaves = stepLeaves(leaves, fish, bounds, 1 / 60)
      fish.forEach((item, index) => {
        const movement = Math.hypot(item.x - previous[index].x, item.y - previous[index].y)
        stalledFrames[index] = movement < 0.1 ? stalledFrames[index] + 1 : 0
        longestStall = Math.max(longestStall, stalledFrames[index])
        if ((item.entryDelay ?? 0) <= 0) {
          const before = previous[index].heading ?? Math.atan2(previous[index].vy, previous[index].vx)
          const after = item.heading ?? Math.atan2(item.vy, item.vx)
          const turn = Math.abs(Math.atan2(Math.sin(after - before), Math.cos(after - before)))
          largestTurn = Math.max(largestTurn, turn)
        }
      })
    }

    expect(fish.every((item) => Number.isFinite(item.x + item.y + item.vx + item.vy))).toBe(true)
    expect(fish.filter((item) => item.x > bounds.width * 0.34).length).toBeGreaterThanOrEqual(40)
    expect(fish.filter((item) => item.entering).length).toBe(0)
    expect(longestStall).toBeLessThan(95)
    expect(largestTurn).toBeLessThan(0.14)
  })
})
