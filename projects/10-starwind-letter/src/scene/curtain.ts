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
  readonly nodes: readonly Point[]
  readonly start: Point
  readonly end: Point
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount
const smoothstep = (value: number) => value * value * (3 - 2 * value)

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

function curtainFollowProgress(openingProgress: number, depth: number, strandLag: number) {
  if (openingProgress <= 0) return 0
  if (openingProgress >= 1) return 1
  const delay = depth * 0.22 + strandLag * depth
  const duration = 0.22 + depth * 0.32
  const local = clamp((openingProgress - delay) / duration)
  const inverse = local - 1
  const rebound = 0.9 * depth ** 1.35
  return 1 + (rebound + 1) * inverse ** 3 + rebound * inverse ** 2
}

export function sampleCurtainPath(
  strand: CurtainStrand,
  openingProgress: number,
  timeMs: number,
  ambientStrength = 0,
  gustInput = 0,
  flowShift = 0,
): CurtainPath {
  const strandRatio = strand.id / 63
  const openedStart = { x: 160 + strandRatio * 42, y: 114 + strandRatio * 5 }
  const restingTailOffset = Math.sin(strand.phase * 1.7) * 4.5 + (strand.response - 0.97) * 4
  const openedEnd = {
    x: openedStart.x - 27 - strandRatio * 5 + restingTailOffset,
    y: 554
      + (strand.length - 306) * 0.52
      + Math.sin(strand.phase * 2.1) * 8
      + strandRatio * 6,
  }
  const edgeMobility = 0.12 + strandRatio ** 1.7 * 0.88
  const gustMobility = 0.48 + edgeMobility * 0.52
  const ambientMobility = 0.38 + strandRatio ** 1.4 * 0.62
  const strandLag = Math.max(0, strand.delay - strandRatio * 0.24) * 1.55
  const gustStrength = clamp(Math.abs(gustInput))
  const gustDelayMs = strandLag * 260 + (Math.sin(strand.phase * 1.31) + 1) * 22
  const gustAgeMs = timeMs - 190 - gustDelayMs
  const gustAttack = smoothstep(clamp(gustAgeMs / 230))
  const gustDecay = 1 - smoothstep(clamp((gustAgeMs - 480) / 690))
  const primaryImpulse = gustAttack * gustDecay
  const reboundAgeMs = Math.max(0, gustAgeMs - 610)
  const rebound = gustAgeMs > 610
    ? Math.exp(-reboundAgeMs / (1120 + strand.response * 180))
      * Math.sin(reboundAgeMs / (218 + (strand.id % 5) * 9) + 0.36)
      * 0.34
    : 0
  const gustResponse = (primaryImpulse + rebound) * gustStrength
  const horizontalResponse = gustResponse >= 0 ? gustResponse : gustResponse * 0.42
  const gustEnergy = Math.min(1, (primaryImpulse + Math.abs(rebound) * 1.35) * gustStrength)
  const nodes = Array.from({ length: 12 }, (_, index) => {
    const depth = index / 11
    const opening = curtainFollowProgress(openingProgress, depth, strandLag)
    const closed = {
      x: strand.anchor.x,
      y: strand.anchor.y + strand.length * depth,
    }
    const opened = {
      x: mix(openedStart.x, openedEnd.x, depth)
        + Math.sin(Math.PI * depth) * Math.sin(strand.phase * 0.9) * 3.5,
      y: mix(openedStart.y, openedEnd.y, depth) + Math.sin(Math.PI * depth) * 3,
    }
    const looseWeight = depth ** 1.62
    const windLift = Math.sin(Math.PI * depth) ** 0.8 * gustEnergy * 4.8
    const wakePhase = timeMs / (175 + (strand.id % 7) * 13)
      + strand.phase * 3.8
      - strand.delay * 10
      - depth * 5.2
    const wakeFlutter = Math.sin(wakePhase) * gustEnergy
      * (2.4 + depth * 8.2) * depth ** 1.42 * edgeMobility
    const wakeLift = Math.cos(wakePhase * 0.83 + depth) * gustEnergy
      * 4.6 * depth ** 1.3 * edgeMobility
    const unevenPressure = 0.82
      + Math.sin(strand.phase * 1.73 + depth * 1.2) * 0.13
      + Math.sin(strand.id * 1.91 - depth * 3.4) * 0.08
    const braidedWake = (
      Math.sin(strand.phase * 2.27 + depth * 4.6)
      + Math.sin(strand.id * 1.13 - depth * 7.1) * 0.48
    ) * gustEnergy * (3 + depth * 15) * gustMobility * depth ** 0.82
    const braidedLift = (
      Math.cos(strand.phase * 1.91 - depth * 3.7)
      + Math.sin(strand.id * 0.77 + depth * 5.3) * 0.42
    ) * gustEnergy * (2 + depth * 10) * gustMobility * depth ** 0.86
    const inertialSweep = -horizontalResponse * depth ** 0.94
      * (64 + depth * 190) * gustMobility * unevenPressure
    const inertialLift = gustResponse * depth ** 1.02
      * (42 + depth * 152) * gustMobility * (0.84 + Math.cos(strand.phase * 1.47) * 0.16)
    const slowPeriod = 780 + strand.response * 620 + (strand.id % 5) * 37
    const flutterPeriod = 330 + strand.delay * 640 + (strand.id % 7) * 19
    const travellingWave = (
      Math.sin(timeMs / slowPeriod + strand.phase - depth * 2.4) * (26 + strand.response * 6)
      + Math.sin(timeMs / flutterPeriod + strand.phase * 1.7 - depth * 5.8) * 8
    ) * ambientStrength * ambientMobility * depth ** 0.82
    const fineRipple = Math.sin(
      timeMs / 235 + strand.phase * 0.72 - depth * 6.4,
    ) * ambientStrength * 7.5 * depth ** 2 * ambientMobility
    const verticalRipple = Math.cos(
      timeMs / 690 + strand.phase - depth * 2.4,
    ) * ambientStrength * 12 * looseWeight * ambientMobility

    return {
      x: mix(closed.x, opened.x, opening)
        + travellingWave
        + fineRipple
        + wakeFlutter
        + braidedWake
        + inertialSweep
        + flowShift * looseWeight * (0.42 + ambientMobility * 0.58),
      y: mix(closed.y, opened.y, opening)
        + verticalRipple
        - inertialLift
        - windLift * (0.82 + strand.response * 0.15) * edgeMobility
        + wakeLift
        + braidedLift
        + Math.abs(flowShift) * 0.07 * looseWeight * ambientMobility,
    }
  })
  const start = nodes[0] ?? strand.anchor
  const end = nodes.at(-1) ?? start
  return {
    nodes,
    start,
    end,
  }
}

