import type { ContentCopy } from '../content/types.ts'

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
  | 'collection'
  | 'artifactDetail'
  | 'summary'
  | 'error'

export type GuidePresentation = 'compact' | 'stage'
export type PageChrome = { title: string; primaryAction: string; guidePresentation: GuidePresentation }

export function guidePresentationForScreen(screen: ScreenName): GuidePresentation {
  return ['wrongReview', 'reveal', 'setComplete'].includes(screen) ? 'stage' : 'compact'
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
    case 'collection':
    case 'artifactDetail': return { title: copy.collectionTitle, primaryAction: copy.continueAction, guidePresentation }
    case 'summary': return { title: copy.summaryTitle, primaryAction: copy.collectionTitle, guidePresentation }
    case 'error': return { title: copy.errorTitle, primaryAction: copy.resetAction, guidePresentation }
  }
}
