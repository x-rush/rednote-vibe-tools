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
  readonly sparkle: number
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
  const travelScale = reducedMotion ? 0.3 : 0.52
  const rotationScale = reducedMotion ? 0.12 : 0.42

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
      y: 676,
    }
    if (local >= 1) {
      return {
        character, index, source, target, progress: 1,
        translateX: 0, translateY: 0, rotationDeg: 0, blurPx: 0, opacity: 1, sparkle: 0.16,
      }
    }

    const remaining = 1 - eased
    const direction = index % 2 === 0 ? 1 : -1
    const arc = Math.sin(eased * Math.PI)
    const focus = smoothstep(clamp((eased - 0.38) / 0.62))
    const drift = Math.sin(index * 1.73 + eased * Math.PI * 2.4)
    return {
      character,
      index,
      source,
      target,
      progress: eased,
      translateX: (source.x - target.x) * remaining + direction * arc * 5 * travelScale + drift * (1 - focus) * 2.4,
      translateY: (source.y - target.y) * remaining - arc * (10 + index % 3 * 3) * travelScale + drift * (1 - focus) * 1.8,
      rotationDeg: (direction * (2.4 + index % 3 * 0.8) * remaining + drift * (1 - focus) * 0.8) * rotationScale,
      blurPx: Math.max(0, 1.4 + 6.6 * (1 - focus)),
      opacity: Math.min(1, 0.04 + focus * 0.96),
      sparkle: clamp(0.18 + (1 - focus) * 0.72 + Math.sin(eased * Math.PI * 3 + index) * 0.08),
    }
  })
}
