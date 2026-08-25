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

export type PageChrome = { title: string; primaryAction: string }

export function shouldShowExitAction(screen: ScreenName): boolean {
  return ['observation', 'clueSelect', 'answering', 'wrongReview', 'reveal', 'story', 'memory', 'archive'].includes(screen)
}

export function getPageChrome(screen: ScreenName, copy: ContentCopy): PageChrome {
  switch (screen) {
    case 'landing': return { title: copy.landingTitle, primaryAction: copy.startAction }
    case 'intro': return { title: copy.introTitle, primaryAction: copy.introAction }
    case 'modeSelect': return { title: copy.modeTitle, primaryAction: copy.dailyMode }
    case 'observation': return { title: copy.brand, primaryAction: copy.clueAction }
    case 'clueSelect': return { title: copy.brand, primaryAction: copy.submitAction }
    case 'answering': return { title: copy.brand, primaryAction: copy.submitAction }
    case 'wrongReview': return { title: copy.subtitle, primaryAction: copy.retryAction }
    case 'reveal': return { title: copy.subtitle, primaryAction: copy.nextAction }
    case 'story': return { title: copy.factsTitle, primaryAction: copy.nextAction }
    case 'memory': return { title: copy.cluesTitle, primaryAction: copy.submitAction }
    case 'archive': return { title: copy.collectionTitle, primaryAction: copy.nextAction }
    case 'setComplete': return { title: copy.collectionTitle, primaryAction: copy.collectionAction }
    case 'collection':
    case 'artifactDetail': return { title: copy.collectionTitle, primaryAction: copy.continueAction }
    case 'summary': return { title: copy.summaryTitle, primaryAction: copy.collectionTitle }
    case 'error': return { title: copy.errorTitle, primaryAction: copy.resetAction }
  }
}
