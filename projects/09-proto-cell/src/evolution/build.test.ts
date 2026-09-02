import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { advanceBuildForm, applyEvolution, bodyStageAfterOffer, createBuildState, mutationMilestones, offerEvolution } from './build'

const allTraitIds = getContent().organelles.map((organ) => organ.id)

describe('behavior build offers', () => {
  it('offers exactly two mutation milestones per scale tier', () => {
    expect(mutationMilestones(getContent().scaleTiers)).toEqual([
      { tierIndex: 0, pressure: 0.35 }, { tierIndex: 0, pressure: 0.72 },
      { tierIndex: 1, pressure: 0.35 }, { tierIndex: 1, pressure: 0.72 },
      { tierIndex: 2, pressure: 0.35 }, { tierIndex: 2, pressure: 0.72 },
    ])
  })

  it('preserves installed traits across both form transitions', () => {
    const build = createBuildState({ traitIds: ['organelle-flagellum', 'organelle-shell-plate'] })
    expect(advanceBuildForm(advanceBuildForm(build, 'form-colony-body'), 'form-ciliate-composite').traitIds).toEqual(build.traitIds)
  })

  it('offers continuation, environment response, and cross-route risk', () => {
    const state = createBuildState({ routeCounts: { predation: 2, survival: 0, colony: 0 } })
    const offers = offerEvolution(state, {
      seed: 727,
      environmentId: 'env-acid-vesicle',
      stageIndex: 2,
      remainingEnvironmentIds: ['env-fiber-maze', 'env-abandoned-chamber'],
      unlockedTraitIds: allTraitIds,
      recentTraitIds: [],
    })

    expect(offers.map((offer) => offer.lane)).toEqual(['continuation', 'adaptation', 'risk'])
    expect(new Set(offers.map((offer) => offer.traitId)).size).toBe(3)
  })

  it('never offers a trait whose trigger cannot occur in the remaining journey', () => {
    const offers = offerEvolution(createBuildState(), {
      seed: 727,
      environmentId: 'env-abandoned-chamber',
      stageIndex: 5,
      remainingEnvironmentIds: ['env-abandoned-chamber'],
      unlockedTraitIds: allTraitIds,
      recentTraitIds: [],
    })

    expect(offers.every((offer) => offer.triggerAvailable)).toBe(true)
  })

  it('guarantees the first offer advances microbe to hunter', () => {
    const state = createBuildState({ bodyStage: 'microbe', evolutionCount: 0 })
    const offer = offerEvolution(state, {
      seed: 727,
      environmentId: 'env-clear-drop',
      stageIndex: 0,
      remainingEnvironmentIds: ['env-algae-glow'],
      unlockedTraitIds: allTraitIds,
      recentTraitIds: [],
    })[0]!

    expect(applyEvolution(state, offer).bodyStage).toBe('hunter')
  })

  it.each([[0, 'hunter'], [2, 'specialist'], [3, 'dominant'], [4, 'ascendant']] as const)(
    'maps the authored metamorph milestone %s to %s',
    (stageIndex, expected) => {
      expect(bodyStageAfterOffer(createBuildState(), { stageIndex, evolutionCount: stageIndex === 0 ? 0 : 4 })).toBe(expected)
    },
  )
})
