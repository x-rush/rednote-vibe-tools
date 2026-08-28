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
})
