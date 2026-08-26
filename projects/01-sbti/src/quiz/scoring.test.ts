import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import type { PoleCode } from '../content/types'
import { prepareQuestionsForRun, selectQuestionIds } from './selection'
import {
  calculateProgress,
  determineTypeCode,
  generateQuizResult,
  generateShareCardViewModel,
  isQuestionAnswered,
  recordAnswer,
  resetQuiz,
} from './scoring'

const content = validateContent(rawContent)

function answersForCode(questionIds: string[], code: string) {
  const wanted = new Set<PoleCode>(code.split('') as PoleCode[])
  return questionIds.map((questionId) => {
    const question = content.content.questions.find((item) => item.id === questionId)!
    return { questionId, optionId: question.options.find((option) => wanted.has(option.score.pole) && option.score.weight === 2)!.id }
  })
}

function balancedAnswers(questionIds: string[]) {
  const polesByDimension = {
    RH: ['R', 'H'],
    TV: ['T', 'V'],
    LE: ['L', 'E'],
    SM: ['S', 'M'],
  } as const

  return ['RH', 'TV', 'LE', 'SM'].flatMap((dimension) => {
    const questions = questionIds
      .map((id) => content.content.questions.find((item) => item.id === id)!)
      .filter((item) => item.primaryDimension === dimension)
    const [leftPole, rightPole] = polesByDimension[dimension as keyof typeof polesByDimension]
    return questions.map((question, index) => ({
      questionId: question.id,
      optionId: question.options.find((option) => option.score.pole === (index < 3 ? leftPole : rightPole) && option.score.weight === 2)!.id,
    }))
  })
}

describe('seeded question selection', () => {
  it('returns the same balanced 24-question journey for the same seed', () => {
    const first = selectQuestionIds(content, 'seed-alpha')
    const second = selectQuestionIds(content, 'seed-alpha')
    const questions = first.map((id) => content.content.questions.find((item) => item.id === id)!)

    expect(first).toEqual(second)
    expect(first).toHaveLength(24)
    for (const chapter of ['entry', 'trace', 'change', 'return']) {
      expect(questions.filter((item) => item.chapterId === chapter)).toHaveLength(6)
    }
    for (const dimension of ['RH', 'TV', 'LE', 'SM']) {
      expect(questions.filter((item) => item.primaryDimension === dimension)).toHaveLength(6)
    }
    expect(content.content.tieBreakers.every((item) => first.includes(item.questionId))).toBe(true)
    expect(questions.every((item, index) => index === 0 || item.primaryDimension !== questions[index - 1]!.primaryDimension)).toBe(true)
  })

  it('prepares a stable option order without positional score leakage', () => {
    expect(prepareQuestionsForRun).toBeTypeOf('function')
    const questionIds = selectQuestionIds(content, 'position-balance-seed')
    const first = prepareQuestionsForRun!(content, questionIds, 'position-balance-seed')
    const second = prepareQuestionsForRun!(content, questionIds, 'position-balance-seed')

    expect(first).toEqual(second)
    expect(first.map((question) => question.id)).toEqual(questionIds)
    for (const dimension of ['RH', 'TV', 'LE', 'SM']) {
      const questions = first.filter((question) => question.primaryDimension === dimension)
      for (let position = 0; position < 4; position += 1) {
        const choices = questions.map((question) => question.options[position]!)
        expect(choices.filter((option) => option.score.weight === 1)).toHaveLength(3)
        expect(choices.filter((option) => option.score.weight === 2)).toHaveLength(3)
        expect(new Set(choices.map((option) => option.score.pole))).toHaveLength(2)
        expect(choices.filter((option) => option.score.pole === choices[0]!.score.pole).length).toBe(3)
      }
    }
  })
})

