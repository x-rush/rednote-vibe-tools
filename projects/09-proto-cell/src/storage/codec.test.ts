import { describe, expect, it } from 'vitest'
import { saveFixture } from '../tests/fixtures'
import { decodeSave, encodeSave } from './codec'
import { getContent } from '../content'
import { createNursery, hatchLineage, leaveSeed, selectLineage } from '../progression/lineage'

describe('versioned save codec', () => {
  it('preserves the final cell family appearance through export and import without changing legacy archives', () => {
    const fixture = saveFixture()
    const visualRecipeId = getContent().lineage.archetypes[0]!.visualRecipeId
    Object.assign(fixture.lifeArchives[0]!, { finalVisualRecipeId: visualRecipeId })
    const restored = decodeSave(encodeSave(fixture))
    expect(restored.issues).toEqual([])
    expect(restored.value?.lifeArchives[0]).toMatchObject({ finalVisualRecipeId: visualRecipeId })
    expect(decodeSave(saveFixture()).value?.lifeArchives[0]).not.toHaveProperty('finalVisualRecipeId')
  })

  it('rejects unknown or non-cell archive visual recipes', () => {
    const nonCellRecipeId = getContent().visualRecipes.find((recipe) => recipe.kind !== 'cell')!.id
    for (const finalVisualRecipeId of ['visual-missing', nonCellRecipeId]) {
      const fixture = saveFixture()
      Object.assign(fixture.lifeArchives[0]!, { finalVisualRecipeId })
      expect(decodeSave(fixture)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ path: '$.lifeArchives[0].finalVisualRecipeId', code: 'unknown-id' })] })
    }
  })

  it('migrates legacy archives to bounded seed sources once and keeps the release version', () => {
    const fixture = saveFixture({ archiveCount: 30 })
    const migrated = decodeSave(fixture)
    expect(migrated.issues).toEqual([])
    expect(migrated.value?.nursery?.seeds).toHaveLength(12)
    expect(migrated.value?.nursery?.lineages).toEqual([])
    expect(migrated.value?.nursery?.seenArchiveKeys).toHaveLength(30)
    expect(migrated.value?.contentVersion).toBe(fixture.contentVersion)
    expect(decodeSave(encodeSave(migrated.value!)).value?.nursery).toEqual(migrated.value?.nursery)
  })

  it('preserves completed run ordinals beyond the archive cap through export and reload', () => {
    const fixture = saveFixture({ archiveCount: 35 })
    const migrated = decodeSave(fixture)
    expect(migrated.value?.nursery?.completedRuns).toBe(35)
    expect(migrated.value?.nursery?.seeds.at(-1)?.earnedAtRun).toBe(35)
    expect(migrated.value?.lifeArchives).toHaveLength(30)
    const reloaded = decodeSave(encodeSave(migrated.value!))
    expect(reloaded.value?.nursery?.completedRuns).toBe(35)
    const next = leaveSeed(reloaded.value!.nursery!, fixture.lifeArchives.at(-1)!, 36)
    expect(next.completedRuns).toBe(36)
    expect(next.seeds.at(-1)?.earnedAtRun).toBe(36)
    for (const completedRuns of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(decodeSave({ ...migrated.value, nursery: { ...migrated.value?.nursery, completedRuns } }).value).toBeUndefined()
  })

  it('exports and reloads selected offspring without losing consumed source state', () => {
    const fixture = saveFixture()
    const source = leaveSeed(createNursery(), fixture.lifeArchives[0]!, 1)
    const hatched = hatchLineage(source, { seedId: source.seeds[0]!.id, archetypeId: getContent().lineage.archetypes[0]!.id, name: '下一代' }, 2)
    fixture.nursery = selectLineage(hatched, hatched.lineages[0]!.id)
    const reloaded = decodeSave(encodeSave(fixture))
    expect(reloaded.issues).toEqual([])
    expect(reloaded.value?.nursery).toEqual(fixture.nursery)
    expect(() => hatchLineage(reloaded.value!.nursery!, { seedId: source.seeds[0]!.id, archetypeId: getContent().lineage.archetypes[0]!.id, name: '重复' }, 2)).toThrow()
  })

  it('rejects malformed nursery identifiers, generations, inheritance, missing references and oversized collections', () => {
    const base = saveFixture()
    const seeded = leaveSeed(createNursery(), base.lifeArchives[0]!, 1)
    const hatched = hatchLineage(seeded, { seedId: seeded.seeds[0]!.id, archetypeId: getContent().lineage.archetypes[0]!.id, name: '后代' }, 2)
    const cases = [
      { ...hatched, selectedLineageId: 'lineage-missing' },
      { ...hatched, lineages: [{ ...hatched.lineages[0], generation: Number.MAX_SAFE_INTEGER + 1 }] },
      { ...hatched, lineages: [{ ...hatched.lineages[0], archetypeId: 'lineage-missing' }] },
      { ...hatched, lineages: [{ ...hatched.lineages[0], seedId: 'seed-missing' }] },
      { ...hatched, lineages: [{ ...hatched.lineages[0], inheritedOrganelleId: 'organelle-guard-symbiont' }] },
      { ...hatched, seeds: Array.from({ length: 13 }, () => seeded.seeds[0]) },
    ]
    for (const nursery of cases) {
      expect(decodeSave({ ...base, nursery })).toMatchObject({ value: undefined, issues: expect.arrayContaining([expect.objectContaining({ path: expect.stringContaining('$.nursery') })]) })
    }
  })

  it.each([
    ['microbe', 'form-primal-cell'],
    ['hunter', 'form-primal-cell'],
    ['specialist', 'form-colony-body'],
    ['dominant', 'form-colony-body'],
    ['ascendant', 'form-ciliate-composite'],
  ] as const)('maps legacy stage %s conservatively to %s', (stage, formId) => {
    const fixture = saveFixture()
    fixture.lifeArchives[0]!.finalBodyStage = stage
    delete (fixture.lifeArchives[0] as Partial<typeof fixture.lifeArchives[0]>).finalFormId
    expect(decodeSave(fixture).value?.lifeArchives[0]?.finalFormId).toBe(formId)
  })

  it('drops unknown fields and caps archives at thirty', () => {
    const save = saveFixture({ extra: 'blocked', archiveCount: 35 })
    const decoded = decodeSave(save)

    expect(decoded.issues).toEqual([])
    expect(decoded.value && 'extra' in decoded.value).toBe(false)
    expect(decoded.value?.lifeArchives).toHaveLength(30)
    expect(decoded.value?.lifeArchives[0]?.dishCode).toBe(save.lifeArchives[5]?.dishCode)
  })

  it('rejects unknown content ids and media-shaped strings with structured issues', () => {
    const unknown = saveFixture()
    unknown.progression.unlockedIds = ['organelle-missing']
    const media = saveFixture()
    ;(media as Record<string, unknown>).extra = ' \n data:image/png;base64,AAAA'
    const mediaKey = saveFixture()
    mediaKey.codex = { ' blob:unsafe-media': 'seen' }

    expect(decodeSave(unknown)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ path: '$.progression.unlockedIds[0]' })] })
    expect(decodeSave(media)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ message: expect.stringContaining('media') })] })
    expect(decodeSave(mediaKey)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ code: 'media-not-allowed' })] })
    expect(decodeSave({ payload: `${'A'.repeat(1024)}\n${'A'.repeat(1024)}` })).toMatchObject({ value: undefined, issues: [expect.objectContaining({ code: 'media-not-allowed' })] })
  })

  it('round-trips only the whitelisted structured save shape', () => {
    const fixture = saveFixture()
    fixture.progression.rewardCounts['environment:env-clear-drop'] = 900
    fixture.lifeArchives[0]!.finalMorphology = {
      bodyCount: 1,
      totalMass: 144,
      radius: 12,
      stability: 82,
      organelles: [{ id: 'organelle-guard-symbiont', stage: 'mature', anchor: 'symbiont', charges: 2 }],
    }
    const decoded = decodeSave(encodeSave(fixture))

    expect(decoded.issues).toEqual([])
    expect(decoded.value).toEqual(decodeSave(fixture).value)
    expect(decoded.value?.lifeArchives[0]?.finalMorphology?.organelles[0]?.charges).toBe(2)
    expect(decoded.value?.progression.rewardCounts['environment:env-clear-drop']).toBe(900)
  })

  it('migrates a v1 archive without inventing a completed body stage', () => {
    const fixture = saveFixture()
    delete (fixture.lifeArchives[0] as Partial<typeof fixture.lifeArchives[0]>).finalBodyStage
    delete (fixture.lifeArchives[0] as Partial<typeof fixture.lifeArchives[0]>).buildRouteCounts
    delete (fixture.lifeArchives[0] as Partial<typeof fixture.lifeArchives[0]>).journeyStageIndex

    const migrated = decodeSave(fixture)

    expect(migrated.value?.lifeArchives[0]?.finalBodyStage).toBe('microbe')
    expect(migrated.value?.lifeArchives[0]?.buildRouteCounts).toEqual({ predation: 0, survival: 0, colony: 0 })
    expect(migrated.issues).toEqual([])
  })

  it('rejects unknown or invalid reward counters', () => {
    const unknown = saveFixture()
    unknown.progression.rewardCounts['environment:env-missing'] = 1
    const fractional = saveFixture()
    fractional.progression.rewardCounts['environment:env-clear-drop'] = 1.5

    expect(decodeSave(unknown)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ code: 'unknown-id' })] })
    expect(decodeSave(fractional)).toMatchObject({ value: undefined, issues: [expect.objectContaining({ code: 'invalid-number' })] })
  })

  it('fails closed on malformed or oversized JSON without raw parser errors', () => {
    expect(decodeSave('{oops').issues[0]).toMatchObject({ path: '$', code: 'invalid-json' })
    expect(decodeSave(JSON.stringify({ payload: 'x'.repeat(1024 * 1024) })).issues[0]).toMatchObject({ code: 'too-large' })
    expect(decodeSave({ payload: '!'.repeat(1024 * 1024) }).issues[0]).toMatchObject({ code: 'too-large' })
  })
})
