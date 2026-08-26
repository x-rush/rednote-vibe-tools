import { describe, expect, it } from 'vitest'
import { getValidatedContent, FORBIDDEN_LANGUAGE_PATTERNS } from '../content/validate'
import { getRelationshipBank } from '../content/bank'
import type { QuestionnaireAnswer, RelationshipContext, RelationshipQuestion } from '../content/schema'
import { applyAnswer, toggleOption, validateSelection } from './answers'
import { buildCardViewModel } from './card'
import { buildRelationshipProfile } from './profile'

const content = getValidatedContent()
const now = '2026-08-24T00:00:00.000Z'

function question(questionId: string) {
  return content.content.questions.find((item) => item.questionId === questionId)!
}

function answers(entries: Array<[string, ...string[]]>): QuestionnaireAnswer[] {
  return entries.map(([questionId, ...optionIds]) => ({ questionId, optionIds, skipped: false, updatedAt: now }))
}

describe('questionnaire answers', () => {
  it('replaces a single answer and rejects more than one option', () => {
    const target = question('question-busy-contact')
    const first = applyAnswer([], target, ['option-busy-brief'], now)
    const second = applyAnswer(first, target, ['option-busy-flexible'], now)

    expect(second).toEqual([{ questionId: target.questionId, optionIds: ['option-busy-flexible'], skipped: false, updatedAt: now }])
    expect(validateSelection(target, ['option-busy-brief', 'option-busy-later'])).toEqual({ valid: false, error: 'too-many' })
  })

  it('enforces multi-select limits and removes duplicate selections', () => {
    const target = question('question-care-language')

    expect(validateSelection(target, ['option-care-action', 'option-care-action'])).toEqual({ valid: true, optionIds: ['option-care-action'] })
    expect(validateSelection(target, ['option-care-action', 'option-care-words', 'option-care-details'])).toEqual({ valid: false, error: 'too-many' })
  })

  it('lets an exclusive option replace other multi-select choices', () => {
    const original = question('question-care-language')
    const target: RelationshipQuestion = {
      ...original,
      options: original.options.map((option, index) => ({ ...option, exclusive: index === 2 })),
    }

    expect(toggleOption(target, ['option-care-action'], 'option-care-details')).toEqual(['option-care-details'])
    expect(toggleOption(target, ['option-care-details'], 'option-care-words')).toEqual(['option-care-words'])
  })

  it('allows an empty selection only when an optional question is explicitly skipped', () => {
    expect(validateSelection(question('question-busy-contact'), [], false)).toEqual({ valid: false, error: 'too-few' })
    expect(validateSelection(question('question-conflict-tone'), [], true)).toEqual({ valid: true, optionIds: [] })
  })
})

describe('preference profile', () => {
  it('keeps tied top preferences instead of choosing one arbitrarily', () => {
    const profile = buildRelationshipProfile(content, answers([
      ['question-care-language', 'option-care-action', 'option-care-words'],
    ]), now)

    expect(profile.priorityDimensionIds).toEqual(['care-action', 'care-words'])
    expect(profile.scores.filter((score) => score.rank === 1).every((score) => score.tied)).toBe(true)
  })

  it('keeps strong boundary choices and adds at least two matching commitments', () => {
    const profile = buildRelationshipProfile(content, answers([
      ['question-conflict-tone', 'option-tone-label', 'option-tone-threat', 'option-tone-public'],
      ['question-private-sharing', 'option-private-identifiable'],
      ['question-saying-no', 'option-no-accept'],
    ]), now)

    expect(profile.selectedBoundaryIds).toEqual(expect.arrayContaining([
      'rule-no-label', 'rule-no-threat', 'rule-safety', 'rule-public-conflict', 'rule-identifiable', 'rule-no-pressure',
    ]))
    expect(profile.selectedTextKeys.filter((key) => key.startsWith('commit-')).length).toBeGreaterThanOrEqual(2)
    const card = buildCardViewModel(content, profile, 'close-relationship')
    const avoid = card.sections.find((section) => section.sectionId === 'boundary')?.paragraphs.join('') ?? ''
    for (const textKey of ['boundary-no-label', 'boundary-no-threat', 'boundary-safety', 'boundary-public-conflict', 'boundary-identifiable', 'boundary-no-pressure']) {
      const sentence = content.content.sentenceFragments.find((item) => item.textKey === textKey)!
      expect(avoid).toContain(sentence.text)
    }
  })

  it('detects surface conflicts without discarding either selected option', () => {
    const profile = buildRelationshipProfile(content, answers([
      ['question-conflict-timing', 'option-conflict-now'],
      ['question-alone-space', 'option-space-full'],
      ['question-when-venting', 'option-vent-clarify'],
      ['question-hard-feeling', 'option-feeling-quiet'],
    ]), now)

    expect(profile.conflictRuleIds).toEqual(['merge-talk-and-space', 'merge-advice-and-quiet'])
    expect(profile.answers.flatMap((answer) => answer.optionIds)).toEqual(expect.arrayContaining([
      'option-conflict-now', 'option-space-full', 'option-vent-clarify', 'option-feeling-quiet',
    ]))
  })

  it('returns a usable neutral profile for no answers', () => {
    const profile = buildRelationshipProfile(content, [], now)
    const card = buildCardViewModel(content, profile, 'friendship')

    expect(profile.selectedTextKeys).toEqual([])
    expect(card.sections.every((section) => section.paragraphs.length > 0)).toBe(true)
    expect(card.shareSummary).toBe(content.content.cardRules.neutralSummary)
  })

  it('turns an all-neutral selection set into non-diagnostic, non-empty copy', () => {
    const neutralOptions = content.content.questions.flatMap((item) => item.options).filter((option) => option.neutral)
    const profile = buildRelationshipProfile(content, answers(neutralOptions.map((option) => [
      content.content.questions.find((item) => item.options.some((candidate) => candidate.optionId === option.optionId))!.questionId,
      option.optionId,
    ])), now)
    const card = buildCardViewModel(content, profile, 'friendship')

    expect(neutralOptions.length).toBeGreaterThan(0)
    expect(card.sections.every((section) => section.paragraphs.join('').includes('我'))).toBe(true)
    expect(JSON.stringify(card)).not.toMatch(/诊断为|人格类型|关系评分/u)
  })
})

