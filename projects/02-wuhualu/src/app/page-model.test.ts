import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { getPageChrome, pageScrollScope, shouldShowExitAction, type ScreenName } from './page-model.ts'

const copy = parseContent(rawContent).content.copy

describe('semantic page model', () => {
  it('gives every required screen a title and primary action from content copy', () => {
    const screens: ScreenName[] = [
      'landing', 'intro', 'modeSelect', 'observation', 'clueSelect', 'answering',
      'wrongReview', 'reveal', 'story', 'memory', 'archive', 'setComplete',
      'collection', 'artifactDetail', 'summary', 'error',
    ]
    for (const screen of screens) {
      const chrome = getPageChrome(screen, copy)
      expect(chrome.title.trim().length, screen).toBeGreaterThan(0)
      expect(chrome.primaryAction.trim().length, screen).toBeGreaterThan(0)
    }
  })

  it('only exposes the round-exit action during active play', () => {
    expect(shouldShowExitAction('observation')).toBe(true)
    expect(shouldShowExitAction('story')).toBe(true)
    expect(shouldShowExitAction('intro')).toBe(false)
    expect(shouldShowExitAction('collection')).toBe(false)
    expect(shouldShowExitAction('summary')).toBe(false)
  })

  it('reserves large guide dialogue for key narrative screens', () => {
    expect(getPageChrome('wrongReview', copy)).toMatchObject({ guidePresentation: 'stage' })
    expect(getPageChrome('reveal', copy)).toMatchObject({ guidePresentation: 'compact' })
    expect(getPageChrome('setComplete', copy)).toMatchObject({ guidePresentation: 'stage' })
    expect(getPageChrome('observation', copy)).toMatchObject({ guidePresentation: 'compact' })
    expect(getPageChrome('modeSelect', copy)).toMatchObject({ guidePresentation: 'compact' })
  })

  it('keeps observation, clue, and answer interactions in one scroll scope per artifact', () => {
    expect(pageScrollScope({ screen: 'observation', session: { index: 2 } })).toBe('case:2')
    expect(pageScrollScope({ screen: 'clueSelect', session: { index: 2 } })).toBe('case:2')
    expect(pageScrollScope({ screen: 'answering', session: { index: 2 } })).toBe('case:2')
    expect(pageScrollScope({ screen: 'observation', session: { index: 3 } })).toBe('case:3')
    expect(pageScrollScope({ screen: 'artifactDetail', artifactId: 'artifact-eagle-tripod' })).toBe('artifactDetail:artifact-eagle-tripod')
  })
})
