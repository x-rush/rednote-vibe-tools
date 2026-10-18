import { getContent, type FormId, type OrganelleId } from '../content'
import { createBuildState, type BuildState, type EvolutionRoute } from '../evolution/build'
import type { LifeArchiveSummary } from '../storage/codec'

export type SeedSource = {
  id: string
  archiveKey: string
  generation: number
  parentLineageId?: string
  organelleIds: OrganelleId[]
  sourceFormId: FormId
  route: EvolutionRoute
  earnedAtRun: number
}

export type CellLineage = {
  id: string
  name: string
  seedId: string
  generation: number
  parentLineageId?: string
  archetypeId: string
  inheritedOrganelleId?: OrganelleId
  bornAtRun: number
}

export type NurseryState = {
  seeds: SeedSource[]
  lineages: CellLineage[]
  selectedLineageId?: string
  hatchedSeedIds: string[]
  seenArchiveKeys?: string[]
  completedRuns?: number
}

export type HatchOptions = Pick<CellLineage, 'seedId' | 'archetypeId' | 'inheritedOrganelleId' | 'name'>

export function createNursery(): NurseryState { return { seeds: [], lineages: [], hatchedSeedIds: [], seenArchiveKeys: [], completedRuns: 0 } }

export function leaveSeed(nursery: NurseryState, archive: LifeArchiveSummary, runOrdinal: number, parentLineageId?: string): NurseryState {
  requireOrdinal(runOrdinal)
  const archiveKey = archiveFingerprint(archive, runOrdinal)
  if (nursery.seeds.some((source) => source.archiveKey === archiveKey) || nursery.seenArchiveKeys?.includes(archiveKey)) return nursery
  const parent = parentLineageId === undefined ? undefined : nursery.lineages.find((lineage) => lineage.id === parentLineageId)
  if (parentLineageId !== undefined && !parent) throw new TypeError('Parent lineage does not exist')
  const generation = parent ? parent.generation + 1 : 1
  requireOrdinal(generation)
  const known = new Set(getContent().organelles.map((organ) => organ.id))
  const organelleIds = archiveGenes(archive).filter((id) => known.has(id))
  const route = (['predation', 'survival', 'colony'] as const).reduce((best, candidate) => archive.buildRouteCounts[candidate] > archive.buildRouteCounts[best] ? candidate : best, 'predation' as EvolutionRoute)
  const seed: SeedSource = {
    id: `seed-${archiveKey}`, archiveKey, generation, organelleIds,
    sourceFormId: archiveForm(archive),
    route, earnedAtRun: runOrdinal,
    ...(parentLineageId === undefined ? {} : { parentLineageId }),
  }
  return { ...nursery, seeds: [...nursery.seeds, seed].slice(-getContent().lineage.maxSeeds), seenArchiveKeys: [...(nursery.seenArchiveKeys ?? nursery.seeds.map((source) => source.archiveKey)), archiveKey].slice(-30), completedRuns: Math.max(nursery.completedRuns ?? 0, runOrdinal) }
}

export function hatchLineage(nursery: NurseryState, options: HatchOptions, runOrdinal: number): NurseryState {
  requireOrdinal(runOrdinal)
  const source = nursery.seeds.find((seed) => seed.id === options.seedId)
  if (!source) throw new TypeError('Seed source does not exist')
  if (runOrdinal < source.earnedAtRun) throw new TypeError('Offspring cannot be born before its source was earned')
  if (nursery.hatchedSeedIds.includes(source.id)) throw new TypeError('This seed has already hatched')
  if (nursery.lineages.length >= getContent().lineage.maxLineages) throw new TypeError('Lineage library is full; retire an offspring first')
  const archetype = getContent().lineage.archetypes.find((candidate) => candidate.id === options.archetypeId)
  if (!archetype || source.generation < archetype.minGeneration) throw new TypeError('Archetype is unavailable for this generation')
  if (options.inheritedOrganelleId !== undefined && (getContent().lineage.maxInheritedOrgans < 1 || !source.organelleIds.includes(options.inheritedOrganelleId) || !archetype.inheritancePool.includes(options.inheritedOrganelleId))) throw new TypeError('Inherited organ must be earned by this seed and compatible with the archetype')
  const name = normalizeLineageName(options.name)
  const lineage: CellLineage = {
    id: `lineage-${source.archiveKey}`, seedId: source.id, name, generation: source.generation,
    archetypeId: archetype.id, bornAtRun: runOrdinal,
    ...(source.parentLineageId === undefined ? {} : { parentLineageId: source.parentLineageId }),
    ...(options.inheritedOrganelleId === undefined ? {} : { inheritedOrganelleId: options.inheritedOrganelleId }),
  }
  const lineages = [...nursery.lineages, lineage]
  const recent = [...nursery.hatchedSeedIds, source.id].slice(-30)
  const hatchedSeedIds = [...new Set([...recent, ...lineages.map((item) => item.seedId)])]
  return { ...nursery, lineages, hatchedSeedIds, completedRuns: Math.max(nursery.completedRuns ?? 0, runOrdinal) }
}

