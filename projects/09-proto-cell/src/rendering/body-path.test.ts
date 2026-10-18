import { afterEach, describe, expect, it, vi } from 'vitest'
import { membraneContour } from '../domain/membrane'
import { membranePath } from './body-path'

class RecordingPath {
  points: Array<{ x: number; y: number }> = []
  moveTo(x: number, y: number) { this.points.push({ x, y }) }
  lineTo(x: number, y: number) { this.points.push({ x, y }) }
  closePath() {}
}
afterEach(() => vi.unstubAllGlobals())
describe('shared exact membrane drawing paths', () => {
  it('retains every physical contour vertex and shares only ID-independent silhouettes', () => {
    vi.stubGlobal('Path2D', RecordingPath)
    const first = membranePath('colony', 1234, 'first')
    expect((first as unknown as RecordingPath).points).toEqual(membraneContour('colony', 1234, 'first'))
    expect(membranePath('colony', 1234, 'second')).toBe(first)
    expect(membranePath('colony', 1235, 'second')).not.toBe(first)
    expect(membranePath('hunter', 1234, 'first')).not.toBe(membranePath('hunter', 1234, 'second'))
  })
  it('falls back without Path2D and bounds retained paths across long runs', () => {
    vi.stubGlobal('Path2D', undefined)
    expect(membranePath('colony', 4321, 'first')).toBeUndefined()
    vi.stubGlobal('Path2D', RecordingPath)
    const first = membranePath('hunter', 4321, 'eviction-first')
    for (let index = 0; index < 600; index += 1) membranePath('hunter', 4321, `evict-${index}`)
    expect(membranePath('hunter', 4321, 'eviction-first')).not.toBe(first)
  })
})
