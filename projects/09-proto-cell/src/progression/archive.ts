import type { BodyStage, ContentPack, EnvironmentId, FormId, OrganelleId, SynergyId } from '../content'
import type { EvolutionRoute } from '../evolution/build'
import type { GameEvent } from '../game/interactions'
import type { PlayerMorphologySnapshot } from '../game/engine'
import { encodeDishCode } from './challenges'
import { generateRunRoute } from '../world/generator'

export type LifeEventSnapshot = {
  runSeed: number
  elapsedMs: number
  environmentId: string
  biomass: number
  peakBiomass?: number
  organelleIds: readonly OrganelleId[]
  morphology?: PlayerMorphologySnapshot
  bodyStage?: BodyStage
  buildRouteCounts?: Record<EvolutionRoute, number>
  journeyStageIndex?: number
  formId?: FormId
  tierIndex?: number
}

export type LifeEventLogEntry = {
  sequence: number
  event: GameEvent
  snapshot?: LifeEventSnapshot
}

export type LifeArchive = {
  speciesNameSeed: number
  survivalMs: number
  farthestEnvironmentId: EnvironmentId
  maxBiomass: number
  keyOrganelleIds: OrganelleId[]
  synergyIds: SynergyId[]
  deathTemplateId?: ContentPack['deathTemplates'][number]['id']
  endingId?: ContentPack['endings'][number]['id']
  dishCode: string
  finalMorphology?: PlayerMorphologySnapshot
  finalBodyStage: BodyStage
  buildRouteCounts: Record<EvolutionRoute, number>
  journeyStageIndex: number
  finalFormId?: FormId
  finalTierIndex?: number
  ecosystemIds?: EnvironmentId[]
}

export function deriveLifeArchive(
  eventLog: readonly LifeEventLogEntry[],
  content: ContentPack,
): LifeArchive {
  const ordered = [...eventLog].sort((left, right) => left.sequence - right.sequence)
  const initialEnvironment = content.environments[0]?.id ?? 'env-clear-drop'
  const initialMass = content.m0.environments.find((environment) => environment.id === initialEnvironment)?.playerDefinition.mass ?? 0
  const selectedRoutes = ordered.flatMap((entry) => entry.event.type === 'route-selected' ? [entry.event.environmentId] : [])
  const snapshotEnvironments = ordered.flatMap((entry) => entry.snapshot ? [entry.snapshot.environmentId] : [])
  const visitedEnvironmentIds = unique([initialEnvironment, ...snapshotEnvironments, ...selectedRoutes])
  const farthestEnvironmentId = visitedEnvironmentIds.reduce((farthest, candidate) => {
    const farthestOrder = content.environments.find((environment) => environment.id === farthest)?.order ?? -1
    const candidateOrder = content.environments.find((environment) => environment.id === candidate)?.order ?? -1
    return candidateOrder > farthestOrder ? candidate : farthest
  }, initialEnvironment) as EnvironmentId
  const survivalMs = ordered.reduce((maximum, entry) => Math.max(maximum, entry.event.atMs, entry.snapshot?.elapsedMs ?? 0), 0)
  const fallbackBiomass = ordered.reduce((biomass, entry) => (
    entry.event.type === 'engulfed' && entry.event.predatorId === 'player' ? biomass + entry.event.biomass : biomass
  ), initialMass)
  const snapshotBiomasses = ordered.flatMap((entry) => entry.snapshot ? [entry.snapshot.peakBiomass ?? entry.snapshot.biomass] : [])
  const maxBiomass = snapshotBiomasses.length > 0
    ? Math.max(initialMass, ...snapshotBiomasses)
    : fallbackBiomass
  const finalSnapshot = [...ordered].reverse().find((entry) => entry.snapshot)?.snapshot
  const finalSnapshotOrganelleIds = finalSnapshot?.morphology?.organelles.map((organ) => organ.id) ?? finalSnapshot?.organelleIds
  const finalOrganelleIds = unique(finalSnapshotOrganelleIds ? [...finalSnapshotOrganelleIds] : [])
  const synergyIds = content.synergies
    .filter((synergy) => (
      synergy.requires.every((organId) => finalOrganelleIds.includes(organId))
      && (synergy.excludes ?? []).every((organId) => !finalOrganelleIds.includes(organId))
    ))
    .map((synergy) => synergy.id)
  const keyOrganelleIds = unique([
    ...content.synergies.filter((synergy) => synergyIds.includes(synergy.id)).flatMap((synergy) => synergy.requires),
    ...finalOrganelleIds,
  ]).slice(0, 3)

  const terminalEntries = ordered.filter((entry) => entry.event.type === 'player-died' || entry.event.type === 'ending-reached')
  const terminal = terminalEntries.at(-1)
  const endingId = terminal?.event.type === 'ending-reached' ? terminal.event.endingId as LifeArchive['endingId'] : undefined
  const deathTemplateId = terminal?.event.type === 'player-died'
    ? selectDeathTemplateId(ordered, terminal, content)
    : undefined
  const runSeed = ordered.find((entry) => entry.snapshot)?.snapshot?.runSeed ?? 0
  const fallbackRoute = generateRunRoute(runSeed).slice(1, 3)
  const codedRoute: [EnvironmentId, EnvironmentId] = [
    (selectedRoutes.find((id) => id === 'env-algae-glow' || id === 'env-acid-vesicle') ?? fallbackRoute[0]) as EnvironmentId,
    (selectedRoutes.find((id) => id === 'env-fiber-maze' || id === 'env-antibody-storm') ?? fallbackRoute[1]) as EnvironmentId,
  ]
  const speciesNameSeed = hash32([
    runSeed,
    farthestEnvironmentId,
    keyOrganelleIds.join(','),
    synergyIds.join(','),
    endingId ?? deathTemplateId ?? terminal?.event.type ?? 'open',
  ].join('|'))
  const finalMorphology: PlayerMorphologySnapshot | undefined = finalSnapshot?.morphology
    ? { ...finalSnapshot.morphology, organelles: finalSnapshot.morphology.organelles.map((organ) => ({ ...organ })) }
    : undefined
  const finalBodyStage = finalSnapshot?.bodyStage ?? 'microbe'
  const finalFormId = finalSnapshot?.formId ?? legacyFormForStage(finalBodyStage)
  const buildRouteCounts = { predation: 0, survival: 0, colony: 0, ...finalSnapshot?.buildRouteCounts }
  const journeyStageIndex = finalSnapshot?.journeyStageIndex
    ?? Math.max(0, ...visitedEnvironmentIds.map((id) => content.environments.find((environment) => environment.id === id)?.order ?? 0))

  return {
    speciesNameSeed,
    survivalMs,
    farthestEnvironmentId,
    maxBiomass,
    keyOrganelleIds,
    synergyIds,
    deathTemplateId,
    endingId,
    finalMorphology,
    finalBodyStage,
    buildRouteCounts,
    journeyStageIndex,
    finalFormId,
    finalTierIndex: finalSnapshot?.tierIndex ?? tierIndexForForm(finalFormId),
    ecosystemIds: visitedEnvironmentIds.filter((id): id is EnvironmentId => content.environments.some((environment) => environment.id === id)),
    dishCode: encodeDishCode({ seed: runSeed, contentVersion: content.contentVersion, route: codedRoute }),
  }
}

