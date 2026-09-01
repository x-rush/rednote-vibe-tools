import { describe, expect, it } from 'vitest'
import { advanceVelocity, worldSpeedForForm } from './motion'

describe('movement response', () => {
  it('expresses movement in body lengths instead of fixed world units', () => {
    expect(worldSpeedForForm(24, 2.4)).toBeCloseTo(115.2)
  })

  it('reaches at least 60% speed within 180ms', () => {
    const velocity = advanceVelocity(
      { x: 0, y: 0 },
      { direction: { x: 1, y: 0 }, strength: 1 },
      100,
      180,
    )

    expect(velocity.x).toBeGreaterThanOrEqual(60)
    expect(velocity.y).toBe(0)
  })

  it('reverses without retaining a forward lock', () => {
    const velocity = advanceVelocity(
      { x: 80, y: 0 },
      { direction: { x: -1, y: 0 }, strength: 1 },
      100,
      260,
    )

    expect(velocity.x).toBeLessThan(0)
  })

  it('keeps a pursuing hunter committed to its old heading during a sharp juke', () => {
    const velocity = advanceVelocity(
      { x: 0, y: -120 },
      { direction: { x: 1, y: 0 }, strength: 1 },
      120,
      180,
      { responseMs: 460 },
    )

    expect(velocity.y).toBeLessThan(-75)
    expect(velocity.x).toBeLessThan(40)
  })
})
