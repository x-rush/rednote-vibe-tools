import type { CompleteArtifact, ObservationSpot } from '../content/types.ts'

export type ClueSealViewModel = {
  id: string
  label: string
  text: string
  npcHint: string | null
  opened: boolean
  costsStar: boolean
  starsAfterOpen: 1 | 2 | 3
}

export type ObservationViewModel = {
  imageAlt: string
  instruction: string
  spots: ObservationSpot[]
  clueSeals: ClueSealViewModel[]
  guideLines: string[]
}

export function buildObservationViewModel(
  artifact: CompleteArtifact,
  openedIds: readonly string[],
  instruction: string,
): ObservationViewModel {
  const openedSet = new Set(openedIds)
  const previewStars = (opened: boolean): 1 | 2 | 3 => {
    const clueCount = opened ? openedSet.size : openedSet.size + 1
    return Math.max(1, 4 - Math.max(1, clueCount)) as 1 | 2 | 3
  }
  return {
    imageAlt: '当前藏品的局部观察线索，不包含答案文字',
    instruction,
    spots: artifact.experienceV2.observationSpots,
    clueSeals: artifact.experienceV2.clueCards.map(card => ({
      id: card.id,
      label: card.label,
      text: card.text,
      npcHint: card.npcHint,
      opened: openedSet.has(card.id),
      costsStar: !openedSet.has(card.id) && openedSet.size > 0,
      starsAfterOpen: previewStars(openedSet.has(card.id)),
    })),
    guideLines: artifact.experienceV2.guideLines.beforeObservation,
  }
}
