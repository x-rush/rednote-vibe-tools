import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { saveFixture } from '../tests/fixtures'
import { createNursery, hatchLineage, leaveSeed, lineageBuild, lineageLaunch, retireLineage, selectLineage } from './lineage'

const archive = () => saveFixture().lifeArchives[0]!

describe('seed and offspring progression', () => {
  it('leaves a usable first-generation source even after an early failed life and deduplicates repeated results', () => {
    const empty = createNursery()
    const seeded = leaveSeed(empty, archive(), 1)
    expect(empty.seeds).toHaveLength(0)
    expect(seeded.seeds).toHaveLength(1)
    expect(seeded.seeds[0]).toMatchObject({ generation: 1, organelleIds: [], sourceFormId: 'form-primal-cell', earnedAtRun: 1 })
    expect(leaveSeed(seeded, structuredClone(archive()), 1)).toEqual(seeded)
  })

  it('hatches once, trims names by codepoint, and launches one inherited source gene only', () => {
    const archetype = getContent().lineage.archetypes[0]!
    const organId = archetype.inheritancePool[0]!
    const source = archive()
    source.keyOrganelleIds = [organId]
    const seeded = leaveSeed(createNursery(), source, 1)
    const seedId = seeded.seeds[0]!.id
    const hatched = hatchLineage(seeded, { seedId, archetypeId: archetype.id, inheritedOrganelleId: organId, name: `  ${'🧬'.repeat(20)}  ` }, 2)
    expect(Array.from(hatched.lineages[0]!.name)).toHaveLength(16)
    expect(hatched.hatchedSeedIds).toEqual([seedId])
    expect(() => hatchLineage(hatched, { seedId, archetypeId: archetype.id, name: '再次孵化' }, 2)).toThrow()
    expect(lineageBuild(hatched.lineages[0]!)).toMatchObject({ bodyStage: 'microbe', evolutionCount: 0, traitIds: [organId], synergyIds: [] })
    expect(lineageLaunch(hatched.lineages[0]!)).toEqual({ originId: archetype.originId, inheritedOrganelleIds: [organId], lineageArchetypeId: archetype.id })
  })

  it('rejects foreign inheritance, unknown sources, unsafe counters and media names without consuming a source', () => {
    const seeded = leaveSeed(createNursery(), archive(), 1)
    const options = { seedId: seeded.seeds[0]!.id, archetypeId: getContent().lineage.archetypes[0]!.id, name: '后代' }
    expect(() => hatchLineage(seeded, { ...options, inheritedOrganelleId: 'organelle-guard-symbiont' }, 2)).toThrow()
    expect(() => hatchLineage(seeded, { ...options, seedId: 'seed-missing' }, 2)).toThrow()
    expect(() => hatchLineage(seeded, { ...options, name: 'data:image/png;base64,AAAA' }, 2)).toThrow()
    expect(() => hatchLineage(seeded, options, Infinity)).toThrow()
    expect(() => leaveSeed(seeded, archive(), 1.5)).toThrow()
    expect(seeded.hatchedSeedIds).toEqual([])
  })

  it('advances generations from the actual parent and falls back to the default after retirement', () => {
    const seeded = leaveSeed(createNursery(), archive(), 1)
    const first = hatchLineage(seeded, { seedId: seeded.seeds[0]!.id, archetypeId: getContent().lineage.archetypes[0]!.id, name: '一代' }, 2)
    const parent = first.lineages[0]!
    const nextArchive = { ...archive(), survivalMs: 9000 }
    const second = leaveSeed(first, nextArchive, 3, parent.id)
    expect(second.seeds[1]).toMatchObject({ generation: 2, parentLineageId: parent.id })
    const selected = selectLineage(second, parent.id)
    expect(selected.selectedLineageId).toBe(parent.id)
    expect(() => selectLineage(selected, 'lineage-missing')).toThrow()
    expect(retireLineage(selected, parent.id).selectedLineageId).toBeUndefined()
    expect(retireLineage(selected, parent.id).seeds[1]!.parentLineageId).toBe(parent.id)
    expect(selectLineage(selected).selectedLineageId).toBeUndefined()
  })

  it('bounds source history and refuses a full lineage library without silent eviction', () => {
    let nursery = createNursery()
    for (let index = 0; index < getContent().lineage.maxLineages; index += 1) {
      nursery = leaveSeed(nursery, { ...archive(), survivalMs: index * 1000 }, index + 1)
      nursery = hatchLineage(nursery, { seedId: nursery.seeds.at(-1)!.id, archetypeId: getContent().lineage.archetypes[0]!.id, name: `后代${index}` }, index + 1)
    }
    const full = leaveSeed(nursery, { ...archive(), survivalMs: 999_000 }, 99)
    expect(full.seeds).toHaveLength(getContent().lineage.maxSeeds)
    expect(() => hatchLineage(full, { seedId: full.seeds.at(-1)!.id, archetypeId: getContent().lineage.archetypes[0]!.id, name: '溢出' }, 99)).toThrow()
    expect(full.lineages).toHaveLength(getContent().lineage.maxLineages)
  })

  it('remembers an aged out unhatched result and preserves source identity across legacy archive normalization', () => {
    let nursery = createNursery()
    for (let index = 0; index < 20; index += 1) nursery = leaveSeed(nursery, { ...archive(), survivalMs: index * 1000 }, index + 1)
    expect(leaveSeed(nursery, archive(), 1)).toEqual(nursery)
    const first = leaveSeed(createNursery(), archive(), 1)
    expect(leaveSeed(first, { ...archive(), finalFormId: 'form-primal-cell' }, 1)).toEqual(first)
  })

  it('awards separate seeds for identical replay results from different run ordinals', () => {
    const first = leaveSeed(createNursery(), archive(), 1)
    const second = leaveSeed(first, archive(), 2)
    expect(second.seeds).toHaveLength(2)
    expect(second.seeds[0]!.id).not.toBe(second.seeds[1]!.id)
    expect(second.completedRuns).toBe(2)
    expect(leaveSeed(second, archive(), 2)).toEqual(second)
  })

  it('rejects a birth before the source was earned and preserves a genuine empty-inheritance start', () => {
    const seeded = leaveSeed(createNursery(), archive(), 5)
    const options = { seedId: seeded.seeds[0]!.id, archetypeId: getContent().lineage.archetypes[0]!.id, name: '素体后代' }
    expect(() => hatchLineage(seeded, options, 4)).toThrow()
    const hatched = hatchLineage(seeded, options, 5)
    expect(lineageLaunch(hatched.lineages[0]!).inheritedOrganelleIds).toEqual([])
    expect(lineageBuild(hatched.lineages[0]!).traitIds).toEqual([])
  })

  it('offers genes from every organ in the final specimen instead of only the archive highlights', () => {
    const source = archive()
    source.keyOrganelleIds = ['organelle-flagellum']
    source.finalMorphology = {
      bodyCount: 1, totalMass: 144, radius: 12, stability: 80,
      organelles: [
        { id: 'organelle-flagellum', stage: 'installed', anchor: 'rear' },
        { id: 'organelle-guard-symbiont', stage: 'mature', anchor: 'symbiont' },
      ],
    }
    expect(leaveSeed(createNursery(), source, 1).seeds[0]!.organelleIds).toEqual(['organelle-flagellum', 'organelle-guard-symbiont'])
  })
})
