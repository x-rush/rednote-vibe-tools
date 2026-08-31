import { describe, expect, it } from 'vitest'
import { getFishBend } from './draw.ts'
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
