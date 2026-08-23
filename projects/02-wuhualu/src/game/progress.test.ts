import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { createQuizQuestion, isQuizGenerationError } from './quiz.ts'
import { evaluateGuess, revealNextClue } from './progress.ts'

const content = parseContent(rawContent)
const questionResult = createQuizQuestion(content.content.artifacts[0], content.content.distractorCandidates, 'progress')
if (isQuizGenerationError(questionResult)) throw new Error(questionResult.message)
const question = questionResult

describe('clue progression', () => {
  it('reveals clues in level order and stops after the third', () => {
    const first = revealNextClue(question, [])
    const second = revealNextClue(question, first)
    const third = revealNextClue(question, second)
    expect(first).toEqual([question.clues[0].id])
    expect(second).toEqual([question.clues[0].id, question.clues[1].id])
    expect(third).toEqual(question.clues.map(({ id }) => id))
    expect(revealNextClue(question, third)).toBe(third)
  })
})

describe('answer evaluation', () => {
  it.each([
    { additionalClues: 0, stars: 3, points: 300 },
    { additionalClues: 1, stars: 2, points: 200 },
    { additionalClues: 2, stars: 1, points: 100 },
    { additionalClues: 8, stars: 1, points: 100 },
  ] as const)('awards $stars stars after $additionalClues extra clues', ({ additionalClues, stars, points }) => {
    const result = evaluateGuess(question, question.correctOptionId, additionalClues, 0)
    expect(result.stars).toBe(stars)
    expect(result.points).toBe(points)
    expect(result.nextStreak).toBe(1)
  })

  it('adds a bounded streak bonus and resets streak for a wrong answer', () => {
    expect(evaluateGuess(question, question.correctOptionId, 0, 3).points).toBe(330)
    const wrong = question.options.find(({ isCorrect }) => !isCorrect)
    if (!wrong) throw new Error('fixture requires a wrong option')
    expect(evaluateGuess(question, wrong.id, 0, 3)).toMatchObject({ correct: false, points: 0, nextStreak: 0 })
  })
})
