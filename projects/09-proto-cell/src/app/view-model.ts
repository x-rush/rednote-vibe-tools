import type { ContentPack } from '../content'
import type { HudSnapshot } from '../game/engine'
import { deriveLifeArchive, type LifeEventLogEntry } from '../progression/archive'
import type { LifeArchiveSummary } from '../storage/codec'
import type { EnvironmentId } from '../content'
import type { BuildState, EvolutionRoute } from '../evolution/build'
import type { GameEvent } from '../game/interactions'

export type ResultInput = {
  events: readonly GameEvent[]
  finalBuild: BuildState
  journeyStageIndex: number
  environmentIds: readonly EnvironmentId[]
  engulfScore: number
  survivalMs: number
  seed: number
}

export function createResultViewModel(input: ResultInput, content: ContentPack) {
  const terminal = [...input.events].reverse().find((event) => event.type === 'player-died' || event.type === 'ending-reached')
  const route = (['predation', 'survival', 'colony'] as const).reduce((best, candidate) => (
    input.finalBuild.routeCounts[candidate] > input.finalBuild.routeCounts[best] ? candidate : best
  ), 'predation' as EvolutionRoute)
  const cause = terminal?.type === 'ending-reached'
    ? content.endings.find((ending) => ending.id === terminal.endingId)?.name ?? terminal.endingId
    : deathCause(terminal?.type === 'player-died' ? terminal.cause : '', content)
  const keyTraitIds = input.finalBuild.traitIds.slice(-3)
  return {
    cause,
    bodyStage: input.finalBuild.bodyStage,
    stageLabel: content.ui.hud[`bodyStage_${input.finalBuild.bodyStage}`] ?? input.finalBuild.bodyStage,
    route,
    routeLabel: content.ui.hud[`resultRoute${route[0].toUpperCase()}${route.slice(1)}`],
    keyTraitIds,
    keyTraits: keyTraitIds.flatMap((id) => {
      const organ = content.organelles.find((candidate) => candidate.id === id)
      return organ ? [{ id, name: organ.name, morphologyPartId: organ.morphologyPartId }] : []
    }),
    journeyStage: Math.max(1, Math.min(content.journey.stages.length, input.journeyStageIndex + 1)),
    journeyTotal: content.journey.stages.length,
    environmentIds: [...input.environmentIds],
    engulfScore: Math.max(0, Math.round(input.engulfScore)),
    survivalMs: Math.max(0, input.survivalMs),
    seed: input.seed >>> 0,
    nextSeed: (input.seed + 1) >>> 0,
  }
}

function deathCause(cause: string, content: ContentPack): string {
  if (/engulf|predator/.test(cause)) return content.ui.hud.resultCauseEngulf
  if (/rupture|acid|electric|spine|ram/.test(cause)) return content.ui.hud.resultCauseRupture
  if (/instability/.test(cause)) return content.ui.hud.resultCauseInstability
  return content.ui.screens.resultDescription
}

export type ArchiveViewModel = ReturnType<typeof createArchiveViewModel>

export function createHudViewModel(snapshot: HudSnapshot, content: ContentPack) {
  const stageLabel = content.ui.hud[`bodyStage_${snapshot.bodyStage}`] ?? snapshot.bodyStage
  return {
    score: String(Math.round(snapshot.engulfScore)),
    journey: `${String(snapshot.journeyIndex).padStart(2, '0')}/${String(snapshot.journeyTotal).padStart(2, '0')}`,
    bodyStageName: stageLabel,
    bodyStageProgress: Math.round(Math.min(1, Math.max(0, snapshot.bodyStageProgress)) * 100),
    membrane: `${Math.round(Math.min(1, Math.max(0, snapshot.membraneRatio)) * 100)}%`,
  }
}

export function createViewModel(
  snapshot: {
    screen: 'lab' | 'playing' | 'paused' | 'result'
    seed?: number
    originId?: string
    eventLog?: readonly LifeEventLogEntry[]
    hud?: HudSnapshot
  },
  content: ContentPack,
): { screen: typeof snapshot.screen; archive?: ArchiveViewModel } {
  return {
    screen: snapshot.screen,
    archive: snapshot.screen === 'result'
      ? createArchiveViewModel(withFallbackContext(snapshot.eventLog ?? [], snapshot.seed, snapshot.hud), content)
      : undefined,
  }
}

function withFallbackContext(
  eventLog: readonly LifeEventLogEntry[],
  seed: number | undefined,
  hud: HudSnapshot | undefined,
): LifeEventLogEntry[] {
  const copied = eventLog.map((entry) => ({ ...entry }))
  if (!hud || copied.some((entry) => entry.snapshot) || copied.length === 0) return copied
  copied[copied.length - 1] = {
    ...copied[copied.length - 1]!,
    snapshot: {
      runSeed: seed ?? 0,
      elapsedMs: hud.elapsedMs,
      environmentId: hud.environmentId,
      biomass: hud.biomass,
      peakBiomass: hud.peakBiomass,
      organelleIds: [],
    },
  }
  return copied
}

function createArchiveViewModel(
  eventLog: readonly LifeEventLogEntry[],
  content: ContentPack,
) {
  return createArchiveViewModelFromSummary(deriveLifeArchive(eventLog, content), content)
}

export function createArchiveViewModelFromSummary(
  archive: ReturnType<typeof deriveLifeArchive> | LifeArchiveSummary,
  content: ContentPack,
) {
  const environment = content.environments.find((item) => item.id === archive.farthestEnvironmentId) ?? content.environments[0]
  const deathTemplate = content.deathTemplates.find((item) => item.id === archive.deathTemplateId)
  const ending = content.endings.find((item) => item.id === archive.endingId)

  return {
    ...archive,
    title: content.ui.screens.archiveTitle,
    environmentName: environment?.name ?? archive.farthestEnvironmentId,
    palette: environment?.visualPalette ?? ['#073d66', '#72f5ff', '#ffbf69'],
    keyOrgans: archive.keyOrganelleIds.flatMap((id) => {
      const organ = content.organelles.find((item) => item.id === id)
      return organ ? [organ.name] : []
    }),
    synergies: archive.synergyIds.flatMap((id) => {
      const synergy = content.synergies.find((item) => item.id === id)
      return synergy ? [synergy.name] : []
    }),
    visualOrganelles: archive.finalMorphology?.organelles.flatMap((installed) => {
      const organ = content.organelles.find((item) => item.id === installed.id)
      return organ ? [{ ...installed, name: organ.name }] : []
    }) ?? [],
    deathText: deathTemplate?.text,
    endingName: ending?.name,
    cellLabel: content.ui.labels.archiveCell,
    restartLabel: content.ui.actions.restartAfterLife,
    labels: {
      survival: content.ui.screens.survival,
      dishCode: content.ui.labels.archiveDishCode,
      environment: content.ui.labels.archiveEnvironment,
      peakBiomass: content.ui.labels.archivePeakBiomass,
      keyOrgans: content.ui.labels.archiveKeyOrgans,
      synergies: content.ui.labels.archiveSynergies,
      speciesSeed: content.ui.labels.archiveSpeciesSeed,
      noOrgans: content.ui.labels.archiveNoOrgans,
    },
  }
}
