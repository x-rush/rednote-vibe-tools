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

function question(context: RelationshipContext, questionId: string) {
  return getRelationshipBank(content, context).questions.find((item) => item.questionId === questionId)!
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
    const options = RELATIONSHIP_CONTEXTS
      .flatMap((context) => getRelationshipBank(content, context).questions)
      .flatMap((question) => question.options)

    for (const option of options) {
      if (option.tags.includes('no-sharing')) continue
      expect(`${option.text}${option.subtitle}`).not.toMatch(/安全风险|即时安全|现实帮助/u)
    }
    expect(content.content.safetyRules.some((rule) => /紧急支持/u.test(rule.label))).toBe(true)
  })

  it('keeps baseline conflict safety outside selectable communication preferences', () => {
    const conflict = question('close-relationship', 'close-conflict-tone')

    expect(conflict.options.map((option) => option.text).join('')).not.toMatch(/辱骂|贬低|侮辱/u)
    expect(content.content.safetyRules.some((rule) => /贬低|侮辱/u.test(rule.label))).toBe(true)
  })

  it('requires consent before suggesting touch as listening support', () => {
    const support = question('close-relationship', 'close-listening-capacity')
      .options.find((option) => option.tags.includes('small-support'))!

    expect(support.subtitle).toMatch(/先问|询问|同意/u)
  })

  it('allows relationship details to remain private', () => {
    const sharing = question('close-relationship', 'close-boundary-public-sharing')
    const noSharing = sharing.options.find((option) => option.tags.includes('no-sharing'))!
    const resultText = outputForOption('close-relationship', sharing.questionId, 'no-sharing')
      .map((sentence) => sentence.text).join('')

    expect(noSharing).toBeDefined()
    expect(`${noSharing.subtitle}${resultText}`).toMatch(/保密支持/u)
    expect(`${noSharing.subtitle}${resultText}`).toMatch(/安全风险.{0,12}立即求助/u)
    expect(`${noSharing.subtitle}${resultText}`).not.toMatch(/必要帮助.{0,8}先.{0,4}确认/u)
  })

  it('uses inclusive relationship subjects instead of defaulting to a male pronoun', () => {
    const visibleText = JSON.stringify(content.content.relationshipBanks)

    expect(visibleText).not.toMatch(/不是针对他(?:。|，)|替他开心|希望他先确认/u)
  })

  it('makes the friendship listening-capacity subject explicit', () => {
    const capacity = question('friendship', 'friend-listening-capacity')

    expect(capacity.prompt).toMatch(/当你|你暂时/u)
    expect(capacity.sceneLead).not.toMatch(/你或对方/u)
  })

  it('limits delayed-contact guidance to confirmed non-emergencies', () => {
    const delay = question('family', 'family-contact-delay')

    expect(`${delay.sceneLead}${delay.prompt}`).toMatch(/没有具体危险迹象/u)
    for (const tag of ['one-message', 'wait', 'channel']) {
      const resultText = outputForOption('family', delay.questionId, tag).map((sentence) => sentence.text).join('')
      expect(resultText).toMatch(/没有具体危险迹象/u)
      expect(resultText).toMatch(/不涉及.{0,8}紧急/u)
    }
  })

  it('lets the user pause family contact according to their own safety and capacity', () => {
    const distance = question('family', 'family-space-distance')
    const text = JSON.stringify(distance)

    expect(distance.options.some((option) => option.tags.includes('full-pause'))).toBe(true)
    expect(text).not.toMatch(/双方承受能力|不用.{0,8}彻底断开/u)
  })

  it('keeps family decision space distinct from relative-sharing boundaries', () => {
    const decisions = question('family', 'family-space-decisions')

    expect(decisions.options.some((option) => option.tags.includes('no-deadline'))).toBe(true)
    expect(decisions.options.map((option) => option.tags).flat()).not.toContain('no-relatives')
  })

  it('scores practical family help as an action', () => {
    const support = question('family', 'family-care-worry')
      .options.find((option) => option.tags.includes('support'))!

    expect(support.dimensionEffects[0]?.dimensionId).toBe('care-action')
  })

  it('states delegated-decision authorization as a boundary on the other person', () => {
    const sentence = outputForOption('family', 'family-boundary-decisions', 'authorization')[0]!

    expect(sentence.voice).toBe('boundary')
    expect(sentence.text).toMatch(/只有|不视为同意|不得/u)
    expect(sentence.text).not.toMatch(/^我会/u)
  })

  it('covers concrete restitution in family repair', () => {
    const repair = question('family', 'family-repair-impact')
    const tags = repair.options.flatMap((option) => option.tags)

    expect(tags).toEqual(expect.arrayContaining(['restore-choice', 'correct-information', 'restore-privacy']))
  })

  it('contains no malformed family-repair phrase', () => {
    expect(JSON.stringify(getRelationshipBank(content, 'family'))).not.toContain('不用品质或亲情')
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

  it('does not describe a multi-select joke response as one first action', () => {
    const jokes = question('friendship', 'friend-conflict-jokes')

    expect(jokes.multiple).toBe(true)
    expect(jokes.prompt).not.toMatch(/先做什么/u)
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
