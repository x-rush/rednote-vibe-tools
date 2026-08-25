import type { Artifact, ObservationSpot, QuizQuestion } from '../content/types.ts'
import { hasArtifactExperienceV2 } from '../content/types.ts'

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
  kind: 'enhanced' | 'legacy'
  imageAlt: string
  instruction: string
  spots: ObservationSpot[]
  clueSeals: ClueSealViewModel[]
  guideLines: string[]
}

export function buildObservationViewModel(
  artifact: Artifact,
  question: QuizQuestion,
  openedIds: readonly string[],
  instructions: { enhanced: string; legacy: string },
): ObservationViewModel {
  const openedSet = new Set(openedIds)
  const previewStars = (opened: boolean): 1 | 2 | 3 => {
    const clueCount = opened ? openedSet.size : openedSet.size + 1
    return Math.max(1, 4 - Math.max(1, clueCount)) as 1 | 2 | 3
  }
  if (hasArtifactExperienceV2(artifact)) {
    return {
      kind: 'enhanced',
      imageAlt: '当前藏品的局部观察线索，不包含答案文字',
      instruction: instructions.enhanced,
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
  return {
    kind: 'legacy',
    imageAlt: '当前藏品的局部观察线索，不包含答案文字',
    instruction: instructions.legacy,
    spots: [],
    clueSeals: question.clues.map((clue, index) => ({
      id: clue.id,
      label: `线索${['一', '二', '三'][index] ?? index + 1}`,
      text: clue.text,
      npcHint: null,
      opened: openedSet.has(clue.id),
      costsStar: !openedSet.has(clue.id) && openedSet.size > 0,
      starsAfterOpen: previewStars(openedSet.has(clue.id)),
    })),
    guideLines: [],
  }
}
