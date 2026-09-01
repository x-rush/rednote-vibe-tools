import type { Point } from '../scene/geometry'

export interface LetterFlightSample {
  readonly character: string
  readonly index: number
  readonly source: Point
  readonly target: Point
  readonly progress: number
  readonly translateX: number
  readonly translateY: number
  readonly rotationDeg: number
  readonly blurPx: number
  readonly opacity: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (value: number) => value * value * (3 - 2 * value)

export function sampleLetterFlight(
  text: string,
  progress: number,
  reducedMotion: boolean,
): readonly LetterFlightSample[] {
  const characters = Array.from(text)
  const count = characters.length
  const overall = clamp(progress)
  const travelScale = reducedMotion ? 0.34 : 1
  const rotationScale = reducedMotion ? 0.18 : 1

  return characters.map((character, index) => {
    const source = {
      x: 232 + ((index * 37 + count * 11) % 102),
      y: 190 + ((index * 53 + count * 7) % 212),
    }
    const delay = (index / Math.max(1, count - 1)) * 0.24
    const local = clamp((overall - delay) / Math.max(0.01, 1 - delay))
    const eased = smoothstep(local)
    const target = {
      x: 195 + (index - (count - 1) / 2) * Math.min(23.5, 292 / Math.max(1, count)),
      y: 714,
    }
    if (local >= 1) {
      return {
        character, index, source, target, progress: 1,
        translateX: 0, translateY: 0, rotationDeg: 0, blurPx: 0, opacity: 1,
      }
    }

    const remaining = 1 - eased
    const direction = index % 2 === 0 ? 1 : -1
    const arc = Math.sin(eased * Math.PI)
    return {
      character,
      index,
      source,
      target,
      progress: eased,
      translateX: (source.x - target.x) * remaining + direction * arc * 22 * travelScale,
      translateY: (source.y - target.y) * remaining - arc * (24 + index % 3 * 7) * travelScale,
      rotationDeg: (direction * (18 + index % 5 * 7) * remaining + direction * arc * 9) * rotationScale,
      blurPx: Math.max(0, 8 * remaining),
      opacity: Math.min(1, 0.08 + eased * 0.92),
    }
  })
}