describe('quiz scoring', () => {
  const questionIds = selectQuestionIds(content, 'scoring-seed')

  it('replaces an answer without accumulating a duplicate', () => {
    const question = content.content.questions.find((item) => item.id === questionIds[0])!
    const first = recordAnswer([], question.id, question.options[0].id, content)
    const replaced = recordAnswer(first, question.id, question.options[1].id, content)

    expect(replaced).toEqual([{ questionId: question.id, optionId: question.options[1].id }])
    expect(isQuestionAnswered(replaced, question.id)).toBe(true)
    expect(calculateProgress(questionIds, replaced)).toEqual({ answered: 1, total: 24, percent: 4 })
  })

  it('rejects illegal question and option IDs', () => {
    expect(() => recordAnswer([], 'question-missing', 'option-missing', content)).toThrow(/Unknown question/)
    expect(() => recordAnswer([], questionIds[0]!, 'option-missing', content)).toThrow(/Unknown option/)
  })

  it('refuses to generate a formal result from incomplete answers', () => {
    expect(() => generateQuizResult(questionIds, [], content)).toThrow(/24 answered questions/)
  })

  it('uses the frozen tie-breaker answer deterministically', () => {
    const answers = answersForCode(questionIds, 'RTLS')
    for (const dimension of ['RH', 'TV', 'LE', 'SM']) {
      const dimensionQuestions = questionIds.filter((id) => content.content.questions.find((item) => item.id === id)!.primaryDimension === dimension)
      const tieId = content.content.tieBreakers.find((item) => item.dimension === dimension)!.questionId
      dimensionQuestions.filter((id) => id !== tieId).slice(0, 3).forEach((id) => {
        const question = content.content.questions.find((item) => item.id === id)!
        const current = answers.find((item) => item.questionId === id)!
        const currentOption = question.options.find((option) => option.id === current.optionId)!
        current.optionId = question.options.find((option) => option.score.pole !== currentOption.score.pole && option.score.weight === 2)!.id
      })
    }

    const result = generateQuizResult(questionIds, answers, content)
    expect(result.summary.dimensions.every((item) => item.isBalanced)).toBe(true)
    expect(determineTypeCode(questionIds, answers, content)).toBe('RTLS')
    expect(determineTypeCode(questionIds, structuredClone(answers), content)).toBe('RTLS')
  })

  it('keeps an exact four-dimension balance explicit while choosing a deterministic main type', () => {
    const answers = balancedAnswers(questionIds)
    const first = generateQuizResult(questionIds, answers, content)
    const second = generateQuizResult(questionIds, structuredClone(answers), content)

    expect(first).toEqual(second)
    expect(first.summary.dimensions).toHaveLength(4)
    expect(first.summary.dimensions.every((item) => item.isBalanced)).toBe(true)
    expect(first.summary.dimensions.every((item) => item.strength === 0 && item.label === '游移')).toBe(true)
    expect(first.summary.neighborCode).not.toBe(first.code)
  })

  it.each([
    ['明显偏向', 'RTLS', '陆吾'],
    ['反向偏向', 'HVEM', '九尾狐'],
    ['混合边界', 'HVLS', '开明兽'],
  ])('completes the %s end-to-end simulation', (_name, code, creatureName) => {
    const result = generateQuizResult(questionIds, answersForCode(questionIds, code), content)
    expect(result.code).toBe(code)
    expect(result.summary.creatureName).toBe(creatureName)
    expect(generateQuizResult(questionIds, answersForCode(questionIds, code), content)).toEqual(result)
  })

  it('makes all 16 frozen result types reachable', () => {
    for (const type of content.content.resultTypes) {
      expect(determineTypeCode(questionIds, answersForCode(questionIds, type.code), content)).toBe(type.code)
    }
  })

  it('builds a complete share-card view model', () => {
    const result = generateQuizResult(questionIds, answersForCode(questionIds, 'RVEM'), content)
    expect(generateShareCardViewModel(result)).toEqual(expect.objectContaining({
      code: 'RVEM',
      creatureName: '凤凰',
      typeName: '丹歌型',
      title: expect.any(String),
      line: expect.any(String),
      disclaimer: expect.any(String),
      artAssetId: 'creature-fenghuang',
    }))
  })

  it('resets a run to the first question with no retained answers', () => {
    expect(resetQuiz('fresh-seed', questionIds)).toEqual({
      seed: 'fresh-seed',
      questionIds,
      currentIndex: 0,
      answers: [],
    })
  })
})
