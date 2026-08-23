import type { GuessResult, QuizQuestion } from '../content/types.ts'

export function revealNextClue(question: QuizQuestion, revealedClueIds: readonly string[]): string[] {
  const next = question.clues.find(({ id }) => !revealedClueIds.includes(id))
  return next ? [...revealedClueIds, next.id] : revealedClueIds as string[]
}

export function evaluateGuess(
  question: QuizQuestion,
  selectedOptionId: string,
  additionalCluesUsed: number,
  streak: number,
): GuessResult {
  const correct = selectedOptionId === question.correctOptionId
  const stars = Math.max(1, 3 - Math.max(0, additionalCluesUsed)) as 1 | 2 | 3
  const streakBonus = Math.min(Math.max(streak, 0), 5) * 10
  return {
    artifactId: question.artifactId,
    selectedOptionId,
    correct,
    stars,
    points: correct ? stars * 100 + streakBonus : 0,
    nextStreak: correct ? streak + 1 : 0,
    feedback: correct ? question.successFeedback : question.wrongFeedback,
  }
}
