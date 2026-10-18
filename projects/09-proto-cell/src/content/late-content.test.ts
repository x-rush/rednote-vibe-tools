import { describe, expect, it } from 'vitest'
import { getContent, getBehaviorProfile } from './index'
import rawContent from './content.json'
import { validateContent } from './validate'
import { creatureEntityDefinition } from '../world/generator'
import { createEntity } from '../entities/factory'
import { decideBehavior } from '../entities/ai'
import { entity } from '../tests/fixtures'
describe('late ecology content', () => {
  it.each([
    ['predator-seam-lurker', 1, 'ambush'],
    ['predator-razor-ray', 2, 'pursue'],
  ] as const)('%s can threaten a juvenile, recover from its strike, and flee the mature form', (id, tierIndex, strike) => {
    const pack = getContent(), tier = pack.scaleTiers[tierIndex]!
    const creature = pack.creatures.find((item) => item.id === id)!
    const self = createEntity(creatureEntityDefinition(creature), { id: 'new-hunter', position: { x: 0, y: 0 } })
    const profile = getBehaviorProfile(creature.behaviorProfileId)
    const young = { ...entity('player', tier.radiusRange[0], { x: 100, y: 0 }), faction: 'player' as const, role: 'player' as const }
    const context = { atMs: 1200, nearby: [young], profile }
    const warning = decideBehavior(self, { state: id.includes('seam') ? 'hide' : 'search', stateStartedAtMs: 0 }, context)
    expect(warning.memory.state).toBe('telegraph')
    const attack = decideBehavior(self, warning.memory, { ...context, atMs: 1200 + profile.telegraphMs! })
    expect(attack.memory.state).toBe(strike)
    expect(decideBehavior(self, attack.memory, { ...context, atMs: 1200 + profile.telegraphMs! + profile.pursuitBurstMs! }).memory.state).toBe('recover')
    const adult = { ...young, ...entity('player', tier.radiusRange[1], young.position), faction: 'player' as const, role: 'player' as const }
    expect(decideBehavior(self, attack.memory, { ...context, nearby: [adult] }).memory.state).toBe('flee')
  })
  it('rejects an inverted armor window, missing behavior and unsafe moving walls', () => {
    const pack = structuredClone(rawContent)
    pack.lateEcology.leviathan.exposedRadius = 160
    pack.lateEcology.leviathan.profileId = 'behavior-missing'
    pack.lateEcology.chamberWalls[0]!.from[0] = 1.2
    expect(validateContent(pack).issues.length).toBeGreaterThanOrEqual(3)
  })
  it('passes content validation', () => expect(validateContent(rawContent).issues).toEqual([]))
  it.each(['creature-thornback-forager', 'predator-seam-lurker', 'creature-lantern-siphon', 'predator-razor-ray'])('actually spawns the new species %s with distinct anatomy and behavior', (id) => {
    const content = getContent()
    const creature = content.creatures.find((item) => item.id === id)
    expect(creature).toBeDefined()
    expect(content.spawnTables.some((table) => table.entries.some((entry) => entry.creatureId === id))).toBe(true)
    expect(content.visualRecipes.some((recipe) => recipe.id === creature?.visualRecipeId)).toBe(true)
    expect(content.behaviorProfiles.some((profile) => profile.id === creature?.behaviorProfileId)).toBe(true)
  })
})
