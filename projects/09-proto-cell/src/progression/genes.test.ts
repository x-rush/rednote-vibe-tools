import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { awardGenes, unlockNode, type GeneProgress } from './genes'

const progress = (): GeneProgress => ({
  genePoints: 20,
  unlockedIds: ['origin-primal-cell', 'organelle-flagellum', 'organelle-repair-vacuole'],
  discoveredSynergyIds: [],
  completedModifierIds: [],
  rewardCounts: {},
})

describe('gene progression', () => {
  it('unlocks possibilities without permanent mass growth', () => {
    const next = unlockNode(progress(), 'gene-origin-ciliate')
    expect(next.unlockedIds).toContain('origin-ciliate-seed')
    expect(next.genePoints).toBe(12)
    expect('permanentMassMultiplier' in next).toBe(false)
  })

  it('rejects locked prerequisites and preserves the input', () => {
    const input: GeneProgress = { ...progress(), unlockedIds: [] }
    expect(() => unlockNode(input, 'gene-origin-ciliate')).toThrow(/prerequisite/i)
    expect(input.genePoints).toBe(20)
  })

  it('keeps repeat rewards non-zero but diminishing', () => {
    const first = awardGenes(progress(), [{ kind: 'environment', id: 'env-acid-vesicle', first: true }])
    const repeat = awardGenes(first, [{ kind: 'environment', id: 'env-acid-vesicle', first: false, repeats: 4 }])
    expect(first.awarded).toBeGreaterThan(repeat.awarded)
    expect(repeat.awarded).toBeGreaterThan(0)
    expect(repeat.rewardCounts['environment:env-acid-vesicle']).toBe(2)
    expect(getContent().geneNodes.length).toBeGreaterThan(0)
  })
})
