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

  it('requires the formal SHBTI identity and Chinese dimension display names', () => {
    const content = validateContent(rawContent)
    expect(content.content.experience.identity).toEqual({
      formalName: 'SHBTI｜山海兽格测试',
      englishExpansion: 'Shan Hai Beast Temperament Indicator',
      chineseMeaning: '山海异兽性格倾向指标',
      boundary: '娱乐性自我探索工具，不是专业心理测评。',
    })
    expect(content.content.dimensions.map((item) => item.displayName)).toEqual([
      '与世界相遇', '理解线索', '衡量选择', '面对变化',
    ])
  })

  it('rejects a dimension with missing Chinese pole copy', () => {
    const broken = structuredClone(rawContent) as unknown as {
      content: { dimensions: Array<{ poles: Array<{ name?: string }> }> }
    }
    delete broken.content.dimensions[0]!.poles[0]!.name

    expect(() => validateContent(broken)).toThrow(/dimensions\[0\]\.poles\[0\]\.name/)
  })

  it('rejects duplicate or missing dimension codes', () => {
    const broken = structuredClone(rawContent)
    broken.content.dimensions[1]!.code = 'RH'

    expect(() => validateContent(broken)).toThrow(/duplicate dimension RH/)
    expect(() => validateContent(broken)).toThrow(/missing dimension TV/)
  })

  it('rejects a pole code that does not belong to its dimension', () => {
    const broken = structuredClone(rawContent)
    broken.content.dimensions[0]!.poles[1]!.code = 'R'

    expect(() => validateContent(broken)).toThrow(/poles\[1\]\.code: expected H/)
  })

  it('requires three unique quiz and result guide topics', () => {
    const guide = validateContent(rawContent).content.experience.guide
    expect(guide.quizCompanion.topics).toHaveLength(3)
    expect(guide.resultHelp.topics).toHaveLength(3)
    expect(new Set(guide.quizCompanion.topics.map((item) => item.id)).size).toBe(3)
    expect(new Set(guide.resultHelp.topics.map((item) => item.id)).size).toBe(3)
  })

  it('accepts a four-action question schema with light and strong preferences', () => {
    expect(() => validateContent(rawContent)).not.toThrow()
  })

  it('rejects four actions when a pole lacks either a light or strong preference', () => {
    const broken = structuredClone(rawContent)
    broken.content.questions[0]!.options[2]!.score.weight = 2

    expect(() => validateContent(broken)).toThrow(/one light and one strong option per pole/)
  })

  it('rejects duplicate action text within a question', () => {
    const broken = structuredClone(rawContent)
    broken.content.questions[0]!.options[1]!.text = broken.content.questions[0]!.options[0]!.text

    expect(() => validateContent(broken)).toThrow(/action text must be unique/)
  })

  it('requires the three-step Wenshan guide copy in the content package', () => {
    const broken = structuredClone(rawContent) as unknown as {
      content: { experience: { guide?: unknown } }
    }
    delete broken.content.experience.guide

    expect(() => validateContent(broken)).toThrow(/\$\.content\.experience\.guide/)
  })

  it('requires complete Wenshan journey copy for all four chapters', () => {
    const broken = structuredClone(rawContent) as unknown as {
      content: { experience: { guide: { chapterStart?: Record<string, string> } } }
    }
    delete broken.content.experience.guide.chapterStart?.trace

    expect(() => validateContent(broken)).toThrow(/guide\.chapterStart\.trace/)
  })

  it('requires result help and distinct recovery branches', () => {
    const broken = structuredClone(rawContent) as unknown as {
      content: { experience: { guide: { resultHelp?: { topics?: Array<{ answer?: string }> }; recovery?: Record<string, string>; recoveryActions?: Record<string, string> } } }
    }
    delete broken.content.experience.guide.resultHelp?.topics?.[1]?.answer
    delete broken.content.experience.guide.recovery?.storageUnavailable
    delete broken.content.experience.guide.recoveryActions?.storageCleared

    expect(() => validateContent(broken)).toThrow(/guide\.resultHelp\.topics\[1\]\.answer/)
    expect(() => validateContent(broken)).toThrow(/guide\.recovery\.storageUnavailable/)
    expect(() => validateContent(broken)).toThrow(/guide\.recoveryActions\.storageCleared/)
  })

  it('requires structured placeholders in the resume guide line', () => {
    const broken = structuredClone(rawContent)
    broken.content.experience.guide.landing.resume = '旧卷仍在案上。'

    expect(() => validateContent(broken)).toThrow(/landing\.resume.*\{chapter\}.*\{current\}/)
  })

  it('keeps Wenshan copy neutral and non-diagnostic', () => {
    expect(JSON.stringify(rawContent.content.experience.guide)).not.toMatch(/吉凶|命定|治愈|治疗|更聪明|更优秀|能力更强/)
  })

  it('rejects Wenshan copy that diagnoses or ranks the participant', () => {
    const broken = structuredClone(rawContent) as unknown as {
      content: { experience: { guide: { intro: string[] } } }
    }
    broken.content.experience.guide.intro[0] = '这个选择证明你更优秀。'

    expect(() => validateContent(broken)).toThrow(/guide.*neutral/i)
  })

  it('requires landing and intro business copy outside JSX', () => {
    const broken = structuredClone(rawContent) as unknown as {
      content: { experience: { surfaces?: unknown } }
    }
    delete broken.content.experience.surfaces

    expect(() => validateContent(broken)).toThrow(/\$\.content\.experience\.surfaces/)
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
    expect(new Set(optionIds).size).toBe(192)
    expect(new Set(typeCodes).size).toBe(16)
    expect(new Set(creatureIds).size).toBe(16)
  })

  it('offers four distinct actions with one light and one strong score for each pole', () => {
    const polesByDimension = {
      RH: ['R', 'H'],
      TV: ['T', 'V'],
      LE: ['L', 'E'],
      SM: ['S', 'M'],
    } as const

    for (const question of rawContent.content.questions) {
      expect(question.options).toHaveLength(4)
      for (const pole of polesByDimension[question.primaryDimension as keyof typeof polesByDimension]) {
        expect(
          question.options
            .filter((option) => option.score.pole === pole)
            .map((option) => option.score.weight)
            .sort(),
        ).toEqual([1, 2])
      }
    }
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

  it('gives every beast type a substantial long-scroll profile and three shareable lines', () => {
    for (const result of rawContent.content.resultTypes as unknown as Array<Record<string, unknown>>) {
      expect(result.longPortrait).toEqual([
        expect.stringMatching(/.{45,}/u),
        expect.stringMatching(/.{45,}/u),
      ])
      expect(result.innerDrive).toEqual(expect.stringMatching(/.{24,}/u))
      expect(result.misreadAs).toEqual(expect.stringMatching(/.{20,}/u))
      expect(result.journeyScenes).toMatchObject({
        arrival: expect.stringMatching(/.{28,}/u),
        disagreement: expect.stringMatching(/.{28,}/u),
        change: expect.stringMatching(/.{28,}/u),
      })
      expect(result.relationshipNeed).toEqual(expect.stringMatching(/.{24,}/u))
      expect(result.growthPractice).toEqual(expect.stringMatching(/.{24,}/u))
      expect(result.wenshanNote).toEqual(expect.stringMatching(/.{18,}/u))
      expect(result.shareQuotes).toEqual([
        expect.stringMatching(/.{12,}/u),
        expect.stringMatching(/.{12,}/u),
        expect.stringMatching(/.{12,}/u),
      ])
      expect(new Set(result.shareQuotes as string[]).size).toBe(3)
    }
  })

  it('rejects a result type with an incomplete long-scroll profile', () => {
    const broken = structuredClone(rawContent) as unknown as {
      content: { resultTypes: Array<Record<string, unknown>> }
    }
    delete broken.content.resultTypes[0]!.journeyScenes

    expect(() => validateContent(broken)).toThrow(/resultTypes\[0\]\.journeyScenes/)
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
