import { describe, expect, it } from 'vitest'
import { createEntity } from '../entities/factory'
import * as effects from './effects'

const { collapsePresentation, dangerPulseState } = effects

describe('ecology collapse presentation', () => {
  it('compresses inward without flashing and stays harmless before the final quarter', () => {
    expect(collapsePresentation('active', 0, false)).toEqual({ edgeOpacity: 0, safeInsetRatio: 0, cueOpacity: 0 })
    expect(collapsePresentation('collapsing', 0.74, false).safeInsetRatio).toBe(0)
    expect(collapsePresentation('collapsing', 0.9, false)).toMatchObject({
      edgeOpacity: expect.any(Number),
      cueOpacity: expect.any(Number),
    })
    expect(collapsePresentation('collapsing', 0.9, false).safeInsetRatio).toBeGreaterThan(0)
    expect(collapsePresentation('collapsing', 0.9, true).cueOpacity).toBeLessThanOrEqual(0.5)
  })
})

describe('danger telegraph timing', () => {
  it('keeps the warning radius stationary with reduced flash', () => {
    const radii: number[] = []
    const context = new Proxy({}, { get: (_target, key) => key === 'arc' ? (_x: number, _y: number, radius: number) => radii.push(radius) : () => {}, set: () => true }) as CanvasRenderingContext2D
    const predator = createEntity({ id: 'hunter', role: 'predator', faction: 'hostile', radius: 20, mass: 400, membrane: 100, energy: 100, maxSpeed: 50, visualRecipeId: 'visual-test' }, { id: 'hunter', position: { x: 0, y: 0 } })
    predator.behaviorState = 'charge'
    effects.drawDangerTelegraph(context, predator, 0, 0, 20, 500, true)
    effects.drawDangerTelegraph(context, predator, 0, 0, 20, 570, true)
    expect(radii[0]).toBe(radii[1])
  })
  it('shows an arming telegraph before a newly spawned pulse becomes active', () => {
    const predator = createEntity({
      id: 'predator-test',
      role: 'predator',
      faction: 'hostile',
      radius: 20,
      mass: 400,
      membrane: 50,
      energy: 50,
      maxSpeed: 40,
      visualRecipeId: 'visual-predator-test',
      contactDamage: { source: 'spine', amount: 8, periodMs: 1600, activeMs: 240, phaseOffsetMs: 0 },
    }, { id: 'predator', position: { x: 0, y: 0 }, spawnedAtMs: 45_000 })

    expect(dangerPulseState(predator, 45_000)).toMatchObject({ telegraph: true, active: false })
    expect(dangerPulseState(predator, 45_419)).toMatchObject({ telegraph: true, active: false })
    expect(dangerPulseState(predator, 45_420)).toMatchObject({ telegraph: true, active: true })
  })
})

describe('ambient world particles', () => {
  it('moves camera-relative particles against the direction of travel', () => {
    expect('ambientParticlePosition' in effects).toBe(true)
    if (!('ambientParticlePosition' in effects)) return
    const position = effects.ambientParticlePosition(
      { x: 0.5, y: 0.5, radius: 2, phase: 0 },
      400,
      800,
      0,
      { x: 100, y: 40 },
      0.3,
    )

    expect(position).toEqual({ x: 170, y: 388 })
  })
})
