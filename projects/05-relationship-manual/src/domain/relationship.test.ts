import { describe, expect, it } from 'vitest'
import { getRelationshipBank } from '../content/bank'
import type { QuestionnaireAnswer, RelationshipContext, RelationshipQuestion } from '../content/schema'
import { FORBIDDEN_LANGUAGE_PATTERNS, getValidatedContent } from '../content/validate'
import { applyAnswer, toggleOption, validateSelection } from './answers'
import { buildCardViewModel } from './card'
import { buildRelationshipProfile } from './profile'

const content = getValidatedContent()
const now = '2026-08-26T00:00:00.000Z'
const closeBank = getRelationshipBank(content, 'close-relationship')

function question(context: RelationshipContext, questionId: string) {
  return getRelationshipBank(content, context).questions.find((item) => item.questionId === questionId)!
}

function answer(questionId: string, ...optionIds: string[]): QuestionnaireAnswer {
  return { questionId, optionIds, skipped: false, updatedAt: now }
}

describe('questionnaire answers', () => {
  it('replaces a single answer and rejects more than one option', () => {
    const target = question('close-relationship', 'close-contact-busy')
    const first = applyAnswer([], target, ['close-contact-busy-brief'], now)
    const second = applyAnswer(first, target, ['close-contact-busy-important'], now)

    expect(second).toEqual([answer(target.questionId, 'close-contact-busy-important')])
    expect(validateSelection(target, ['close-contact-busy-brief', 'close-contact-busy-later']))
      .toEqual({ valid: false, error: 'too-many' })
  })

  it('enforces multi-select limits and removes duplicate selections', () => {
    const target = question('close-relationship', 'close-care-language')

    expect(validateSelection(target, ['close-care-language-action', 'close-care-language-action']))
      .toEqual({ valid: true, optionIds: ['close-care-language-action'] })
    expect(validateSelection(target, [
      'close-care-language-action', 'close-care-language-words', 'close-care-language-details',
    ])).toEqual({ valid: false, error: 'too-many' })
  })

  it('lets an exclusive option replace other multi-select choices', () => {
    const original = question('close-relationship', 'close-care-language')
    const target: RelationshipQuestion = {
      ...original,
      options: original.options.map((option, index) => ({ ...option, exclusive: index === 2 })),
    }

    expect(toggleOption(target, ['close-care-language-action'], 'close-care-language-details'))
      .toEqual(['close-care-language-details'])
    expect(toggleOption(target, ['close-care-language-details'], 'close-care-language-words'))
      .toEqual(['close-care-language-words'])
  })

  it('allows an explicit skip only when the question permits it', () => {
    const optional = question('close-relationship', 'close-contact-busy')
    const required = { ...optional, skipRule: { allowed: false, reason: 'required fixture' } }

    expect(validateSelection(optional, [], true)).toEqual({ valid: true, optionIds: [] })
    expect(validateSelection(required, [], true)).toEqual({ valid: false, error: 'cannot-skip' })
  })
})

