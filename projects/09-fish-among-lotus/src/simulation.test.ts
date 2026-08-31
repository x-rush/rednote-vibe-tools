import { describe, expect, it } from 'vitest'
import { createFish, createLeaves, resolveLeafCollision, seededRandom, stepFish } from './simulation.ts'

describe('pond simulation', () => {
  it('creates repeatable scenery with a seed', () => {
    const first = createLeaves(12, { width: 390, height: 700 }, seededRandom(8))
    const second = createLeaves(12, { width: 390, height: 700 }, seededRandom(8))
    expect(first).toEqual(second)
    expect(first).toHaveLength(12)
  })

  it('pushes fish outside a lotus collision radius', () => {
    const fish = { x: 105, y: 100, vx: -20, vy: 0, size: 8, phase: 0, tone: 0 }
    const leaf = { x: 100, y: 100, radius: 20, notch: 0.3, rotation: 0, flower: false }
    const result = resolveLeafCollision(fish, leaf)
    expect(Math.hypot(result.x - leaf.x, result.y - leaf.y)).toBeGreaterThanOrEqual(28)
    expect(result.vx).toBeGreaterThan(fish.vx)
  })

  it('accelerates a fish toward an active pointer', () => {
    const fish = createFish(1, { width: 390, height: 700 }, seededRandom(2))
    fish[0] = { ...fish[0], x: 100, y: 100, vx: 0, vy: 0, phase: 0 }
    const next = stepFish(fish, [], { width: 390, height: 700 }, { x: 300, y: 100 }, 0.1, 1)
    expect(next[0].vx).toBeGreaterThan(0)
  })
})
