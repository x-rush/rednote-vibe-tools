import type { ChapterCode, QuizCompanionCopy } from '../content/types'

export type QuizCompanionInput = {
  chapter: ChapterCode
  current: number
  selected: boolean
  revisiting: boolean
}

export function deriveQuizCompanionLine(input: QuizCompanionInput, copy: QuizCompanionCopy) {
  if (input.revisiting) return copy.revisiting
  if (input.selected) return copy.selected
  const offset = (input.current - 1) % 6
  const phase = offset < 2 ? 'opening' : offset < 4 ? 'middle' : 'closing'
  return copy.phase[input.chapter][phase]
}
