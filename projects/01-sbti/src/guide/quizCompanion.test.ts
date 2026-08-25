import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { deriveQuizCompanionLine } from './quizCompanion'

const copy = validateContent(rawContent).content.experience.guide.quizCompanion

describe('quiz companion line', () => {
  it('uses opening, middle, and closing copy by position in each volume', () => {
    expect(deriveQuizCompanionLine({ chapter: 'entry', current: 1, selected: false, revisiting: false }, copy)).toBe(copy.phase.entry.opening)
    expect(deriveQuizCompanionLine({ chapter: 'entry', current: 3, selected: false, revisiting: false }, copy)).toBe(copy.phase.entry.middle)
    expect(deriveQuizCompanionLine({ chapter: 'entry', current: 6, selected: false, revisiting: false }, copy)).toBe(copy.phase.entry.closing)
    expect(deriveQuizCompanionLine({ chapter: 'trace', current: 7, selected: false, revisiting: false }, copy)).toBe(copy.phase.trace.opening)
  })

  it('prioritizes revisiting and selected states over volume position', () => {
    expect(deriveQuizCompanionLine({ chapter: 'trace', current: 8, selected: true, revisiting: false }, copy)).toBe(copy.selected)
    expect(deriveQuizCompanionLine({ chapter: 'trace', current: 7, selected: true, revisiting: true }, copy)).toBe(copy.revisiting)
  })
})
