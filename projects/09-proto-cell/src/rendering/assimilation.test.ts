import { describe, expect, it } from 'vitest'
import { assimilationPresentation, behaviorCuePresentation } from './assimilation'

describe('actual engulf presentation', () => {
  it('carries the actual prey inward, shrinks it and expires completely', () => {
    const start = assimilationPresentation(0, false, false)!
    const middle = assimilationPresentation(260, false, false)!
    const end = assimilationPresentation(600, false, false)!
    expect(start.offsetScale).toBe(1)
    expect(start.preyScale).toBe(1)
    expect(middle.offsetScale).toBeLessThan(start.offsetScale)
    expect(end.offsetScale).toBeLessThan(middle.offsetScale)
    expect(end.preyScale).toBeLessThan(middle.preyScale)
    expect(end.alpha).toBeLessThan(middle.alpha)
    expect(assimilationPresentation(650, false, false)).toBeUndefined()
    expect(assimilationPresentation(-1, false, false)).toBeUndefined()
    expect(assimilationPresentation(Number.NaN, false, false)).toBeUndefined()
  })
  it('keeps the prey stationary and pulse quiet under accessibility preferences', () => {
    expect(assimilationPresentation(1000, false, false, 1500)).toBeDefined()
    expect(assimilationPresentation(1500, false, false, 1500)).toBeUndefined()
    expect(assimilationPresentation(100, true, true)!.offsetScale).toBe(1)
    expect(assimilationPresentation(400, true, true)!.preyScale).toBe(1)
    expect(assimilationPresentation(100, false, true)!.pulseAlpha).toBeLessThan(assimilationPresentation(100, false, false)!.pulseAlpha)
  })
  it('points attack tells toward actual movement and labels the recover window separately', () => {
    expect(behaviorCuePresentation({ behaviorState: 'telegraph', velocity: { x: 0, y: 20 } })).toMatchObject({ phase: 'prepare', heading: Math.PI / 2 })
    expect(behaviorCuePresentation({ behaviorState: 'pursue', velocity: { x: -20, y: 0 } })).toMatchObject({ phase: 'strike', heading: Math.PI })
    expect(behaviorCuePresentation({ behaviorState: 'recover', velocity: { x: 0, y: 0 } })).toMatchObject({ phase: 'recover' })
    expect(behaviorCuePresentation({ behaviorState: 'idle', velocity: { x: 0, y: 0 } })).toBeUndefined()
  })
})
