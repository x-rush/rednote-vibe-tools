import { describe, expect, it } from 'vitest'
import type { OrganelleId } from '../content'
import { createBuildState } from './build'
import { evaluateTriggers, type TriggerFrame } from './triggers'

const triggerBuild = (organId: OrganelleId) => createBuildState({ traitIds: [organId] })
const triggerFrame = (overrides: Partial<TriggerFrame>): TriggerFrame => ({
  atMs: 5000,
  elapsedMs: 1000 / 60,
  movement: { speed: 0, directionHeldMs: 0, pursuitMs: 0, closingSpeed: 0 },
  environmentId: 'env-clear-drop',
  ...overrides,
})

describe('movement-driven evolution triggers', () => {
  it('triggers pursuit burst after two seconds of closing distance', () => {
    const outcome = evaluateTriggers(triggerBuild('organelle-flagellum'), triggerFrame({
      movement: { speed: 64, directionHeldMs: 2000, pursuitMs: 2000, closingSpeed: 32 },
    }))

    expect(outcome).toContainEqual(expect.objectContaining({ effectId: 'pursuit-burst', durationMs: 900 }))
  })

  it('triggers near-miss camouflage without a button press', () => {
    const outcome = evaluateTriggers(triggerBuild('organelle-transparent-membrane'), triggerFrame({
      nearMiss: { threatId: 'hunter', clearance: 4 },
    }))

    expect(outcome).toContainEqual(expect.objectContaining({ effectId: 'near-miss-camouflage' }))
  })

  it('opens a vortex after three engulfs inside the chain window', () => {
    const outcome = evaluateTriggers(triggerBuild('organelle-wide-mouth'), triggerFrame({
      engulf: { preyId: 'prey', chain: 3, approach: 'front' },
    }))

    expect(outcome).toContainEqual(expect.objectContaining({ effectId: 'engulf-vortex' }))
  })
})
