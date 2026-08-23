import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import { ContentValidationError, validateContent } from './validate'

const ALL_TYPE_CODES = [
  'RTLS', 'RTLM', 'RTES', 'RTEM',
  'RVLS', 'RVLM', 'RVES', 'RVEM',
  'HTLS', 'HTLM', 'HTES', 'HTEM',
  'HVLS', 'HVLM', 'HVES', 'HVEM',
]

describe('production content package', () => {
  it('contains the complete launch inventory', () => {
    expect(rawContent.content.questions).toHaveLength(48)
    expect(rawContent.content.resultTypes).toHaveLength(16)
    expect(rawContent.content.creatures).toHaveLength(16)
    expect(rawContent.content.resultTypes.map((item) => item.code).sort()).toEqual(
      [...ALL_TYPE_CODES].sort(),
    )
  })

  it('returns a typed production package when every reference is valid', () => {
    expect(validateContent(rawContent).content.questions).toHaveLength(48)
  })

  it('reports the JSON path of an invalid dimension score', () => {
    const broken = structuredClone(rawContent) as unknown as {
      content: { questions: Array<{ options: Array<{ score: { dimension: string } }> }> }
    }
    broken.content.questions[0]!.options[0]!.score.dimension = 'BAD'

    expect(() => validateContent(broken)).toThrowError(ContentValidationError)
    expect(() => validateContent(broken)).toThrow(/\$\.content\.questions\[0\]\.options\[0\]\.score\.dimension/)
  })

  it('uses unique stable question, option, type, and creature identifiers', () => {
    const questionIds = rawContent.content.questions.map((item) => item.id)
    const optionIds = rawContent.content.questions.flatMap((item) => item.options.map((option) => option.id))
    const typeCodes = rawContent.content.resultTypes.map((item) => item.code)
    const creatureIds = rawContent.content.creatures.map((item) => item.id)

    expect(new Set(questionIds).size).toBe(48)
    expect(new Set(optionIds).size).toBe(96)
    expect(new Set(typeCodes).size).toBe(16)
    expect(new Set(creatureIds).size).toBe(16)
  })

  it('covers every chapter and dimension cell with three questions', () => {
    for (const chapter of ['entry', 'trace', 'change', 'return']) {
      for (const dimension of ['RH', 'TV', 'LE', 'SM']) {
        expect(rawContent.content.questions.filter(
          (question) => question.chapterId === chapter && question.primaryDimension === dimension,
        )).toHaveLength(3)
      }
    }
  })

  it('gives every type a mapped beast and complete share copy', () => {
    const creatureIds = new Set(rawContent.content.creatures.map((item) => item.id))
    for (const result of rawContent.content.resultTypes) {
      expect(creatureIds.has(result.creatureId)).toBe(true)
      expect(result.shareTitle.length).toBeGreaterThan(0)
      expect(result.shareLine.length).toBeGreaterThan(0)
      expect(result.artAssetId).toMatch(/^creature-[a-z][a-z0-9-]*$/)
    }
  })

  it('balances both poles across the first option position', () => {
    for (const [dimension, left, right] of [['RH', 'R', 'H'], ['TV', 'T', 'V'], ['LE', 'L', 'E'], ['SM', 'S', 'M']]) {
      const questions = rawContent.content.questions.filter((item) => item.primaryDimension === dimension)
      const leftCount = questions.filter((item) => item.options[0].score.pole === left).length
      const rightCount = questions.filter((item) => item.options[0].score.pole === right).length
      expect(Math.abs(leftCount - rightCount)).toBeLessThanOrEqual(2)
    }
  })

  it('rejects a tie-breaker that points at another dimension', () => {
    const broken = structuredClone(rawContent)
    broken.content.tieBreakers[0]!.questionId = 'question-two-signposts'
    expect(() => validateContent(broken)).toThrow(/\$\.content\.tieBreakers\[0\]\.questionId.*RH/)
  })
})
