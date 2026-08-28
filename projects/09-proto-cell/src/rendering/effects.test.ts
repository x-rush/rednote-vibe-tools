import { describe, expect, it } from 'vitest'
import { createEntity } from '../entities/factory'
import * as effects from './effects'

const { dangerPulseState } = effects

describe('danger telegraph timing', () => {
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
