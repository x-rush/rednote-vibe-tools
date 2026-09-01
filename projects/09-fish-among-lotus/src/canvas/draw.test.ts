import { describe, expect, it } from 'vitest'
import { drawWater, getCoverCrop, getFishBend } from './draw.ts'
import type { Fish } from '../simulation.ts'

function createRecordingContext() {
  const calls = { images: 0, fullCanvasFills: 0, shapeFills: 0 }
  const context = {
    drawImage: () => { calls.images += 1 },
    fillRect: () => { calls.fullCanvasFills += 1 },
    fill: () => { calls.shapeFills += 1 },
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    ellipse: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    fillStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: '',
  } as unknown as CanvasRenderingContext2D

  return { calls, context }
}

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

  it('keeps custom poster pixels free from pale water overlays', () => {
    const { calls, context } = createRecordingContext()

    drawWater(context, { width: 390, height: 844 }, 0, false, {
      image: {} as CanvasImageSource,
      width: 1170,
      height: 2532,
    })

    expect(calls.images).toBe(1)
    expect(calls.fullCanvasFills).toBe(0)
    expect(calls.shapeFills).toBe(0)
  })
})