describe('relationship-specific profile and card', () => {
  const contexts: RelationshipContext[] = ['close-relationship', 'friendship', 'family']
  const prefixes: Record<RelationshipContext, string> = {
    'close-relationship': 'close-',
    friendship: 'friend-',
    family: 'family-',
  }

  it.each(contexts)('builds a seven-section %s card from only its own bank', (context) => {
    const bank = getRelationshipBank(content, context)
    const selected = bank.questions.map((item) => answer(item.questionId, item.options[0]!.optionId))
    const profile = buildRelationshipProfile(content, context, selected, now)
    const card = buildCardViewModel(content, profile, context)

    expect(card.sections).toHaveLength(7)
    expect(profile.relationshipContext).toBe(context)
    expect(profile.selectedTextKeys.every((key) => key.startsWith(prefixes[context]))).toBe(true)
    expect(card.sections.flatMap((section) => section.paragraphSourceTextKeys)
      .filter((key): key is string => key !== null)
      .every((key) => key.startsWith(prefixes[context]))).toBe(true)
    expect(card.relationshipLabel).toBe(content.content.cardRules.relationshipLabels[context])
  })

  it('ignores an answer from another relationship bank', () => {
    const foreignQuestion = getRelationshipBank(content, 'friendship').questions[0]!
    const profile = buildRelationshipProfile(content, 'family', [
      answer(foreignQuestion.questionId, foreignQuestion.options[0]!.optionId),
    ], now)

    expect(profile.answers).toEqual([])
    expect(profile.selectedTextKeys).toEqual([])
  })

  it('keeps tied top preferences instead of choosing one arbitrarily', () => {
    const profile = buildRelationshipProfile(content, 'close-relationship', [
      answer('close-care-language', 'close-care-language-action', 'close-care-language-words'),
    ], now)

    expect(profile.priorityDimensionIds).toEqual(['care-action', 'care-words'])
    expect(profile.scores.filter((score) => score.rank === 1).every((score) => score.tied)).toBe(true)
  })

  it('keeps every supported result from a valid multi-select answer', () => {
    const profile = buildRelationshipProfile(content, 'close-relationship', [
      answer('close-care-language', 'close-care-language-action', 'close-care-language-words'),
    ], now)
    const careText = buildCardViewModel(content, profile, 'close-relationship')
      .sections.find((section) => section.sectionId === 'care')?.paragraphs.join('') ?? ''

    expect(profile.selectedTextKeys).toEqual(expect.arrayContaining([
      'close-care-language-action-result',
      'close-care-language-words-result',
    ]))
    expect(careText).toMatch(/实际行动/u)
    expect(careText).toMatch(/在意与肯定/u)
  })

  it('returns a usable neutral profile and summary when there are no answers', () => {
    const profile = buildRelationshipProfile(content, 'friendship', [], now)
    const card = buildCardViewModel(content, profile, 'friendship')

    expect(profile.selectedTextKeys).toEqual([])
    expect(card.sections.every((section) => section.paragraphs.length > 0)).toBe(true)
    expect(card.shareSummary).toBe(content.content.cardRules.neutralSummary)
  })

  it('builds the frozen seven chapters with both need and action responsibilities', () => {
    const profile = buildRelationshipProfile(content, 'family', [], now)
    const card = buildCardViewModel(content, profile, 'family')

    expect(card.sections.map((section) => section.sectionId)).toEqual([
      'contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair',
    ])
    for (const section of card.sections) {
      expect(section.paragraphRoles).toContain('need')
      expect(section.paragraphRoles).toContain('action')
    }
  })

  it('assigns stable semantic IDs to generated card paragraphs', () => {
    const profile = buildRelationshipProfile(content, 'close-relationship', [
      answer('close-listening-first-response', 'close-listening-first-response-validate'),
    ], now)
    const card = buildCardViewModel(content, profile, 'close-relationship')

    expect(card.sections.find((section) => section.sectionId === 'listening')?.paragraphIds)
      .toContain('text:close-listening-first-response-validate-result')
  })

  it.each([
    {
      name: '倾听优先',
      input: ['close-listening-first-response', 'close-listening-first-response-validate'],
      section: 'listening',
      expected: '先承认我正在经历的感受',
    },
    {
      name: '建议自主',
      input: ['close-listening-first-response', 'close-listening-first-response-ask-mode'],
      section: 'listening',
      expected: '先问我此刻更需要',
    },
    {
      name: '安静空间',
      input: ['close-space-checkin', 'close-space-checkin-none'],
      section: 'space',
      expected: '约定的独处时间',
    },
    {
      name: '明确边界',
      input: ['close-boundary-intimacy', 'close-boundary-intimacy-no-pressure'],
      section: 'boundary',
      expected: '请不要反复追问',
    },
    {
      name: '修复行动',
      input: ['close-repair-change', 'close-repair-change-plan'],
      section: 'repair',
      expected: '具体、做得到的改变',
    },
  ] as const)('turns golden input $name into a final card', ({ input, section, expected }) => {
    const profile = buildRelationshipProfile(content, 'close-relationship', [answer(input[0], input[1])], now)
    const card = buildCardViewModel(content, profile, 'close-relationship')
    const paragraph = card.sections.find((item) => item.sectionId === section)?.paragraphs.join('') ?? ''

    expect(paragraph).toContain(expected)
    expect(card.relationshipLabel).toBe('亲密关系')
  })

  it('keeps quiet presence in the selected result without turning it into solitude', () => {
    const profile = buildRelationshipProfile(content, 'close-relationship', [
      answer('close-space-checkin', 'close-space-checkin-nearby'),
    ], now)
    const card = buildCardViewModel(content, profile, 'close-relationship')
    const space = card.sections.find((section) => section.sectionId === 'space')!.paragraphs.join('')

    expect(space).toContain('安静留在附近')
    expect(space).not.toContain('完整独处')
  })

  it('uses relationship-specific fallbacks for unanswered sections', () => {
    const expected = {
      'close-relationship': '我希望亲密关系里的联系有回应，也允许彼此忙碌。',
      friendship: '我希望友情里的联系不必频繁，却能在重要时刻得到回应。',
      family: '我希望家人的联系能落下牵挂，也尊重我的生活节奏。',
    } as const

    for (const context of contexts) {
      const profile = buildRelationshipProfile(content, context, [], now)
      const card = buildCardViewModel(content, profile, context)
      expect(card.sections.find((section) => section.sectionId === 'contact')?.paragraphs).toContain(expected[context])
    }
  })

  it('turns neutral answers into non-diagnostic contextual fallback copy', () => {
    const neutralAnswers = closeBank.questions.flatMap((item) => {
      const neutral = item.options.find((option) => option.neutral)
      return neutral ? [answer(item.questionId, neutral.optionId)] : []
    })
    const profile = buildRelationshipProfile(content, 'close-relationship', neutralAnswers, now)
    const card = buildCardViewModel(content, profile, 'close-relationship')

    expect(neutralAnswers.length).toBeGreaterThan(0)
    expect(profile.selectedTextKeys).toEqual([])
    expect(card.sections.every((section) => section.paragraphs.length > 0)).toBe(true)
    expect(JSON.stringify(card)).not.toMatch(/诊断为|人格类型|关系评分/u)
  })

  it('always produces complete, bounded, safe output', () => {
    const selected = [
      answer('close-contact-busy', 'close-contact-busy-brief'),
      answer('close-listening-first-response', 'close-listening-first-response-validate'),
      answer('close-conflict-tone', 'close-conflict-tone-no-insult'),
      answer('close-care-language', 'close-care-language-action'),
      answer('close-repair-follow-up', 'close-repair-follow-up-checkin'),
    ]
    const profile = buildRelationshipProfile(content, 'close-relationship', selected, now)
    const card = buildCardViewModel(content, profile, 'close-relationship')

    expect(Object.keys(card).sort()).toEqual([
      'contentVersion', 'disclaimer', 'relationshipLabel', 'sections', 'shareSummary', 'title',
    ])
    expect(card.sections).toHaveLength(7)
    expect(card.sections.flatMap((section) => section.paragraphs)
      .every((text) => Array.from(text).length <= 120)).toBe(true)
    expect(Array.from(card.shareSummary).length).toBeLessThanOrEqual(52)
    for (const pattern of FORBIDDEN_LANGUAGE_PATTERNS) expect(JSON.stringify(card)).not.toMatch(pattern)
  })
})
