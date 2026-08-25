import type { ChapterCode } from '../content/types'
import { advanceInterlude, chapterPosition } from './journey'

export type QuizInterlude =
  | { mode: 'start'; chapter: ChapterCode }
  | { mode: 'end'; chapter: Exclude<ChapterCode, 'return'>; nextChapter: Exclude<ChapterCode, 'entry'> }

export function initialInterlude(current: number): QuizInterlude | undefined {
  const position = chapterPosition(current)
  return position.isStart ? { mode: 'start', chapter: position.chapter } : undefined
}

export function requestAdvanceInterlude(current: number, completedTransitions: ReadonlySet<number> = new Set()): QuizInterlude | undefined {
  if (completedTransitions.has(current)) return undefined
  const transition = advanceInterlude(current)
  return transition ? { mode: 'end', ...transition } : undefined
}

export function completeInterlude(interlude: QuizInterlude): { shouldAdvance: boolean; next: QuizInterlude | undefined } {
  if (interlude.mode === 'start') return { shouldAdvance: false, next: undefined }
  return { shouldAdvance: true, next: { mode: 'start', chapter: interlude.nextChapter } }
}
