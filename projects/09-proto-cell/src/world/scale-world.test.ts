import { describe, expect, it } from 'vitest'
import { minimumPlayableWidth, worldDimensionsForTier } from './scale-world'
import { getContent } from '../content'
import { cameraZoomFor } from '../rendering/camera'

describe('scale world safety', () => {
  it('opens larger habitats and a wider physical view while old enemies keep their size', () => {
    const tiers = getContent().scaleTiers
    const worlds = tiers.map(worldDimensionsForTier)
    expect(worlds.map((world) => world.width)).toEqual([1440, 2816, 7040])
    const zooms = tiers.map((tier) => cameraZoomFor({ viewport: { width: 390, height: 844 }, radius: tier.radiusRange[1], screenDiameterRatio: tier.screenDiameterRange[1] }))
    expect(zooms[1]).toBeLessThan(zooms[0]!)
    expect(zooms[2]).toBeLessThan(zooms[1]!)
    expect(390 / zooms[2]!).toBeGreaterThan(390 / zooms[0]! * 4)
    expect(22 * 2 * zooms[2]!).toBeLessThan(22 * 2 * zooms[0]!)
  })
  it('sizes each tier from its maximum body diameter', () => {
    const tier = { radiusRange: [24, 40], worldBodyWidths: 22 }
    expect(worldDimensionsForTier(tier)).toEqual({ width: 1760, height: 2992 })
  })

  it('keeps the collapsed arena wide enough for six player diameters', () => {
    expect(minimumPlayableWidth(40, 6)).toBe(480)
  })
})