export function pointOnCurtainPath(path: CurtainPath, input: number): Point {
  const progress = clamp(input)
  const segmentProgress = progress * (path.nodes.length - 1)
  const segmentIndex = Math.min(path.nodes.length - 2, Math.floor(segmentProgress))
  const time = progress === 1 ? 1 : segmentProgress - segmentIndex
  const start = path.nodes[segmentIndex] ?? path.start
  const end = path.nodes[segmentIndex + 1] ?? path.end
  const before = path.nodes[segmentIndex - 1] ?? start
  const after = path.nodes[segmentIndex + 2] ?? end
  const control1 = {
    x: start.x + (end.x - before.x) / 6,
    y: start.y + (end.y - before.y) / 6,
  }
  const control2 = {
    x: end.x - (after.x - start.x) / 6,
    y: end.y - (after.y - start.y) / 6,
  }
  const inverse = 1 - time
  const cubic = (start: number, control1: number, control2: number, end: number) => (
    inverse ** 3 * start
    + 3 * inverse ** 2 * time * control1
    + 3 * inverse * time ** 2 * control2
    + time ** 3 * end
  )
  return {
    x: cubic(start.x, control1.x, control2.x, end.x),
    y: cubic(start.y, control1.y, control2.y, end.y),
  }
}

export function curtainPathData(path: CurtainPath) {
  const commands = path.nodes.slice(0, -1).map((start, index) => {
    const end = path.nodes[index + 1] ?? path.end
    const before = path.nodes[index - 1] ?? start
    const after = path.nodes[index + 2] ?? end
    const control1 = {
      x: start.x + (end.x - before.x) / 6,
      y: start.y + (end.y - before.y) / 6,
    }
    const control2 = {
      x: end.x - (after.x - start.x) / 6,
      y: end.y - (after.y - start.y) / 6,
    }
    return `C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`
  })
  return `M ${path.start.x} ${path.start.y} ${commands.join(' ')}`
}

export function curtainVeilPathData(left: CurtainPath, right: CurtainPath) {
  const rightEdge = right.nodes.slice(1).map(({ x, y }) => `L ${x} ${y}`)
  const leftEdge = left.nodes.slice(1).reverse().map(({ x, y }) => `L ${x} ${y}`)
  return `M ${left.start.x} ${left.start.y} L ${right.start.x} ${right.start.y} ${rightEdge.join(' ')} ${leftEdge.join(' ')} Z`
}
