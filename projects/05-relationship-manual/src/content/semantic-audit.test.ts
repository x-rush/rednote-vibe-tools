import { describe, expect, it } from 'vitest'
import { getRelationshipBank, RELATIONSHIP_CONTEXTS } from './bank'
import { getValidatedContent } from './validate'
import type { RelationshipContext } from './schema'

const content = getValidatedContent()
const expectedQuestionIds: Record<RelationshipContext, string[]> = {
  'close-relationship': [
    'close-contact-busy', 'close-contact-delay', 'close-contact-plan-change',
    'close-listening-first-response', 'close-listening-questions', 'close-listening-capacity',
    'close-conflict-tone', 'close-conflict-pause', 'close-conflict-memory',
    'close-space-announce', 'close-space-checkin', 'close-space-social-time',
    'close-care-actions', 'close-care-language', 'close-care-touch-consent',
    'close-boundary-device', 'close-boundary-intimacy', 'close-boundary-public-sharing',
    'close-repair-apology', 'close-repair-change', 'close-repair-follow-up',
  ],
  friendship: [
    'friend-contact-frequency', 'friend-contact-delay', 'friend-contact-plan-change',
    'friend-listening-response', 'friend-listening-capacity', 'friend-listening-support-mode',
    'friend-conflict-private-talk', 'friend-conflict-jokes', 'friend-conflict-values',
    'friend-space-busy-season', 'friend-space-social-pause', 'friend-space-new-friends',
    'friend-care-checkin', 'friend-care-ask-first', 'friend-care-support-limits',
    'friend-boundary-confidentiality', 'friend-boundary-sharing', 'friend-boundary-refusal',
    'friend-repair-accountability', 'friend-repair-group-misunderstanding', 'friend-repair-trust',
  ],
  family: [
    'family-contact-checkin', 'family-contact-delay', 'family-contact-plan-change',
    'family-listening-first-response', 'family-listening-advice', 'family-listening-respect',
    'family-conflict-current-event', 'family-conflict-authority', 'family-conflict-pause',
    'family-space-room', 'family-space-decisions', 'family-space-distance',
    'family-care-preference', 'family-care-illness', 'family-care-worry',
    'family-boundary-private-topics', 'family-boundary-decisions', 'family-boundary-relatives',
    'family-repair-no-bypass', 'family-repair-impact', 'family-repair-change',
  ],
}

function outputForOption(context: RelationshipContext, questionId: string, optionTag: string) {
  const bank = getRelationshipBank(content, context)
  const question = bank.questions.find((item) => item.questionId === questionId)!
  const option = question.options.find((item) => item.tags.includes(optionTag))!
  const sentences = new Map(bank.sentenceFragments.map((sentence) => [sentence.textKey, sentence]))
  return option.resultTextKeys.map((key) => sentences.get(key)!).filter(Boolean)
}

