import { describe, expect, it } from 'vitest'
import { eventContext } from '../tests/fixtures'
import { startEvent, stepEvent } from './events'

describe('ecosystem events', () => {
  it('makes nutrient bloom attract non-player predators after a visible telegraph', () => {
    const world = startEvent('event-nutrient-bloom', eventContext())

    expect(world.spawnRequests.some((spawn) => spawn.role === 'resource')).toBe(true)
    expect(world.aiSignals).toContainEqual(expect.objectContaining({ type: 'attraction-field', audience: 'non-player' }))
    expect(world.telegraphs).toContainEqual(expect.objectContaining({ cueId: 'cue-warm-flow-lines' }))
    expect(stepEvent(world, world.activatesAtMs - 1).phase).toBe('telegraph')
    expect(stepEvent(world, world.activatesAtMs).phase).toBe('active')
  })

  it('selects the same one of three parameterized variants for the same seed', () => {
    const first = startEvent('event-nutrient-bloom', eventContext({ seed: 727 }))
    const second = startEvent('event-nutrient-bloom', eventContext({ seed: 727 }))

    expect(first.variantId).toBe(second.variantId)
    expect(first.variant).toEqual(second.variant)
  })

  it.each([
    ['event-nutrient-bloom', 'env-clear-drop', 'resource-attraction'],
    ['event-acid-leak', 'env-acid-vesicle', 'moving-safe-geometry'],
    ['event-antibody-sweep', 'env-antibody-storm', 'sweep-gap'],
    ['event-giant-passage', 'env-abandoned-chamber', 'visibility-current-shift'],
  ] as const)('%s changes the world through %s', (eventId, environmentId, effectType) => {
    const world = startEvent(eventId, eventContext({ environmentId }))

    expect(world.variant).toEqual(expect.objectContaining({ radius: expect.any(Number), resourceCount: expect.any(Number), attractionStrength: expect.any(Number), flow: expect.any(Number) }))
    expect(world.telegraphs.length).toBeGreaterThan(0)
    expect(world.worldEffects).toContainEqual(expect.objectContaining({ type: effectType }))
  })
})
