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

export function sampleCurtainPath(strand: CurtainStrand, windProgress: number, timeMs: number, gatherProgress = 0): CurtainPath {
  const delayed = clamp((windProgress - strand.delay) / Math.max(0.01, 1 - strand.delay))
  const gust = easeInOut(delayed)
  const gather = easeInOut(clamp(gatherProgress))
  const strandRatio = strand.id / 63
  const breath = Math.sin(timeMs / 760 + strand.phase) * 1.35
  const recoil = Math.sin(delayed * Math.PI * 2.4) * (1 - delayed) * 10
  const windStart = strand.anchor
  const gatheredStart = {
    x: 176 + strandRatio * 22,
    y: 114 + strandRatio * 5,
  }
  const start = {
    x: mix(windStart.x, gatheredStart.x, gather),
    y: mix(windStart.y, gatheredStart.y, gather),
  }
  const stillEnd = { x: windStart.x + breath, y: windStart.y + strand.length }
  const windPath = {
    control1: {
      x: windStart.x - gust * (16 + strand.response * 21),
      y: windStart.y + strand.length * 0.31 + gust * 8,
    },
    control2: {
      x: windStart.x - gust * (58 + strand.response * 56) + recoil * 0.35,
      y: windStart.y + strand.length * 0.7 + gust * (24 + strand.response * 18),
    },
    end: {
      x: stillEnd.x - gust * (105 + strand.response * 84) + recoil,
      y: stillEnd.y + gust * (42 + strand.response * 54),
    },
  }
  const gatheredWave = Math.sin(strand.phase + timeMs / 1050) * 5
  const gatheredPath = {
    control1: { x: 163 + strandRatio * 28, y: 255 + strandRatio * 14 },
    control2: { x: 124 + strandRatio * 56 + gatheredWave * 0.24, y: 438 + strandRatio * 18 },
    end: { x: 126 + strandRatio * 57 + gatheredWave * 0.6, y: 565 + strandRatio * 44 + (strand.id % 4) * 7 },
  }
  return {
    start,
    control1: {
      x: mix(windPath.control1.x, gatheredPath.control1.x, gather),
      y: mix(windPath.control1.y, gatheredPath.control1.y, gather),
    },
    control2: {
      x: mix(windPath.control2.x, gatheredPath.control2.x, gather),
      y: mix(windPath.control2.y, gatheredPath.control2.y, gather),
    },
    end: {
      x: mix(windPath.end.x, gatheredPath.end.x, gather),
      y: mix(windPath.end.y, gatheredPath.end.y, gather),
    },
  }
}

export function curtainPathData(path: CurtainPath) {
  return `M ${path.start.x} ${path.start.y} C ${path.control1.x} ${path.control1.y}, ${path.control2.x} ${path.control2.y}, ${path.end.x} ${path.end.y}`
}
