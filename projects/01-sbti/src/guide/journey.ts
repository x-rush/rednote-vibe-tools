import type { ChapterCode } from '../content/types'

const CHAPTERS: ChapterCode[] = ['entry', 'trace', 'change', 'return']

export type ChapterPosition = {
  chapter: ChapterCode
  chapterIndex: number
  isStart: boolean
  isEnd: boolean
}

export type InterludeTransition = {
  chapter: Exclude<ChapterCode, 'return'>
  nextChapter: Exclude<ChapterCode, 'entry'>
}

export function chapterPosition(current: number): ChapterPosition {
  if (!Number.isInteger(current) || current < 1 || current > 24) {
    throw new RangeError('Current question must be an integer from 1 to 24')
  }
  const chapterIndex = Math.floor((current - 1) / 6)
  return {
    chapter: CHAPTERS[chapterIndex]!,
    chapterIndex,
    isStart: (current - 1) % 6 === 0,
    isEnd: current % 6 === 0,
  }
}

export function advanceInterlude(current: number): InterludeTransition | undefined {
  if (current === 6) return { chapter: 'entry', nextChapter: 'trace' }
  if (current === 12) return { chapter: 'trace', nextChapter: 'change' }
  if (current === 18) return { chapter: 'change', nextChapter: 'return' }
  return undefined
}