function legacyFormForStage(stage: BodyStage): FormId {
  if (stage === 'specialist' || stage === 'dominant') return 'form-colony-body'
  if (stage === 'ascendant') return 'form-ciliate-composite'
  return 'form-primal-cell'
}

function tierIndexForForm(formId: FormId): number {
  return formId === 'form-primal-cell' ? 0 : formId === 'form-colony-body' ? 1 : 2
}

function selectDeathTemplateId(
  ordered: readonly LifeEventLogEntry[],
  fatalEntry: LifeEventLogEntry,
  content: ContentPack,
): LifeArchive['deathTemplateId'] {
  if (fatalEntry.event.type !== 'player-died') return undefined
  const causeTags = new Set(fatalEntry.event.cause.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
  const tags = new Set(causeTags)
  let lastObservedTag: string | undefined
  for (const entry of ordered) {
    if (entry.sequence > fatalEntry.sequence || fatalEntry.event.atMs - entry.event.atMs > 1200) continue
    if (entry.event.type === 'damaged' && entry.event.targetId === 'player') lastObservedTag = entry.event.source
    if (entry.event.type === 'engulfed' && entry.event.preyId === 'player') lastObservedTag = 'engulfed'
    if (entry.event.type === 'ruptured' && entry.event.targetId === 'player' && !lastObservedTag) lastObservedTag = 'ruptured'
    if (lastObservedTag) tags.add(lastObservedTag)
  }
  const knownCauseTags = [...causeTags].filter((tag) => content.deathTemplates.some((template) => template.requiredTags?.includes(tag)))
  const preferredTag = knownCauseTags.length === 1 ? knownCauseTags[0] : lastObservedTag
  return [...content.deathTemplates]
    .filter((template) => (
      template.eventType === fatalEntry.event.type
      && (template.requiredTags ?? []).every((tag) => tags.has(tag))
      && (template.excludedTags ?? []).every((tag) => !tags.has(tag))
    ))
    .sort((left, right) => (
      Number(Boolean(right.requiredTags?.includes(preferredTag ?? ''))) - Number(Boolean(left.requiredTags?.includes(preferredTag ?? '')))
      || right.priority - left.priority
    ))[0]?.id
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function hash32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