describe('relationship card view model', () => {
  it('builds seven chapter sections with need and action responsibilities', () => {
    const profile = buildRelationshipProfile(content, answers([
      ['question-busy-contact', 'option-busy-brief'],
      ['question-when-venting', 'option-vent-listen'],
      ['question-disagree-story', 'option-story-separate'],
      ['question-alone-space', 'option-space-full'],
      ['question-care-language', 'option-care-action'],
      ['question-saying-no', 'option-no-accept'],
      ['question-repair', 'option-repair-next'],
    ]), now)
    const card = buildCardViewModel(content, profile, 'family')

    expect(card.sections.map((section) => section.sectionId)).toEqual([
      'contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair',
    ])
    for (const section of card.sections) {
      expect(section.paragraphRoles).toContain('need')
      expect(section.paragraphRoles).toContain('action')
    }
    expect(card.relationshipLabel).toBe('家人关系')
  })

  it('merges conflicting preferences into contextual first-person language', () => {
    const profile = buildRelationshipProfile(content, answers([
      ['question-conflict-timing', 'option-conflict-now'],
      ['question-alone-space', 'option-space-full'],
    ]), now)
    const card = buildCardViewModel(content, profile, 'close-relationship')

    expect(card.sections.find((section) => section.sectionId === 'conflict')?.paragraphs).toContain(
      '有时我希望先把当下最需要说清的部分谈完；如果情绪太满，我也可能需要安静一下，等缓过来后再继续。',
    )
  })

  it('keeps an independently supported sentence when a conflict replaces another occurrence', () => {
    const profile = buildRelationshipProfile(content, answers([
      ['question-when-venting', 'option-vent-clarify'],
      ['question-hard-feeling', 'option-feeling-quiet'],
      ['question-help-without-asking', 'option-help-options'],
    ]), now)
    const card = buildCardViewModel(content, profile, 'close-relationship')

    expect(card.sections.find((section) => section.sectionId === 'listening')?.paragraphs.join('')).toContain('有时我需要一点安静陪伴')
    expect(card.sections.find((section) => section.sectionId === 'care')?.paragraphs.join('')).toContain('给我几个可选择的方式')
    expect(card.shareSummary).toContain('安静')
    expect(card.shareSummary).toContain('理一理')
  })

  it('assigns stable semantic IDs to generated card paragraphs', () => {
    const profile = buildRelationshipProfile(content, answers([
      ['question-when-venting', 'option-vent-listen'],
    ]), now)
    const card = buildCardViewModel(content, profile, 'friendship')

    expect(card.sections.find((section) => section.sectionId === 'listening')?.paragraphIds).toContain('text:pref-listen-first')
  })

  it('always produces complete fields with bounded copy and safe language', () => {
    const profile = buildRelationshipProfile(content, answers([
      ['question-busy-contact', 'option-busy-brief'],
      ['question-when-venting', 'option-vent-ask'],
      ['question-conflict-tone', 'option-tone-label'],
      ['question-care-language', 'option-care-action'],
      ['question-repair', 'option-repair-next'],
    ]), now)
    const card = buildCardViewModel(content, profile, 'close-relationship')

    expect(Object.keys(card).sort()).toEqual(['contentVersion', 'disclaimer', 'relationshipLabel', 'sections', 'shareSummary', 'title'])
    expect(card.sections).toHaveLength(7)
    expect(card.sections.every((section) => section.paragraphs.length > 0)).toBe(true)
    expect(card.sections.every((section) => section.paragraphs.join('').includes('我'))).toBe(true)
    expect(card.sections.flatMap((section) => section.paragraphs).every((text) => text.length <= 120)).toBe(true)
    expect(card.shareSummary.length).toBeLessThanOrEqual(52)
    for (const pattern of FORBIDDEN_LANGUAGE_PATTERNS) expect(JSON.stringify(card)).not.toMatch(pattern)
  })

  it.each([
    { name: '倾听优先', input: [['question-when-venting', 'option-vent-listen']], section: 'listening', expected: '通常希望先被听完' },
    { name: '建议自主', input: [['question-when-venting', 'option-vent-ask']], section: 'listening', expected: '需要我听' },
    { name: '安静空间', input: [['question-alone-space', 'option-space-full']], section: 'space', expected: '空间可以被尊重' },
    { name: '明确边界', input: [['question-saying-no', 'option-no-accept']], section: 'boundary', expected: '请不要反复施压' },
    { name: '修复行动', input: [['question-repair', 'option-repair-next']], section: 'repair', expected: '下一次可以怎样做得不同' },
  ])('turns golden input $name into a final card', ({ input, section, expected }) => {
    const profile = buildRelationshipProfile(content, answers(input as Array<[string, ...string[]]>), now)
    const card = buildCardViewModel(content, profile, 'friendship')
    const paragraph = card.sections.find((item) => item.sectionId === section)?.paragraphs.join('') ?? ''

    expect(paragraph).toContain(expected)
    expect(card.relationshipLabel).toBe('好友关系')
  })
})

