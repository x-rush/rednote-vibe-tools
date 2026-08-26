import type { ContentCopy, NarrativeChapterId, NarrativeContent } from '../content/types.ts'
import { nextUnreadNarrativeChapter } from '../narrative/narrative.ts'

export type ScreenName =
  | 'landing'
  | 'intro'
  | 'modeSelect'
  | 'observation'
  | 'clueSelect'
  | 'answering'
  | 'wrongReview'
  | 'reveal'
  | 'story'
  | 'memory'
  | 'archive'
  | 'setComplete'
  | 'narrativeInterlude'
  | 'collection'
  | 'artifactDetail'
  | 'summary'
  | 'error'

export type GuidePresentation = 'compact' | 'stage'
export type PageChrome = { title: string; primaryAction: string; guidePresentation: GuidePresentation }
type ScrollScopeState = { screen: ScreenName; session?: { index: number }; artifactId?: string; chapterId?: string }

export function pageScrollScope(state: ScrollScopeState): string {
  if (['observation', 'clueSelect', 'answering'].includes(state.screen) && state.session) return `case:${state.session.index}`
  if (state.screen === 'artifactDetail' && state.artifactId) return `artifactDetail:${state.artifactId}`
  if (state.screen === 'narrativeInterlude' && state.chapterId) return `narrative:${state.chapterId}`
  return state.screen
}

export function guidePresentationForScreen(screen: ScreenName): GuidePresentation {
  return ['wrongReview', 'setComplete', 'narrativeInterlude'].includes(screen) ? 'stage' : 'compact'
}

export function shouldShowExitAction(screen: ScreenName): boolean {
  return ['observation', 'clueSelect', 'answering', 'wrongReview', 'reveal', 'story', 'memory', 'archive'].includes(screen)
}

export function getPageChrome(screen: ScreenName, copy: ContentCopy): PageChrome {
  const guidePresentation = guidePresentationForScreen(screen)
  switch (screen) {
    case 'landing': return { title: copy.landingTitle, primaryAction: copy.startAction, guidePresentation }
    case 'intro': return { title: copy.introTitle, primaryAction: copy.introAction, guidePresentation }
    case 'modeSelect': return { title: copy.modeTitle, primaryAction: copy.dailyMode, guidePresentation }
    case 'observation': return { title: copy.brand, primaryAction: copy.clueAction, guidePresentation }
    case 'clueSelect': return { title: copy.brand, primaryAction: copy.submitAction, guidePresentation }
    case 'answering': return { title: copy.brand, primaryAction: copy.submitAction, guidePresentation }
    case 'wrongReview': return { title: copy.subtitle, primaryAction: copy.retryAction, guidePresentation }
    case 'reveal': return { title: copy.subtitle, primaryAction: copy.nextAction, guidePresentation }
    case 'story': return { title: copy.factsTitle, primaryAction: copy.nextAction, guidePresentation }
    case 'memory': return { title: copy.cluesTitle, primaryAction: copy.submitAction, guidePresentation }
    case 'archive': return { title: copy.collectionTitle, primaryAction: copy.nextAction, guidePresentation }
    case 'setComplete': return { title: copy.collectionTitle, primaryAction: copy.collectionAction, guidePresentation }
    case 'narrativeInterlude': return { title: copy.collectionTitle, primaryAction: copy.continueAction, guidePresentation }
    case 'collection':
    case 'artifactDetail': return { title: copy.collectionTitle, primaryAction: copy.continueAction, guidePresentation }
    case 'summary': return { title: copy.summaryTitle, primaryAction: copy.collectionTitle, guidePresentation }
    case 'error': return { title: copy.errorTitle, primaryAction: copy.resetAction, guidePresentation }
  }
}

export type NarrativeJournalEntry = {
  id: NarrativeChapterId
  title: string
  summary: string
  unlocked: boolean
  seen: boolean
  deferred: boolean
}

export type NarrativeJournalModel = {
  entries: NarrativeJournalEntry[]
  pendingId: NarrativeChapterId | null
  replayableIds: NarrativeChapterId[]
  complete: boolean
}

export function buildNarrativeJournalModel(
  narrative: NarrativeContent,
  collectionCount: number,
  seenIds: readonly NarrativeChapterId[],
  deferredIds: readonly NarrativeChapterId[],
): NarrativeJournalModel {
  const seen = new Set(seenIds)
  const deferred = new Set(deferredIds)
  const entries = narrative.chapters.map(chapter => ({
    id: chapter.id,
    title: chapter.title,
    summary: chapter.summary,
    unlocked: chapter.unlockCount <= collectionCount,
    seen: seen.has(chapter.id),
    deferred: deferred.has(chapter.id),
  }))
  return {
    entries,
    pendingId: nextUnreadNarrativeChapter(narrative.chapters, collectionCount, seenIds, deferredIds)?.id ?? null,
    replayableIds: entries.filter(entry => entry.unlocked && (entry.seen || entry.deferred)).map(({ id }) => id),
    complete: collectionCount === 20 && seen.has('finale'),
  }
}
