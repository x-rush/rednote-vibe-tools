import { describe, expect, it } from 'vitest'
import { getBehaviorProfile, type BehaviorProfileDefinition } from '../../content'
import { entity } from '../../tests/fixtures'
import { decideBehavior } from '../ai'
import type { BehaviorContext, BehaviorMemory } from './types'

function behaviorFixture(family: BehaviorProfileDefinition['family']): {
  entity: ReturnType<typeof entity> & { behaviorProfileId: `behavior-${string}` }
  memory: BehaviorMemory
  context: BehaviorContext
} {
  const self = { ...entity(`self-${family}`, 12), behaviorProfileId: `behavior-${family}` as `behavior-${string}` }
  const food = { ...entity('food', 4, { x: 24, y: 0 }), role: 'nutrient' as const }
  const peer = { ...entity('peer', 12, { x: 28, y: 0 }), behaviorProfileId: `behavior-${family}` as `behavior-${string}` }
  const threat = { ...entity('threat', 24, { x: 30, y: 0 }), role: 'predator' as const, faction: 'hostile' as const }
  const fragment = { ...entity('fragment', 5, { x: 20, y: 0 }), role: 'fragment' as const }
  const prey = { ...entity('prey', 7, { x: 34, y: 0 }), role: 'prey' as const }
  const nearbyByFamily = {
    resource: [],
    skittish: [threat],
    school: [peer],
    competitor: [food],
    ambusher: [],
    hunter: [prey],
    scavenger: [fragment],
    apex: [],
  }
  return {
    entity: self,
    memory: { state: 'idle', stateStartedAtMs: 0 },
    context: { atMs: 0, nearby: nearbyByFamily[family], profile: getBehaviorProfile(`behavior-${family}`) },
  }
}

describe('role-specific ecology behaviors', () => {
  it.each([
    ['skittish', 'flee'],
    ['school', 'regroup'],
    ['competitor', 'steal'],
    ['ambusher', 'hide'],
    ['hunter', 'pursue'],
    ['scavenger', 'harvest'],
    ['apex', 'patrol'],
  ] as const)('%s exposes its defining presentation state', (family, expected) => {
    const fixture = behaviorFixture(family)
    const result = decideBehavior(fixture.entity, fixture.memory, fixture.context)

    expect(result.decision.presentationState).toBe(expected)
  })

  it('hunter abandons a lost target instead of chasing forever', () => {
    const fixture = behaviorFixture('hunter')
    const result = decideBehavior(
      fixture.entity,
      { state: 'pursue', targetId: 'prey', stateStartedAtMs: 0 },
      { ...fixture.context, atMs: fixture.context.profile.abandonAfterMs + 1, nearby: [] },
    )

    expect(result.memory.state).toBe('search')
    expect(result.decision.targetId).toBeUndefined()
  })

  it('uses seeded identity wander rather than ambient randomness', () => {
    const fixture = behaviorFixture('apex')
    expect(decideBehavior(fixture.entity, fixture.memory, fixture.context)).toEqual(
      decideBehavior(fixture.entity, fixture.memory, fixture.context),
    )
  })
})
