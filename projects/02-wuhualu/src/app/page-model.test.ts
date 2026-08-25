import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { getPageChrome, shouldShowExitAction, type ScreenName } from './page-model.ts'

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
    expect(getPageChrome('reveal', copy)).toMatchObject({ guidePresentation: 'stage' })
    expect(getPageChrome('setComplete', copy)).toMatchObject({ guidePresentation: 'stage' })
    expect(getPageChrome('observation', copy)).toMatchObject({ guidePresentation: 'compact' })
    expect(getPageChrome('modeSelect', copy)).toMatchObject({ guidePresentation: 'compact' })
  })
})
