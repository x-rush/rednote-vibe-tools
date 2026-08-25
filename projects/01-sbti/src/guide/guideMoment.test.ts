import { describe, expect, it } from 'vitest'
import { deriveGuideMoment } from './guideMoment'

describe('deriveGuideMoment', () => {
  it('prioritizes recovery over every other guide surface', () => {
    expect(deriveGuideMoment({
      screen: 'error',
      recoveryReason: 'storage',
      guideUnseen: true,
      requestedHelp: 'quiz',
      revealStep: 'reading',
    })).toEqual({ kind: 'recovery', reason: 'storage' })
  })

  it('prioritizes the first guide over landing resume and recent-result copy', () => {
    expect(deriveGuideMoment({
      screen: 'landing',
      guideUnseen: true,
      introStep: 1,
      hasProgress: true,
      hasRecentResult: true,
      chapter: 'trace',
      current: 9,
    })).toEqual({ kind: 'intro', step: 1 })
  })

  it('prefers an active volume over a recent result on landing', () => {
    expect(deriveGuideMoment({
      screen: 'landing',
      hasProgress: true,
      hasRecentResult: true,
      chapter: 'trace',
      current: 9,
    })).toEqual({ kind: 'landing-resume', chapter: 'trace', current: 9 })
  })

  it('falls back from recent result to a fresh landing moment', () => {
    expect(deriveGuideMoment({ screen: 'landing', hasRecentResult: true })).toEqual({ kind: 'landing-recent' })
    expect(deriveGuideMoment({ screen: 'landing' })).toEqual({ kind: 'landing-fresh' })
  })

  it('returns no passive guide moment on an ordinary quiz question', () => {
    expect(deriveGuideMoment({ screen: 'quiz', chapter: 'trace', current: 9 })).toBeUndefined()
  })

  it('derives explicit help, interlude, and reveal moments', () => {
    expect(deriveGuideMoment({ screen: 'quiz', requestedHelp: 'quiz' })).toEqual({ kind: 'quiz-help' })
    expect(deriveGuideMoment({ screen: 'quiz', interlude: { mode: 'end', chapter: 'entry' } })).toEqual({ kind: 'chapter-end', chapter: 'entry' })
    expect(deriveGuideMoment({ screen: 'calculating', revealStep: 'complete' })).toEqual({ kind: 'reveal', step: 'complete' })
  })
})
