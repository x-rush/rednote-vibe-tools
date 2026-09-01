import { describe, expect, it } from 'vitest'
import { createMulberry32 } from '../domain/random'
import { createCurtainStrands, sampleCurtainPath } from './curtain'

describe('strand curtain motion', () => {
  it('opens from the top before the lower curtain follows', () => {
    const strand = createCurtainStrands(64, createMulberry32(42))[40]
    if (!strand) throw new Error('Expected a strand')
    const closed = sampleCurtainPath(strand, 0, 0, 0)
    const earlyOpening = sampleCurtainPath(strand, 0.34, 600, 0)
    const topShift = Math.abs(earlyOpening.start.x - closed.start.x)
    const tailShift = Math.abs(earlyOpening.end.x - closed.end.x)

    expect(topShift).toBeGreaterThan(12)
    expect(tailShift).toBeLessThan(topShift * 0.55)
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
    const first = sampleCurtainPath(strand, 0, 0, 0.08)
    const second = sampleCurtainPath(strand, 0, 600, 0.08)
    expect(Math.abs(second.end.x - first.end.x)).toBeLessThanOrEqual(3)
  })

  it('gathers the strand rings and tails beside the window after opening', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const gathered = strands.map((strand) => sampleCurtainPath(strand, 1, 7200, 0))
    const starts = gathered.map(({ start }) => start.x)
    const ends = gathered.map(({ end }) => end.x)

    expect(Math.max(...starts)).toBeLessThan(202)
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(28)
    expect(Math.max(...ends)).toBeLessThan(192)
  })

  it('keeps the opened curtain breathing in the continuing wind', () => {
    const strand = createCurtainStrands(64, createMulberry32(42))[32]
    if (!strand) throw new Error('Expected a strand')
    const first = sampleCurtainPath(strand, 1, 7000, 0.36)
    const second = sampleCurtainPath(strand, 1, 8200, 0.36)

    expect(second).not.toEqual(first)
    expect(Math.abs(second.end.x - first.end.x)).toBeGreaterThan(1)
  })
})
