import { describe, expect, it } from 'vitest'
import { createMulberry32 } from '../domain/random'
import { createCurtainStrands, sampleCurtainPath } from './curtain'

describe('strand curtain motion', () => {
  it('keeps every strand anchored while the lower end moves farther', () => {
    const strand = createCurtainStrands(1, () => 0.5)[0]
    expect(strand).toBeDefined()
    if (!strand) return
    const still = sampleCurtainPath(strand, 0, 0)
    const gust = sampleCurtainPath(strand, 1, 2800)
    expect(gust.start).toEqual(still.start)
    expect(Math.abs(gust.end.x - still.end.x)).toBeGreaterThan(
      Math.abs(gust.control1.x - still.control1.x),
    )
    expect(gust.end.y).toBeGreaterThan(still.end.y)
  })

  it('creates independent delays and lengths for sixty-four strands', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    expect(new Set(strands.map(({ delay }) => delay)).size).toBeGreaterThan(20)
    expect(new Set(strands.map(({ length }) => Math.round(length))).size).toBeGreaterThan(10)
    expect(strands).toHaveLength(64)
  })

  it('adds only a restrained breathing motion before the gust', () => {
    const strand = createCurtainStrands(1, () => 0.4)[0]
    if (!strand) throw new Error('Expected a strand')
    const first = sampleCurtainPath(strand, 0, 0)
    const second = sampleCurtainPath(strand, 0, 600)
    expect(Math.abs(second.end.x - first.end.x)).toBeLessThanOrEqual(3)
  })
})