describe('relationship-specific V3 results', () => {
  const contexts: RelationshipContext[] = ['close-relationship', 'friendship', 'family']
  const prefixes: Record<RelationshipContext, string> = {
    'close-relationship': 'close-',
    friendship: 'friend-',
    family: 'family-',
  }

  it.each(contexts)('builds a seven-section %s card from only its own bank', (context) => {
    const bank = getRelationshipBank(content, context)
    const selected = bank.questions.map((item) => ({
      questionId: item.questionId,
      optionIds: [item.options[0]!.optionId],
      skipped: false,
      updatedAt: now,
    }))

    const profile = buildRelationshipProfile(content, context, selected, now)
    const card = buildCardViewModel(content, profile, context)

    expect(card.sections).toHaveLength(7)
    expect(profile.selectedTextKeys.every((key) => key.startsWith(prefixes[context]))).toBe(true)
    expect(card.sections.flatMap((section) => section.paragraphSourceTextKeys)
      .filter((key): key is string => key !== null)
      .every((key) => key.startsWith(prefixes[context]))).toBe(true)
  })

  it('ignores an answer from another relationship bank', () => {
    const foreignQuestion = getRelationshipBank(content, 'friendship').questions[0]!
    const profile = buildRelationshipProfile(content, 'family', [{
      questionId: foreignQuestion.questionId,
      optionIds: [foreignQuestion.options[0]!.optionId],
      skipped: false,
      updatedAt: now,
    }], now)

    expect(profile.answers).toEqual([])
    expect(profile.selectedTextKeys).toEqual([])
  })

  it('uses the selected context fallbacks for unanswered sections', () => {
    const profile = buildRelationshipProfile(content, 'family', [], now)
    const card = buildCardViewModel(content, profile, 'family')
    const contact = card.sections.find((section) => section.sectionId === 'contact')!

    expect(contact.paragraphs).toContain('我希望家人的联系能落下牵挂，也尊重我的生活节奏。')
    expect(contact.paragraphs).not.toContain('我希望联系既有回应，也容得下彼此真实的生活节奏。')
  })

  it.each([
    ['close-relationship', '我希望亲密关系里的联系有回应，也允许彼此忙碌。'],
    ['friendship', '我希望友情里的联系不必频繁，却能在重要时刻得到回应。'],
  ] as const)('uses a distinct %s contact fallback', (context, expected) => {
    const profile = buildRelationshipProfile(content, context, [], now)
    const card = buildCardViewModel(content, profile, context)

    expect(card.sections.find((section) => section.sectionId === 'contact')?.paragraphs).toContain(expected)
  })
})
