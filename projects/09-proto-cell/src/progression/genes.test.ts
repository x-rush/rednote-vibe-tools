import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { awardGenes, environmentRewards, unlockNode, type GeneProgress } from './genes'
import { eventLog } from '../tests/fixtures'
import { deriveLifeArchive } from './archive'

const progress = (): GeneProgress => ({
  genePoints: 20,
  unlockedIds: ['origin-primal-cell', 'organelle-flagellum', 'organelle-repair-vacuole'],
  discoveredSynergyIds: [],
  completedModifierIds: [],
  rewardCounts: {},
})

describe('gene progression', () => {
  it('rewards every actual scale ecosystem without requiring legacy route events', () => {
    const content = getContent()
    const log = eventLog([
      { type: 'organ-triggered', entityId: 'player', organId: 'organelle-electric-sac', atMs: 0 },
      { type: 'form-transitioned', fromFormId: 'form-primal-cell', toFormId: 'form-colony-body', atMs: 100000 },
      { type: 'form-transitioned', fromFormId: 'form-colony-body', toFormId: 'form-ciliate-composite', atMs: 300000 },
    ])
    log.forEach((entry, index) => {
      entry.snapshot = { runSeed: 727, elapsedMs: entry.event.atMs, environmentId: content.scaleTiers[index]!.environmentId, biomass: 1000, organelleIds: [] }
    })
    const archive = deriveLifeArchive(log, content)
    const rewards = environmentRewards(progress(), archive.ecosystemIds ?? [])
    expect(rewards.map((reward) => reward.id)).toEqual(['env-clear-drop', 'env-fiber-maze', 'env-abandoned-chamber'])
    expect(awardGenes(progress(), rewards).awarded).toBe(9)
    expect(environmentRewards(progress(), ['env-fiber-maze', 'env-fiber-maze', 'env-invalid'])).toHaveLength(1)
  })
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
