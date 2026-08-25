import type { AppScreen } from '../app/state'
import type { ChapterCode } from '../content/types'

export type GuideMomentContext = {
  screen: AppScreen
  guideUnseen?: boolean
  introStep?: number
  hasProgress?: boolean
  hasRecentResult?: boolean
  chapter?: ChapterCode
  current?: number
  requestedHelp?: 'quiz' | 'result'
  interlude?: { mode: 'start' | 'end'; chapter: ChapterCode }
  revealStep?: 'collecting' | 'reading' | 'complete'
  recoveryReason?: 'content' | 'storage'
}

export type GuideMoment =
  | { kind: 'intro'; step: number }
  | { kind: 'landing-fresh' }
  | { kind: 'landing-resume'; chapter: ChapterCode; current: number }
  | { kind: 'landing-recent' }
  | { kind: 'chapter-start'; chapter: ChapterCode }
  | { kind: 'chapter-end'; chapter: ChapterCode }
  | { kind: 'reveal'; step: 'collecting' | 'reading' | 'complete' }
  | { kind: 'quiz-help' }
  | { kind: 'result-help' }
  | { kind: 'recovery'; reason: 'content' | 'storage' }

export function deriveGuideMoment(context: GuideMomentContext): GuideMoment | undefined {
  if (context.recoveryReason) return { kind: 'recovery', reason: context.recoveryReason }
  if (context.screen === 'landing' && context.guideUnseen) return { kind: 'intro', step: context.introStep ?? 0 }
  if (context.revealStep) return { kind: 'reveal', step: context.revealStep }
  if (context.requestedHelp === 'quiz') return { kind: 'quiz-help' }
  if (context.requestedHelp === 'result') return { kind: 'result-help' }
  if (context.interlude) return {
    kind: context.interlude.mode === 'start' ? 'chapter-start' : 'chapter-end',
    chapter: context.interlude.chapter,
  }
  if (context.screen !== 'landing') return undefined
  if (context.hasProgress && context.chapter && context.current !== undefined) {
    return { kind: 'landing-resume', chapter: context.chapter, current: context.current }
  }
  if (context.hasRecentResult) return { kind: 'landing-recent' }
  return { kind: 'landing-fresh' }
}
