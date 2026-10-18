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

    expect(profile.parts).toHaveLength(7)
    expect(profile.installedTraitCount).toBe(7)
  })

  it('retains the inherited organ alongside all six new mutations in every form', () => {
    const build = createBuildState({ traitIds: ['organelle-flagellum', 'organelle-jet-vacuole', 'organelle-shell-plate', 'organelle-eye-spot', 'organelle-wide-mouth', 'organelle-mucus-coat', 'organelle-electric-sac'] })
    for (const form of ['form-primal-cell', 'form-colony-body', 'form-ciliate-composite'] as const) {
      const profile = morphologyFor(form, build)
      expect(profile.parts).toContain('pursuit-tail')
      expect(profile.parts.filter((part) => part !== 'oral-groove')).toEqual(['pursuit-tail', 'jet-pod', 'shell-plates', 'light-eye', 'wide-maw', 'mucus-rim', 'arc-sacs'])
      expect(profile.parts).toContain('arc-sacs')
      if (form === 'form-ciliate-composite') expect(profile.parts).toContain('oral-groove')
    }
  })
})
