import { describe, expect, it } from 'vitest'
import { completeInterlude, initialInterlude, requestAdvanceInterlude } from './interludeState'

describe('quiz interlude state', () => {
  it('shows a repeatable start interlude when mounting on a chapter boundary', () => {
    expect(initialInterlude(1)).toEqual({ mode: 'start', chapter: 'entry' })
    expect(initialInterlude(7)).toEqual({ mode: 'start', chapter: 'trace' })
    expect(initialInterlude(9)).toBeUndefined()
  })

  it('creates an end interlude only when advancing from questions 6, 12, and 18', () => {
    expect(requestAdvanceInterlude(6)).toEqual({ mode: 'end', chapter: 'entry', nextChapter: 'trace' })
    expect(requestAdvanceInterlude(9)).toBeUndefined()
    expect(requestAdvanceInterlude(24)).toBeUndefined()
  })

  it('does not replay a completed chapter transition after backtracking', () => {
    expect(requestAdvanceInterlude(6, new Set([6]))).toBeUndefined()
    expect(requestAdvanceInterlude(12, new Set([6]))).toEqual({ mode: 'end', chapter: 'trace', nextChapter: 'change' })
  })

  it('advances after an end interlude and then opens the next chapter', () => {
    expect(completeInterlude({ mode: 'end', chapter: 'entry', nextChapter: 'trace' })).toEqual({
      shouldAdvance: true,
      next: { mode: 'start', chapter: 'trace' },
    })
  })

  it('closes a start interlude without advancing the question', () => {
    expect(completeInterlude({ mode: 'start', chapter: 'trace' })).toEqual({ shouldAdvance: false, next: undefined })
  })
})
