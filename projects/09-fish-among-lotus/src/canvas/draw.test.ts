import { describe, expect, it } from 'vitest'
import { getCoverCrop, getFishBend } from './draw.ts'
import type { Fish } from '../simulation.ts'

describe('fish drawing pose', () => {
  it('keeps the body bend subtle when collision velocity opposes its heading', () => {
    const fish: Fish = {
      x: 120,
      y: 300,
      vx: -42,
      vy: 0,
      size: 4,
      phase: 0,
      tone: 0,
      heading: 0,
    }

    expect(Math.abs(getFishBend(fish))).toBeLessThanOrEqual(0.56)
  })
})

describe('poster background crop', () => {
  it('center-crops a landscape image to fill a portrait canvas', () => {
    const crop = getCoverCrop(1600, 900, { width: 390, height: 844 })

    expect(crop.x).toBeCloseTo(592.06, 1)
    expect(crop.y).toBe(0)
    expect(crop.width).toBeCloseTo(415.88, 1)
    expect(crop.height).toBe(900)
  })
})
