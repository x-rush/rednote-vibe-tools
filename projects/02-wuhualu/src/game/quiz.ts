import type { Artifact, DistractorCandidate, DistractorTag, QuizOption, QuizQuestion } from '../content/types.ts'
import { createSeededRandom, seededShuffle } from './random.ts'

export type QuizGenerationError = {
  kind: 'quiz-generation-error'
  code: 'insufficient-distractors'
  artifactId: string
  message: string
}

export function isQuizGenerationError(value: QuizQuestion | QuizGenerationError): value is QuizGenerationError {
  return 'kind' in value && value.kind === 'quiz-generation-error'
}

function canAddArtifact(selected: readonly Artifact[], candidate: Artifact): boolean {
  const sameMaterial = selected.filter(({ material }) => material === candidate.material).length
  const samePeriod = selected.filter(({ periodGroup }) => periodGroup === candidate.periodGroup).length
  return sameMaterial < 2 && samePeriod < 2
}

export function selectRoundArtifacts<T extends Artifact>(
  artifacts: readonly T[],
  seed: string,
  recentArtifactIds: readonly string[],
  count: number,
): T[] {
  const random = createSeededRandom(seed)
  const recent = new Set(recentArtifactIds)
  const preferred = seededShuffle(artifacts.filter(({ id }) => !recent.has(id)), random)
  const deferred = seededShuffle(artifacts.filter(({ id }) => recent.has(id)), random)
  const ordered = [...preferred, ...deferred]
  const selected: T[] = []

  for (const artifact of ordered) {
    if (selected.length === count) break
    if (canAddArtifact(selected, artifact)) selected.push(artifact)
  }
  for (const artifact of ordered) {
    if (selected.length === count) break
    if (!selected.some(({ id }) => id === artifact.id)) selected.push(artifact)
  }
  return selected
}

function overlap(first: readonly DistractorTag[], second: readonly DistractorTag[]): number {
  const secondSet = new Set(second)
  return first.reduce((score, tag) => score + (secondSet.has(tag) ? 1 : 0), 0)
}

function rankCandidates(target: Artifact, candidates: readonly DistractorCandidate[], random: () => number): DistractorCandidate[] {
  const shuffled = seededShuffle(candidates, random)
  const targetNames = new Set([target.name, ...target.aliases])
  const uniqueLabels = new Set<string>()
  return shuffled
    .filter(({ eligible, label }) => eligible !== false && !targetNames.has(label))
    .sort((first, second) => {
      const authoredDelta = Number(second.forArtifactIds.includes(target.id)) - Number(first.forArtifactIds.includes(target.id))
      if (authoredDelta !== 0) return authoredDelta
      return overlap(second.tags, target.distractorTags) - overlap(first.tags, target.distractorTags)
    })
    .filter(({ label }) => {
      if (uniqueLabels.has(label)) return false
      uniqueLabels.add(label)
      return true
    })
}

export function createQuizQuestion(
  target: Artifact,
  candidates: readonly DistractorCandidate[],
  seed: string,
): QuizQuestion | QuizGenerationError {
  const random = createSeededRandom(seed)
  const distractors = rankCandidates(target, candidates, random).slice(0, 3)
  if (distractors.length < 3) {
    return {
      kind: 'quiz-generation-error',
      code: 'insufficient-distractors',
      artifactId: target.id,
      message: `无法为${target.name}生成三个不重复干扰项`,
    }
  }

  const correctOptionId = `option-correct-${target.id}`
  const options: QuizOption[] = [
    { id: correctOptionId, label: target.name, isCorrect: true, artifactId: target.id },
    ...distractors.map(({ id, label }) => ({ id, label, isCorrect: false })),
  ]
  return {
    id: `question-${target.id}`,
    artifactId: target.id,
    correctOptionId,
    options: seededShuffle(options, random),
    clues: target.clues,
    successFeedback: target.unlockCopy,
    wrongFeedback: target.wrongAnswerExplanation,
  }
}
