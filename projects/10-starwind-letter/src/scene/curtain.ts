import type { RandomSource } from '../domain/random'
import type { Point } from './geometry'

export interface CurtainStrand {
  readonly id: number
  readonly anchor: Point
  readonly length: number
  readonly brightness: number
  readonly phase: number
  readonly delay: number
  readonly response: number
}

export interface CurtainPath {
  readonly start: Point
  readonly control1: Point
  readonly control2: Point
  readonly end: Point
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const easeInOut = (value: number) => value * value * (3 - 2 * value)
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

export function createCurtainStrands(count: number, random: RandomSource): readonly CurtainStrand[] {
  if (!Number.isInteger(count) || count <= 0) throw new Error('Curtain strand count must be positive')
  const denominator = Math.max(1, count - 1)
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / denominator
    const anchorX = 184 + ratio * 189
    return {
      id: index,
      anchor: { x: anchorX, y: 116 + ratio * 35 },
      length: 306 + random() * 88 + ratio * 28,
      brightness: 0.42 + random() * 0.5,
      phase: random() * Math.PI * 2,
      delay: ratio * 0.24 + random() * 0.075,
      response: 0.72 + random() * 0.5,
    }
  })
}

function curtainSegmentProgress(openingProgress: number, delay: number) {
  return easeInOut(clamp((openingProgress - delay) / Math.max(0.01, 1 - delay)))
}

export function sampleCurtainPath(strand: CurtainStrand, openingProgress: number, timeMs: number, ambientStrength = 0): CurtainPath {
  const strandRatio = strand.id / 63
  const topProgress = curtainSegmentProgress(openingProgress, 0)
  const shoulderProgress = curtainSegmentProgress(openingProgress, 0.1)
  const bodyProgress = curtainSegmentProgress(openingProgress, 0.24)
  const tailProgress = curtainSegmentProgress(openingProgress, 0.42)
  const wave = Math.sin(timeMs / 720 + strand.phase) * ambientStrength * (18 + strand.response * 9)
  const verticalWave = Math.cos(timeMs / 930 + strand.phase) * ambientStrength * 2

  const closedStart = strand.anchor
  const openedStart = { x: 176 + strandRatio * 22, y: 114 + strandRatio * 5 }
  const closedControl1 = { x: strand.anchor.x, y: strand.anchor.y + strand.length * 0.31 }
  const openedControl1 = { x: 163 + strandRatio * 28, y: 255 + strandRatio * 14 }
  const closedControl2 = { x: strand.anchor.x, y: strand.anchor.y + strand.length * 0.7 }
  const openedControl2 = { x: 124 + strandRatio * 56, y: 438 + strandRatio * 18 }
  const closedEnd = { x: strand.anchor.x, y: strand.anchor.y + strand.length }
  const openedEnd = { x: 126 + strandRatio * 57, y: 565 + strandRatio * 44 + (strand.id % 4) * 7 }

  const start = {
    x: mix(closedStart.x, openedStart.x, topProgress) + wave * 0.05,
    y: mix(closedStart.y, openedStart.y, topProgress) + verticalWave * 0.03,
  }
  return {
    start,
    control1: {
      x: mix(closedControl1.x, openedControl1.x, shoulderProgress) + wave * 0.16,
      y: mix(closedControl1.y, openedControl1.y, shoulderProgress) + verticalWave * 0.08,
    },
    control2: {
      x: mix(closedControl2.x, openedControl2.x, bodyProgress) + wave * 0.45,
      y: mix(closedControl2.y, openedControl2.y, bodyProgress) + verticalWave * 0.22,
    },
    end: {
      x: mix(closedEnd.x, openedEnd.x, tailProgress) + wave,
      y: mix(closedEnd.y, openedEnd.y, tailProgress) + verticalWave,
    },
  }
}

export function curtainPathData(path: CurtainPath) {
  return `M ${path.start.x} ${path.start.y} C ${path.control1.x} ${path.control1.y}, ${path.control2.x} ${path.control2.y}, ${path.end.x} ${path.end.y}`
}
