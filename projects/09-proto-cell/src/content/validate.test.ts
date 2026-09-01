import { describe, expect, it } from 'vitest'
import { contentFixture } from '../tests/fixtures'
import { validateContent } from './validate'

describe('content integrity validation', () => {
  it('rejects missing organ visuals and dangling synergy requirements', () => {
    const pack = contentFixture()
    pack.organelles[0].visualMutationId = ''
    pack.synergies[0].requires = ['organelle-missing']

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.organelles[0].visualMutationId',
      '$.synergies[0].requires[0]',
    ]))
  })

  it('rejects duplicate ids and a boss without a non-combat resolution', () => {
    const pack = contentFixture()
    pack.organelles[1].id = pack.organelles[0].id
    pack.bosses[0].resolutionPaths = ['combat']

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.organelles[1].id',
      '$.bosses[0].resolutionPaths',
    ]))
  })

  it('rejects an illegal organ anchor from external JSON', () => {
    const pack = contentFixture()
    pack.organelles[0].slots = ['face' as never]

    expect(validateContent(pack).issues.map((issue) => issue.path)).toContain('$.organelles[0].slots[0]')
  })

  it('does not allow a published organ id to change category', () => {
    const pack = contentFixture()
    pack.organelles[0].category = 'attack'

    expect(validateContent(pack).issues.map((issue) => issue.path)).toContain('$.organelles[0].category')
  })

  it('fails closed on missing metadata, event cues, invalid boss paths, and dangling M0 spawns', () => {
    const pack = contentFixture()
    delete (pack.meta as Partial<typeof pack.meta>).title
    pack.events[0].telegraphIds = []
    pack.bosses[0].resolutionPaths = ['combat', 'bogus' as never]
    pack.m0.environments[0].spawnSchedule[0].definitionId = 'creature-missing'

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.meta.title',
      '$.events[0].telegraphIds',
      '$.bosses[0].resolutionPaths[1]',
      '$.m0.environments[0].spawnSchedule[0].definitionId',
    ]))
  })

  it('rejects player spawns, malformed versions, missing required UI, and invalid environment fields', () => {
    const pack = contentFixture()
    pack.m0.environments[0].spawnSchedule[0].definitionId = 'origin-primal-cell'
    pack.contentVersion = '1.2.3 garbage'
    delete (pack.ui.actions as Partial<typeof pack.ui.actions>).start
    pack.environments[0].order = 'first' as never

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.m0.environments[0].spawnSchedule[0].definitionId',
      '$.contentVersion',
      '$.ui.actions.start',
      '$.environments[0].order',
    ]))
  })

  it('rejects incomplete M0, spawn, boss, visual, and ending records', () => {
    const pack = contentFixture()
    pack.m0.environments[0].width = 'wide' as never
    pack.m0.environments[0].playerDefinition.role = 'boss'
    delete (pack.spawnTables[0].entries[0] as Partial<typeof pack.spawnTables[0]['entries'][0]>).weight
    pack.bosses[0].phases[0].id = ''
    delete (pack.visualRecipes[0] as Partial<typeof pack.visualRecipes[0]>).kind
    delete (pack.endings[0] as Partial<typeof pack.endings[0]>).conditionId

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.m0.environments[0].width',
      '$.m0.environments[0].playerDefinition.role',
      '$.spawnTables[0].entries[0].weight',
      '$.bosses[0].phases',
      '$.visualRecipes[0].kind',
      '$.endings[0].conditionId',
    ]))
  })

  it('requires visual, origin entity, and gene prerequisite references to match their target type', () => {
    const pack = contentFixture()
    pack.nutrients[0].visualRecipeId = 'visual-boss-membrane-queen'
    pack.origins[0].entityDefinitionId = 'predator-azure-ring'
    pack.geneNodes[0].requires = ['boss-membrane-queen']
    pack.geneNodes[0].unlockIds = ['boss-membrane-queen']

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.nutrients[0].visualRecipeId',
      '$.origins[0].entityDefinitionId',
      '$.geneNodes[0].requires[0]',
      '$.geneNodes[0].unlockIds[0]',
    ]))
  })

  it('accepts the complete M1 content pack', () => {
    expect(validateContent(contentFixture()).issues).toEqual([])
  })

  it('rejects an invalid ecology replenishment budget', () => {
    const pack = contentFixture()
    pack.m1.ecologyReplenishment.targetFoodCount = 0
    pack.m1.ecologyReplenishment.localFoodTarget = 0

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.m1.ecologyReplenishment.targetFoodCount',
      '$.m1.ecologyReplenishment.localFoodTarget',
    ]))
  })

  it('rejects incomplete event parameters, boss rules, and M1 route pacing', () => {
    const pack = contentFixture()
    pack.events[0].variants = []
    pack.bosses[0].rules.hazardHoldMs = -1
    pack.m1.routeRifts = []

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.events[0].variants',
      '$.bosses[0].rules.hazardHoldMs',
      '$.m1.routeRifts',
    ]))
  })

  it('rejects duplicate event variants and reordered validation boss phases', () => {
    const pack = contentFixture()
    pack.events[0].variantIds[2] = pack.events[0].variantIds[1]
    pack.bosses[0].phases.reverse()

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.events[0].variantIds',
      '$.events[0].variants',
      '$.bosses[0].phases',
    ]))
  })

  it('rejects a route whose destination environment is undeclared', () => {
    const pack = contentFixture()
    pack.m1.routeRifts[0].destinationEnvironmentId = 'env-missing'

    expect(validateContent(pack).issues.map((issue) => issue.path)).toContain('$.m1.routeRifts[0].destinationEnvironmentId')
  })

  it('requires the stable ending threshold to be explicit', () => {
    const pack = contentFixture()
    delete pack.endings[0].minimumStability

    expect(validateContent(pack).issues.map((issue) => issue.path)).toContain('$.endings[0].minimumStability')
  })

  it('rejects an organ with no synergy and an environment using another region spawn table', () => {
    const pack = contentFixture()
    const orphanId = pack.organelles[0].id
    for (const synergy of pack.synergies) {
      synergy.requires = synergy.requires.filter((id) => id !== orphanId)
      synergy.augments = synergy.augments?.filter((augment) => augment.organId !== orphanId)
      synergy.excludes = synergy.excludes?.filter((id) => id !== orphanId)
    }
    pack.environments[0].spawnTableId = 'spawn-algae-glow'
    pack.spawnTables[1].entries[0].creatureId = 'creature-vesicle-scavenger'

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.organelles[0]',
      '$.environments[0].spawnTableId',
      '$.spawnTables[1].entries[0].creatureId',
    ]))
  })

  it('rejects a creature warning that names only a color', () => {
    const pack = contentFixture()
    pack.creatures[0].warningCueId = 'cue-red'

    expect(validateContent(pack).issues.map((issue) => issue.path)).toContain('$.creatures[0].warningCueId')
  })

  it('requires six ordered journey stages with collapse and two route offers before the finale', () => {
    const pack = contentFixture()
    pack.journey.stages = pack.journey.stages.slice(0, 5)
    expect(validateContent(pack).issues.map((issue) => issue.path)).toContain('$.journey.stages')

    pack.journey.stages = contentFixture().journey.stages
    pack.journey.stages[1]!.routeOffers = []
    expect(validateContent(pack).issues.map((issue) => issue.path)).toContain('$.journey.stages[1].routeOffers')
  })

  it('rejects behavior profiles without a state, movement pattern, and exploitable weakness', () => {
    const pack = contentFixture()
    pack.behaviorProfiles[0]!.weaknessId = ''

    expect(validateContent(pack).issues.map((issue) => issue.path)).toContain('$.behaviorProfiles[0].weaknessId')
  })

  it('requires every evolution to declare a route, trigger, morphology, and visible cost', () => {
    const pack = contentFixture()
    delete (pack.organelles[0] as Partial<typeof pack.organelles[0]>).evolutionRoute
    ;(pack.organelles[1] as typeof pack.organelles[1]).evolutionTriggerId = '' as never
    ;(pack.organelles[2] as typeof pack.organelles[2]).morphologyPartId = ''
    ;(pack.organelles[3] as typeof pack.organelles[3]).costText = ''

    expect(validateContent(pack).issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      '$.organelles[0].evolutionRoute',
      '$.organelles[1].evolutionTriggerId',
      '$.organelles[2].morphologyPartId',
      '$.organelles[3].costText',
    ]))
  })
})
