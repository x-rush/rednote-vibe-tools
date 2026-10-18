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
  const self = { ...entity(`self-${family}`, 12), faction: 'hostile' as const, behaviorProfileId: `behavior-${family}` as `behavior-${string}` }
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
  it.each(['behavior-hunter', 'behavior-ambusher', 'behavior-apex', 'behavior-leviathan'] as const)('%s has identical decisions without same-faction perception noise', (profileId) => {
    const self = { ...entity('hunter', 60), faction: 'hostile' as const, role: 'predator' as const }
    const young = { ...entity('player', 30, { x: 70, y: 0 }), faction: 'player' as const, role: 'player' as const }
    const adult = { ...entity('player', 100, { x: 70, y: 0 }), faction: 'player' as const, role: 'player' as const }
    const peers = Array.from({ length: 60 }, (_, index) => ({ ...entity(`peer-${index}`, 80, { x: index, y: 0 }), faction: 'hostile' as const, role: 'predator' as const }))
    const prey = { ...entity('prey', 15, { x: 50, y: 0 }), faction: 'neutral' as const, role: 'prey' as const }
    const profile = getBehaviorProfile(profileId)
    for (const player of [young, adult]) for (const state of ['hide', 'patrol', 'telegraph', 'charge', 'pursue', 'ambush', 'recover'] as const) {
      const memory = { state, stateStartedAtMs: 0, targetId: player.id, burstDirection: { x: 1, y: 0 } }
      const context = { atMs: 1400, profile, nearby: [peers[0]!, player, ...peers.slice(1), prey] }
      expect(decideBehavior(self, memory, context)).toEqual(decideBehavior(self, memory, { ...context, nearby: [player, prey] }))
    }
  })
  it('lets the terminal giant commit a charge against a mature player and then expose itself', () => {
    const self = { ...entity('encounter-2', 147), faction: 'hostile' as const, role: 'predator' as const }
    const player = { ...entity('player', 176, { x: 300, y: 0 }), faction: 'player' as const, role: 'player' as const }
    const context = { atMs: 1200, nearby: [player], profile: getBehaviorProfile('behavior-leviathan') }
    const warning = decideBehavior(self, { state: 'patrol', stateStartedAtMs: 0 }, context)
    expect(warning.memory.state).toBe('telegraph')
    const charge = decideBehavior(self, warning.memory, { ...context, atMs: 2100 })
    expect(charge.memory.state).toBe('charge')
    const exposed = decideBehavior(self, charge.memory, { ...context, atMs: 3200 })
    expect(exposed.memory.state).toBe('recover')
    expect(decideBehavior(self, exposed.memory, { ...context, atMs: 6300 }).memory.state).toBe('recover')
  })
  it.each(['hunter', 'ambusher', 'apex'] as const)('%s hunts by physical size even when the prey carries more lifetime biomass', (family) => {
    const self = { ...entity('hunter', 24), faction: 'hostile' as const, role: 'predator' as const }
    const player = { ...entity('player', 12, { x: 30, y: 0 }), faction: 'player' as const, role: 'player' as const, mass: 10000 }
    const result = decideBehavior(self, { state: family === 'ambusher' ? 'hide' : 'patrol', stateStartedAtMs: 0 }, {
      atMs: 1200,
      nearby: [player],
      profile: getBehaviorProfile(`behavior-${family}`),
    })
    expect(result.decision.targetId).toBe('player')
    expect(result.decision.movement.direction.x).toBeGreaterThan(0)
  })
  it.each([
    ['skittish', 'flee'],
    ['school', 'regroup'],
    ['competitor', 'steal'],
    ['ambusher', 'hide'],
    ['hunter', 'telegraph'],
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

  it('forces a hunter into recovery even while its prey remains nearby', () => {
    const fixture = behaviorFixture('hunter')
    const profile = Object.assign({}, fixture.context.profile, {
      pursuitBurstMs: 1200,
      recoveryMs: 800,
      turnResponseMs: 460,
    })
    const result = decideBehavior(
      fixture.entity,
      { state: 'pursue', targetId: 'prey', stateStartedAtMs: 0 },
      { ...fixture.context, atMs: 1201, profile },
    )

    expect(result.memory.state).toBe('recover')
    expect(result.decision.movement.strength).toBeLessThan(0.3)
  })

  it.each(['hunter', 'ambusher', 'apex'] as const)('%s warns, commits its burst direction, and recovers before attacking again', (family) => {
    const self = { ...entity('hunter', 24), faction: 'hostile' as const, role: 'predator' as const }
    const prey = { ...entity('player', 12, { x: 50, y: 0 }), faction: 'player' as const, role: 'player' as const }
    const profile = { ...getBehaviorProfile(`behavior-${family}`), telegraphMs: 400, pursuitBurstMs: 600, recoveryMs: 800 }
    const decide = (memory: BehaviorMemory, atMs: number) => decideBehavior(self, memory, { atMs, nearby: [prey], profile })
    const warning = decide({ state: family === 'ambusher' ? 'hide' : 'patrol', stateStartedAtMs: 0 }, 1200)
    expect(warning.decision.presentationState).toBe('telegraph')
    expect(warning.decision.movement.strength).toBeLessThan(0.3)
    const burst = decide(warning.memory, 1600)
    expect(burst.decision.presentationState).toBe(family === 'hunter' ? 'pursue' : family === 'ambusher' ? 'ambush' : 'charge')
    expect(burst.decision.movement.direction).toEqual({ x: 1, y: 0 })
    // A sideways dodge after the tell must evade the committed heading.
    prey.position = { x: 0, y: 50 }
    const dodged = decide(burst.memory, 1800)
    expect(dodged.decision.movement.direction).toEqual({ x: 1, y: 0 })
    const recovering = decide(dodged.memory, 2200)
    expect(recovering.decision.presentationState).toBe('recover')
    expect(recovering.decision.movement.strength).toBeLessThan(0.3)
    expect(decide(recovering.memory, 2999).decision.presentationState).toBe('recover')
    expect(decide(recovering.memory, 3000).decision.presentationState).toBe(family === 'ambusher' ? 'hide' : 'telegraph')
  })

  it('drops a locked hostile ally instead of pursuing it through recovery', () => {
    const self = { ...entity('hunter', 24), faction: 'hostile' as const, role: 'predator' as const }
    const ally = { ...entity('ally', 12, { x: 40, y: 0 }), faction: 'hostile' as const, role: 'predator' as const }
    const decision = decideBehavior(self, { state: 'pursue', targetId: ally.id, stateStartedAtMs: 0 }, {
      atMs: 50, nearby: [ally], profile: getBehaviorProfile('behavior-hunter'),
    })
    expect(decision.decision.targetId).toBeUndefined()
    expect(decision.decision.presentationState).toBe('search')
  })

  it.each(['hunter', 'ambusher', 'apex'] as const)('%s flees a physically larger player even during a committed burst', (family) => {
    const self = { ...entity('old-enemy', 20), faction: 'hostile' as const, role: 'predator' as const }
    const player = { ...entity('player', 32, { x: 30, y: 0 }), faction: 'player' as const, role: 'player' as const, mass: 1 }
    const decision = decideBehavior(self, { state: 'pursue', targetId: player.id, stateStartedAtMs: 0 }, {
      atMs: 100, nearby: [player], profile: getBehaviorProfile(`behavior-${family}`),
    })
    expect(decision.decision.presentationState).toBe('flee')
    expect(decision.decision.movement.direction.x).toBeLessThan(0)
  })
  it('uses seeded identity wander rather than ambient randomness', () => {
    const fixture = behaviorFixture('apex')
    expect(decideBehavior(fixture.entity, fixture.memory, fixture.context)).toEqual(
      decideBehavior(fixture.entity, fixture.memory, fixture.context),
    )
  })
})
