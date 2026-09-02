import { describe, expect, it } from 'vitest'
import { createMulberry32 } from '../domain/random'
import { createCurtainStrands, pointOnCurtainPath, sampleCurtainPath } from './curtain'

describe('strand curtain motion', () => {
  it('snaps the outer header inward while its loose tail remains behind', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const inner = strands[0]
    const outer = strands[63]
    if (!inner || !outer) throw new Error('Expected curtain edge strands')
    const innerResting = sampleCurtainPath(inner, 0, 0, 0)
    const outerResting = sampleCurtainPath(outer, 0, 0, 0)
    const innerCaught = sampleCurtainPath(inner, 0.2, 600, 0, 0.8)
    const outerCaught = sampleCurtainPath(outer, 0.2, 600, 0, 0.8)

    expect(outerResting.start.x - outerCaught.start.x).toBeGreaterThan(70)
    expect(Math.abs(outerCaught.end.x - outerResting.end.x)).toBeLessThan(8)
    expect(innerResting.start.x - innerCaught.start.x).toBeLessThan(8)
    expect(Math.abs(innerCaught.end.x - innerResting.end.x)).toBeLessThan(3)
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

    expect(Math.max(...starts)).toBeLessThan(215)
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(44)
    expect(Math.max(...ends)).toBeLessThan(224)
  })

  it('keeps enough space between gathered roots for individual tassels to remain visible', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const starts = strands.map((strand) => sampleCurtainPath(strand, 1, 7600, 0).start.x)

    expect(Math.max(...starts) - Math.min(...starts)).toBeGreaterThan(36)
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(48)
  })

  it('lets opened tassels hang beneath their roots instead of leaning as one sheet', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const hanging = strands.map((strand) => sampleCurtainPath(strand, 1, 7600, 0))
    const horizontalOffsets = hanging.map(({ start, end }) => Math.abs(end.x - start.x))
    const verticalDrops = hanging.map(({ start, end }) => end.y - start.y)

    expect(Math.max(...horizontalOffsets)).toBeLessThan(18)
    expect(Math.min(...verticalDrops)).toBeGreaterThan(340)
  })

  it('settles tassel ends at irregular heights without a repeating step pattern', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const tails = strands.map((strand) => sampleCurtainPath(strand, 1, 7600, 0).end.y)
    const adjacentSteps = tails.slice(1).map((tail, index) => Math.round(tail - (tails[index] ?? tail)))

    expect(new Set(adjacentSteps).size).toBeGreaterThan(12)
  })

  it('keeps the opened curtain breathing in the continuing wind', () => {
    const strand = createCurtainStrands(64, createMulberry32(42))[32]
    if (!strand) throw new Error('Expected a strand')
    const first = sampleCurtainPath(strand, 1, 7000, 0.36)
    const second = sampleCurtainPath(strand, 1, 8200, 0.36)

    expect(second).not.toEqual(first)
    expect(Math.abs(second.end.x - first.end.x)).toBeGreaterThan(1)
  })

  it('lets neighboring tassels drift in different directions under the same breeze', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const movements = strands.map((strand) => {
      const first = sampleCurtainPath(strand, 1, 7200, 0.28, 0, 3)
      const later = sampleCurtainPath(strand, 1, 7600, 0.28, 0, 3)
      return later.end.x - first.end.x
    })
    const leftward = movements.filter((movement) => movement < -0.4).length
    const rightward = movements.filter((movement) => movement > 0.4).length

    expect(leftward).toBeGreaterThanOrEqual(14)
    expect(rightward).toBeGreaterThanOrEqual(14)
  })

  it('forms a multi-segment flowing tassel instead of moving as one stiff curve', () => {
    const strand = createCurtainStrands(64, createMulberry32(42))[32]
    if (!strand) throw new Error('Expected a strand')
    const path = sampleCurtainPath(strand, 1, 7600, 0.28, 0, 5)
    const horizontalTurns = path.nodes.slice(1).reduce((turns, node, index) => {
      const previous = path.nodes[index]
      const beforePrevious = path.nodes[index - 1]
      if (!previous || !beforePrevious) return turns
      const previousDirection = previous.x - beforePrevious.x
      const nextDirection = node.x - previous.x
      return turns + (previousDirection * nextDirection < 0 ? 1 : 0)
    }, 0)

    expect(path.nodes).toHaveLength(12)
    expect(horizontalTurns).toBeGreaterThanOrEqual(1)
  })

  it('keeps the tassel header anchored while the loose tail takes the wind', () => {
    const strand = createCurtainStrands(64, createMulberry32(42))[63]
    if (!strand) throw new Error('Expected a strand')
    const left = sampleCurtainPath(strand, 1, 7600, 0.68, 0, -54)
    const right = sampleCurtainPath(strand, 1, 7600, 0.68, 0, 54)

    expect(Math.abs(right.start.x - left.start.x)).toBeLessThan(4)
    expect(Math.abs(right.end.x - left.end.x)).toBeGreaterThan(95)
  })

  it('moves adjacent strands as one wind-swept bundle with slight stagger', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const tails = strands.map((strand) => sampleCurtainPath(strand, 1, 7600, 0.28, 0, 5).end.x)
    const adjacentGaps = tails.slice(1).map((tail, index) => Math.abs(tail - (tails[index] ?? tail)))

    expect(Math.max(...adjacentGaps)).toBeLessThan(22)
    expect(new Set(tails.map((tail) => Math.round(tail))).size).toBeGreaterThan(8)
  })

  it('uses wind for small irregular ripples instead of carrying the fringe sideways', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const displacements = strands.map((strand) => {
      const resting = sampleCurtainPath(strand, 0, 640, 0)
      const gusting = sampleCurtainPath(strand, 0, 640, 0, 0.8)
      return gusting.end.x - resting.end.x
    })

    expect(Math.max(...displacements) - Math.min(...displacements)).toBeGreaterThan(2)
    expect(Math.max(...displacements.map(Math.abs))).toBeLessThan(6)
    expect(new Set(displacements.map((value) => Math.round(value))).size).toBeGreaterThan(4)
  })

  it('keeps the outer fringe more responsive without freezing the inner fringe', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const inner = strands[0]
    const outer = strands[63]
    if (!inner || !outer) throw new Error('Expected curtain edge strands')
    const innerLeft = sampleCurtainPath(inner, 1, 7600, 0.28, 0, -5)
    const innerRight = sampleCurtainPath(inner, 1, 7600, 0.28, 0, 5)
    const outerLeft = sampleCurtainPath(outer, 1, 7600, 0.28, 0, -5)
    const outerRight = sampleCurtainPath(outer, 1, 7600, 0.28, 0, 5)
    const innerTravel = Math.abs(innerRight.end.x - innerLeft.end.x)
    const outerTravel = Math.abs(outerRight.end.x - outerLeft.end.x)

    expect(outerTravel).toBeGreaterThan(innerTravel * 2)
    expect(innerTravel).toBeGreaterThan(2)
    expect(innerTravel).toBeLessThan(6)
  })

  it('samples sparkle positions along the moving strand curve', () => {
    const strand = createCurtainStrands(64, createMulberry32(42))[18]
    if (!strand) throw new Error('Expected a strand')
    const path = sampleCurtainPath(strand, 1, 7600, 0.36)
    expect(pointOnCurtainPath(path, 0)).toEqual(path.start)
    expect(pointOnCurtainPath(path, 1)).toEqual(path.end)
    expect(pointOnCurtainPath(path, 0.5)).not.toEqual(path.nodes[0])
  })
})