describe('question-bank semantic audit', () => {
  it.each(RELATIONSHIP_CONTEXTS)('%s contains the reviewed 21-event matrix in chapter order', (context) => {
    expect(getRelationshipBank(content, context).questions.map((question) => question.questionId))
      .toEqual(expectedQuestionIds[context])
  })

  it('keeps ordinary delayed replies separate from punitive disappearance', () => {
    const text = outputForOption('close-relationship', 'close-contact-delay', 'flexible-delay')
      .map((sentence) => sentence.text).join('')
    expect(text).toMatch(/晚些回复|有余力时回应/u)
    expect(text).not.toMatch(/惩罚|逼迫|冷暴力/u)
  })

  it('keeps quiet presence distinct from solitude', () => {
    const text = outputForOption('close-relationship', 'close-space-checkin', 'nearby')
      .map((sentence) => sentence.text).join('')
    expect(text).toContain('留在附近')
    expect(text).not.toContain('完整独处')
  })

  it('keeps plan rescheduling about a new plan', () => {
    const sentence = outputForOption('close-relationship', 'close-contact-plan-change', 'reschedule')[0]!
    expect(sentence.voice).toBe('request')
    expect(sentence.text).toMatch(/重新约|新的时间/u)
    expect(sentence.text).not.toMatch(/评价|恶意/u)
  })

  it('keeps apology needs in request voice', () => {
    const sentence = outputForOption('close-relationship', 'close-repair-apology', 'impact')[0]!
    expect(sentence.voice).toBe('request')
    expect(sentence.text).toMatch(/希望|承认|影响/u)
    expect(sentence.text).not.toMatch(/^我愿意/u)
  })

  it('keeps later repair check-ins about follow-up', () => {
    const sentence = outputForOption('close-relationship', 'close-repair-follow-up', 'checkin')[0]!
    expect(sentence.voice).toBe('self-commitment')
    expect(sentence.text).toMatch(/过一段时间|之后|再次确认/u)
    expect(sentence.text).not.toMatch(/暂停后回来/u)
  })

  it('names group triangulation directly in friendship', () => {
    const sentence = outputForOption('friendship', 'friend-conflict-private-talk', 'private')[0]!
    expect(sentence.voice).toBe('boundary')
    expect(sentence.text).toMatch(/群|站队|当事人/u)
  })

  it('does not leak breakup or intimacy wording into friendship and family banks', () => {
    for (const context of ['friendship', 'family'] as const) {
      expect(JSON.stringify(getRelationshipBank(content, context))).not.toMatch(/分手|亲密接触/u)
    }
  })

  it('keeps emergency-help guidance outside selectable preferences', () => {
    const optionTexts = RELATIONSHIP_CONTEXTS
      .flatMap((context) => getRelationshipBank(content, context).questions)
      .flatMap((question) => question.options)
      .map((option) => `${option.text}${option.subtitle}`)

    for (const optionText of optionTexts) {
      expect(optionText).not.toMatch(/安全风险|即时安全|现实帮助/u)
    }
    expect(content.content.safetyRules.some((rule) => /紧急支持/u.test(rule.label))).toBe(true)
  })

  it.each([
    ['close-relationship', 'close-care-language', {
      words: 'care-words',
      action: 'care-action',
      details: 'care-details',
    }],
    ['friendship', 'friend-care-checkin', {
      specific: 'care-details',
      'no-reply': 'care-words',
      company: 'care-action',
    }],
    ['family', 'family-care-preference', {
      meal: 'care-action',
      company: 'care-action',
      space: 'space-autonomy',
    }],
  ] as const)('%s %s scores each selected care mode in its matching dimension', (context, questionId, expected) => {
    const question = getRelationshipBank(content, context).questions.find((item) => item.questionId === questionId)!
    const actual = Object.fromEntries(question.options.map((option) => [
      option.tags[0],
      option.dimensionEffects[0]?.dimensionId,
    ]))

    expect(actual).toEqual(expected)
  })

  it.each([
    ['close-relationship', 'close-contact-plan-change'],
    ['friendship', 'friend-boundary-sharing'],
    ['family', 'family-repair-change'],
  ] as const)('%s %s makes combinable choices multi-select or asks for one priority', (context, questionId) => {
    const question = getRelationshipBank(content, context).questions.find((item) => item.questionId === questionId)!
    expect(question.multiple || /最|哪一件/u.test(question.prompt)).toBe(true)
  })

  it.each(RELATIONSHIP_CONTEXTS)('%s has no unreachable result sentence', (context) => {
    const bank = getRelationshipBank(content, context)
    const reachable = new Set([
      ...bank.questions.flatMap((question) => question.options.flatMap((option) => option.resultTextKeys)),
      ...bank.boundaryPreferences.map((boundary) => boundary.textKey),
      ...bank.boundaryCommitmentRules.flatMap((rule) => rule.textKeys),
      ...bank.defaultCommitmentTextKeys,
      ...content.content.dimensions.map((dimension) => dimension.fallbackTextKeys[context]),
    ])
    expect(bank.sentenceFragments.filter((sentence) => !reachable.has(sentence.textKey))).toEqual([])
  })
})
