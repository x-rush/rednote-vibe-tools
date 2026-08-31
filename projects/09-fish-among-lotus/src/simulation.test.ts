import { describe, expect, it } from 'vitest'
import { createFish, createLeaves, resolveLeafCollision, seededRandom, stepFish } from './simulation.ts'
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
})
