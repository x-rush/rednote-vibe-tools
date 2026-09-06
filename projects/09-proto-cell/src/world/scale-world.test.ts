import { describe, expect, it } from 'vitest'
import content from '../content/content.json'
import { minimumPlayableWidth, worldDimensionsForTier } from './scale-world'

describe('scale world safety', () => {
  it('sizes each tier from its maximum body diameter', () => {
    const tier = content.scaleTiers[2]
    expect(worldDimensionsForTier(tier)).toEqual({ width: 1760, height: 2992 })
  })

  it('keeps the collapsed arena wide enough for six player diameters', () => {
    expect(minimumPlayableWidth(40, 6)).toBe(480)
  })
})
