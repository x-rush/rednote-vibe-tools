import { describe, expect, it } from 'vitest'
import { createBuildState } from '../evolution/build'
import { morphologyFor } from './morphology'

describe('build morphology', () => {
  it('gives primal, colony, and ciliate forms distinct skeletons', () => {
    const build = createBuildState()
    const primal = morphologyFor('form-primal-cell', build)
    const colony = morphologyFor('form-colony-body', build)
    const ciliate = morphologyFor('form-ciliate-composite', build)
    expect(new Set([primal.skeleton, colony.skeleton, ciliate.skeleton]).size).toBe(3)
    expect(colony.coreCount).toBeGreaterThan(1)
    expect(ciliate.parts).toContain('oral-groove')
  })

  it('changes silhouette and visible parts across body stages and routes', () => {
    const microbe = morphologyFor(createBuildState({ bodyStage: 'microbe' }))
    const predator = morphologyFor(createBuildState({
      bodyStage: 'specialist',
      traitIds: ['organelle-wide-mouth'],
      routeCounts: { predation: 3, survival: 0, colony: 0 },
    }))

    expect(predator.silhouette).not.toBe(microbe.silhouette)
    expect(predator.parts).toContain('wide-maw')
  })

  it('keeps every trait mechanical while capping visible detail', () => {
    const profile = morphologyFor(createBuildState({
      traitIds: ['organelle-flagellum', 'organelle-jet-vacuole', 'organelle-shell-plate', 'organelle-eye-spot', 'organelle-wide-mouth', 'organelle-mucus-coat', 'organelle-electric-sac'],
    }))

    expect(profile.parts).toHaveLength(6)
    expect(profile.installedTraitCount).toBe(7)
  })
})
