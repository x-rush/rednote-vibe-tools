import type { ContentCopy } from '../content/types.ts'

export type ScreenName =
  | 'landing'
  | 'intro'
  | 'modeSelect'
  | 'question'
  | 'clueRevealed'
  | 'answering'
  | 'feedback'
  | 'collection'
  | 'artifactDetail'
  | 'summary'
  | 'error'

export type PageChrome = { title: string; primaryAction: string }

export function shouldShowExitAction(screen: ScreenName): boolean {
  return screen === 'question' || screen === 'clueRevealed' || screen === 'answering' || screen === 'feedback'
}

export function getPageChrome(screen: ScreenName, copy: ContentCopy): PageChrome {
  switch (screen) {
    case 'landing': return { title: copy.landingTitle, primaryAction: copy.startAction }
    case 'intro': return { title: copy.introTitle, primaryAction: copy.introAction }
    case 'modeSelect': return { title: copy.modeTitle, primaryAction: copy.dailyMode }
    case 'question':
    case 'clueRevealed': return { title: copy.brand, primaryAction: copy.clueAction }
    case 'answering': return { title: copy.brand, primaryAction: copy.submitAction }
    case 'feedback': return { title: copy.subtitle, primaryAction: copy.nextAction }
    case 'collection':
    case 'artifactDetail': return { title: copy.collectionTitle, primaryAction: copy.continueAction }
    case 'summary': return { title: copy.summaryTitle, primaryAction: copy.collectionTitle }
    case 'error': return { title: copy.errorTitle, primaryAction: copy.resetAction }
  }
}
