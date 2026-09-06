import { describe, expect, it } from 'vitest'
import { screenImpactOffset } from './renderer'

describe('impact feedback', () => {
  it('does not shake for a routine small engulf', () => {
    expect(screenImpactOffset([{
      id: 1,
      kind: 'biomass',
      amount: 12,
      entityId: 'player',
      atMs: 100,
      chain: 1,
    }], 180, false)).toEqual({ x: 0, y: 0 })
  })

  it('keeps a short impact for a high-chain engulf', () => {
    const offset = screenImpactOffset([{
      id: 1,
      kind: 'biomass',
      amount: 28,
      entityId: 'player',
      atMs: 100,
      chain: 4,
    }], 180, false)
    expect(Math.hypot(offset.x, offset.y)).toBeGreaterThan(0)
  })
})