export function selectLineage(nursery: NurseryState, id?: string): NurseryState {
  if (id !== undefined && !nursery.lineages.some((lineage) => lineage.id === id)) throw new TypeError('Selected lineage does not exist')
  const next = { ...nursery }
  if (id === undefined) delete next.selectedLineageId
  else next.selectedLineageId = id
  return next
}

export function retireLineage(nursery: NurseryState, id: string): NurseryState {
  if (!nursery.lineages.some((lineage) => lineage.id === id)) throw new TypeError('Lineage does not exist')
  const next = { ...nursery, lineages: nursery.lineages.filter((lineage) => lineage.id !== id) }
  return next.selectedLineageId === id ? selectLineage(next) : next
}

export function lineageBuild(lineage: CellLineage): BuildState {
  const launch = lineageLaunch(lineage)
  const routeCounts = { predation: 0, survival: 0, colony: 0 }
  for (const id of launch.inheritedOrganelleIds) {
    const organ = getContent().organelles.find((item) => item.id === id)!
    routeCounts[organ.evolutionRoute] += 1
  }
  return createBuildState({ traitIds: launch.inheritedOrganelleIds, routeCounts })
}

export function lineageLaunch(lineage: CellLineage): { originId: ReturnType<typeof getContent>['origins'][number]['id']; inheritedOrganelleIds: OrganelleId[]; lineageArchetypeId: string } {
  const archetype = getContent().lineage.archetypes.find((candidate) => candidate.id === lineage.archetypeId)
  if (!archetype) throw new TypeError('Unknown lineage archetype')
  if (lineage.inheritedOrganelleId !== undefined && !archetype.inheritancePool.includes(lineage.inheritedOrganelleId)) throw new TypeError('Incompatible inherited organ')
  return { originId: archetype.originId, inheritedOrganelleIds: lineage.inheritedOrganelleId === undefined ? [] : [lineage.inheritedOrganelleId], lineageArchetypeId: archetype.id }
}

export function normalizeLineageName(value: string): string {
  if (typeof value !== 'string' || /(?:data:|blob:|;base64,)/i.test(value) || /^[A-Za-z0-9+/]{2048,}={0,2}$/.test(value.replace(/\s/g, ''))) throw new TypeError('Offspring name must be plain text')
  const name = Array.from(value.trim()).filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127).slice(0, 16).join('')
  if (!name) throw new TypeError('Offspring name cannot be empty')
  return name
}

function requireOrdinal(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Run and generation counters must be non-negative safe integers')
}

function archiveForm(archive: LifeArchiveSummary): FormId {
  return archive.finalFormId ?? (archive.finalBodyStage === 'ascendant' ? 'form-ciliate-composite' : archive.finalBodyStage === 'specialist' || archive.finalBodyStage === 'dominant' ? 'form-colony-body' : 'form-primal-cell')
}

function archiveFingerprint(archive: LifeArchiveSummary, runOrdinal: number): string {
  const text = JSON.stringify([runOrdinal, archive.dishCode, archive.speciesNameSeed, archive.survivalMs, archive.maxBiomass, archive.farthestEnvironmentId, archiveGenes(archive).sort(), archive.deathTemplateId ?? '', archive.endingId ?? '', archiveForm(archive), archive.finalBodyStage, archive.journeyStageIndex])
  let first = 2166136261
  let second = 5381
  for (let index = 0; index < text.length; index += 1) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619) >>> 0
    second = (Math.imul(second, 33) ^ text.charCodeAt(index)) >>> 0
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`
}

function archiveGenes(archive: LifeArchiveSummary): OrganelleId[] {
  return [...new Set(archive.finalMorphology ? archive.finalMorphology.organelles.map((organ) => organ.id) : archive.keyOrganelleIds)]
}
