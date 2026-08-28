import type { ContentPack } from '../content'
import type { HudSnapshot } from '../game/engine'
import { deriveLifeArchive, type LifeEventLogEntry } from '../progression/archive'

export type ArchiveViewModel = ReturnType<typeof createArchiveViewModel>

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
  const archive = deriveLifeArchive(eventLog, content)
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
