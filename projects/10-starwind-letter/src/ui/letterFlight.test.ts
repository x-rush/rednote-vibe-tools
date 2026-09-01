import { describe, expect, it } from 'vitest'
import { pointInConvexQuad, WINDOW_PORTAL } from '../scene/geometry'
import { sampleLetterFlight } from './letterFlight'

describe('star-borne letter trajectories', () => {
  it('starts every glyph near the portal and settles in source order', () => {
    const start = sampleLetterFlight('星风来信', 0, false)
    expect(start.every(({ source }) => pointInConvexQuad(source, WINDOW_PORTAL))).toBe(true)
    expect(start.every(({ opacity, blurPx }) => opacity <= 0.18 && blurPx >= 5)).toBe(true)

    const result = sampleLetterFlight('星风来信', 1, false)
    expect(result.map(({ character }) => character).join('')).toBe('星风来信')
    expect(result.every(({ translateX, translateY, rotationDeg, blurPx }) => (
      translateX === 0 && translateY === 0 && rotationDeg === 0 && blurPx === 0
    ))).toBe(true)
  })

  it('stagger-delays later glyphs without changing final order', () => {
    const middle = sampleLetterFlight('今晚有星光', 0.45, false)
    expect(middle[0]!.progress).toBeGreaterThan(middle.at(-1)!.progress)
  })

  it('reduces rotation and travel in reduced motion', () => {
    const full = sampleLetterFlight('星风', 0.35, false)
    const reduced = sampleLetterFlight('星风', 0.35, true)
    expect(Math.abs(reduced[0]!.rotationDeg)).toBeLessThan(Math.abs(full[0]!.rotationDeg))
    expect(Math.abs(reduced[0]!.translateY)).toBeLessThan(Math.abs(full[0]!.translateY))
  })
})
