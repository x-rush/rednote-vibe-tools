import { describe, expect, it } from 'vitest'
import { createMulberry32 } from '../domain/random'
import { createCurtainStrands, pointOnCurtainPath, sampleCurtainPath } from './curtain'

describe('strand curtain motion', () => {
  it('snaps the outer header inward while the same early gust lifts and clears its loose tail leftward', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const inner = strands[0]
    const outer = strands[63]
    if (!inner || !outer) throw new Error('Expected curtain edge strands')
    const innerResting = sampleCurtainPath(inner, 0, 0, 0)
    const outerResting = sampleCurtainPath(outer, 0, 0, 0)
    const innerCaught = sampleCurtainPath(inner, 0.2, 600, 0, 0.8)
    const outerCaught = sampleCurtainPath(outer, 0.2, 600, 0, 0.8)

    expect(outerResting.start.x - outerCaught.start.x).toBeGreaterThan(70)
    expect(outerCaught.end.x).toBeLessThan(outerResting.end.x - 55)
    expect(outerCaught.end.y).toBeLessThan(outerResting.end.y - 45)
    expect(innerResting.start.x - innerCaught.start.x).toBeGreaterThan(18)
    expect(outerResting.start.x - outerCaught.start.x).toBeGreaterThan(
      (innerResting.start.x - innerCaught.start.x) * 5,
    )
    const innerTailTravel = innerResting.end.x - innerCaught.end.x
    const outerTailTravel = outerResting.end.x - outerCaught.end.x
    expect(innerTailTravel).toBeGreaterThan(20)
    expect(innerTailTravel).toBeLessThan(outerTailTravel * 0.82)
  })

  it('throws the loose outer tail into a broad left arc during the opening gust', () => {
    const strand = createCurtainStrands(64, createMulberry32(42))[63]
    if (!strand) throw new Error('Expected the outer curtain strand')
    const path = sampleCurtainPath(strand, 0.45, 950, 0.18, 1)
    expect(path.start.x - path.end.x).toBeGreaterThan(55)
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

    expect(Math.max(...starts)).toBeLessThan(203)
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(44)
    expect(Math.max(...ends)).toBeLessThan(224)
  })

  it('keeps enough space between gathered roots for individual tassels to remain visible', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const starts = strands.map((strand) => sampleCurtainPath(strand, 1, 7600, 0).start.x)

    expect(Math.max(...starts) - Math.min(...starts)).toBeGreaterThan(36)
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(48)
  })

  it('lets opened tassels hang with a gentle persistent left bias instead of returning vertical', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const hanging = strands.map((strand) => sampleCurtainPath(strand, 1, 7600, 0))
    const horizontalOffsets = hanging.map(({ start, end }) => end.x - start.x)
    const verticalDrops = hanging.map(({ start, end }) => end.y - start.y)

    expect(Math.max(...horizontalOffsets)).toBeLessThan(-4)
    expect(Math.min(...horizontalOffsets)).toBeGreaterThan(-40)
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
    const horizontalDirections = path.nodes.slice(1).map((node, index) => {
      const previous = path.nodes[index]
      return previous ? node.x - previous.x : 0
    })

    expect(path.nodes).toHaveLength(12)
    expect(Math.max(...horizontalDirections) - Math.min(...horizontalDirections)).toBeGreaterThan(1.2)
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

    expect(Math.max(...adjacentGaps)).toBeLessThan(30)
    expect(new Set(tails.map((tail) => Math.round(tail))).size).toBeGreaterThan(8)
  })

  it('gives neighboring strands uneven momentum inside one coherent opening gust', () => {
    const strands = createCurtainStrands(64, createMulberry32(42))
    const displacements = strands.map((strand) => {
      const resting = sampleCurtainPath(strand, 0, 0, 0)
      const gusting = sampleCurtainPath(strand, 0.2, 600, 0.16, 1)
      return gusting.end.x - resting.end.x
    })
    const adjacentChanges = displacements.slice(1).map((movement, index) => movement - (displacements[index] ?? movement))

    expect(Math.max(...displacements)).toBeLessThan(-30)
    expect(Math.max(...displacements) - Math.min(...displacements)).toBeGreaterThan(70)
    expect(adjacentChanges.filter((change) => change < 0).length).toBeGreaterThan(20)
    expect(adjacentChanges.filter((change) => change > 0).length).toBeGreaterThan(20)
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

    expect(outerTravel).toBeGreaterThan(innerTravel * 1.35)
    expect(innerTravel).toBeGreaterThan(2)
    expect(innerTravel).toBeLessThan(8)
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
