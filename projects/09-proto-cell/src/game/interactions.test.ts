import { describe, expect, it } from 'vitest'
import { entity, testInteractionContext } from '../tests/fixtures'
import { resolveInteraction } from './interactions'

describe('entity interactions', () => {
  it('engulfs once when every prey contour point is inside', () => {
    const context = testInteractionContext()
    const predator = entity('large', 20)
    const prey = entity('small', 5)

    const result = resolveInteraction(predator, prey, context)
    const repeated = resolveInteraction(predator, prey, context)

    expect(result.events.filter((event) => event.type === 'engulfed')).toHaveLength(1)
    expect(result.massAfter).toBe(result.massBefore)
    expect(repeated.events.filter((event) => event.type === 'engulfed')).toHaveLength(0)
  })

  it('emits no damage for ordinary partial overlap', () => {
    const predator = entity('large', 20)
    const prey = entity('small', 5, { x: 18, y: 0 })

    const result = resolveInteraction(predator, prey, testInteractionContext())

    expect(result.events).toEqual([])
    expect(result.entities).toEqual([predator, prey])
  })

  it('ruptures only from configured damage and accounts for conversion loss', () => {
    const predator = entity('large', 20)
    const prey = { ...entity('small', 5, { x: 18, y: 0 }), mass: 10, membrane: 4 }
    const context = testInteractionContext({
      contactDamage: { source: 'spine', amount: 6, targetId: 'small' },
      ruptureLossFraction: 0.1,
    })

    const result = resolveInteraction(predator, prey, context)
    const retainedMass = result.fragments.reduce((sum, fragment) => sum + fragment.mass, 0)

    expect(result.events.map((event) => event.type)).toEqual(['damaged', 'ruptured'])
    expect(retainedMass).toBeCloseTo(9)
    expect(result.massAfter).toBeCloseTo(result.massBefore - 1)
  })
})
