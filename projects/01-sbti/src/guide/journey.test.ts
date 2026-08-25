import { describe, expect, it } from 'vitest'
import { advanceInterlude, chapterPosition } from './journey'

describe('chapterPosition', () => {
  it.each([
    [1, 'entry'],
    [7, 'trace'],
    [13, 'change'],
    [19, 'return'],
  ] as const)('marks question %i as the start of %s', (current, chapter) => {
    expect(chapterPosition(current)).toMatchObject({ chapter, isStart: true, isEnd: false })
  })

  it.each([
    [6, 'entry'],
    [12, 'trace'],
    [18, 'change'],
    [24, 'return'],
  ] as const)('marks question %i as the end of %s', (current, chapter) => {
    expect(chapterPosition(current)).toMatchObject({ chapter, isStart: false, isEnd: true })
  })

  it('rejects a question number outside the 24-question journey', () => {
    expect(() => chapterPosition(0)).toThrow(RangeError)
    expect(() => chapterPosition(25)).toThrow(RangeError)
    expect(() => chapterPosition(1.5)).toThrow(RangeError)
  })
})

describe('advanceInterlude', () => {
  it.each([
    [6, 'entry', 'trace'],
    [12, 'trace', 'change'],
    [18, 'change', 'return'],
  ] as const)('creates an end-to-start transition after question %i', (current, chapter, nextChapter) => {
    expect(advanceInterlude(current)).toEqual({ chapter, nextChapter })
  })

  it('does not create a normal chapter transition after question 24', () => {
    expect(advanceInterlude(24)).toBeUndefined()
  })
})
