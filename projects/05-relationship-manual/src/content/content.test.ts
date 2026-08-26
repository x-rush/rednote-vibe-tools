import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import { getRelationshipBank, RELATIONSHIP_CONTEXTS } from './bank'
import type { RelationshipContentPackage, RelationshipContext } from './schema'
import { FORBIDDEN_LANGUAGE_PATTERNS, validateContent } from './validate'

const content = rawContent as unknown as RelationshipContentPackage
const categories = ['contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair'] as const
const prefixes: Record<RelationshipContext, string> = {
  'close-relationship': 'close-',
  friendship: 'friend-',
  family: 'family-',
}

describe('relationship content package V3', () => {
  it('accepts the production schema-3 package', () => {
    const result = validateContent(content)

    expect(result.errors).toEqual([])
    expect(content.projectId).toBe('relationship-manual')
    expect(content.schemaVersion).toBe(3)
    expect(content.contentVersion).toBe('3.1.0')
    expect(content.content.cardRules.sections).toHaveLength(7)
  })

  it.each(RELATIONSHIP_CONTEXTS)('%s has 21 isolated questions and three per chapter', (context) => {
    const bank = getRelationshipBank(content, context)

    expect(bank.questions).toHaveLength(21)
    for (const category of categories) {
      expect(bank.questions.filter((question) => question.category === category)).toHaveLength(3)
    }
    expect(bank.questions.every((question) => question.questionId.startsWith(prefixes[context]))).toBe(true)
    expect(bank.questions.flatMap((question) => question.options)
      .every((option) => option.optionId.startsWith(prefixes[context]))).toBe(true)
    expect(bank.sentenceFragments.every((sentence) => sentence.textKey.startsWith(prefixes[context]))).toBe(true)
  })

  it('keeps every ID globally unique and every option selectable', () => {
    const allIds = RELATIONSHIP_CONTEXTS.flatMap((context) => {
      const bank = getRelationshipBank(content, context)
      return [
        ...bank.questions.map((question) => question.questionId),
        ...bank.questions.flatMap((question) => question.options.map((option) => option.optionId)),
        ...bank.boundaryPreferences.map((boundary) => boundary.boundaryId),
        ...bank.sentenceFragments.map((sentence) => sentence.textKey),
      ]
    })

    expect(new Set(allIds).size).toBe(allIds.length)
    for (const context of RELATIONSHIP_CONTEXTS) {
      for (const question of getRelationshipBank(content, context).questions) {
        expect(question.options.length).toBeGreaterThanOrEqual(3)
        expect(question.selectionLimit.min).toBeGreaterThanOrEqual(1)
        expect(question.selectionLimit.max).toBeLessThanOrEqual(question.options.length)
        expect(question.multiple ? question.selectionLimit.max : 1).toBe(question.selectionLimit.max)
      }
    }
  })

  it('keeps every safety rule ID unique', () => {
    const ids = content.content.safetyRules.map((rule) => rule.ruleId)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('rejects duplicate safety rule IDs', () => {
    const broken = structuredClone(content)
    broken.content.safetyRules.push({ ...broken.content.safetyRules[0]! })

    expect(validateContent(broken).errors).toContain(`$: duplicate id "${broken.content.safetyRules[0]!.ruleId}"`)
  })

  it.each(RELATIONSHIP_CONTEXTS)('%s resolves references only inside its own bank', (context) => {
    const bank = getRelationshipBank(content, context)
    const dimensionIds = new Set(content.content.dimensions.map((dimension) => dimension.dimensionId))
    const optionIds = new Set(bank.questions.flatMap((question) => question.options.map((option) => option.optionId)))
    const boundaryIds = new Set(bank.boundaryPreferences.map((boundary) => boundary.boundaryId))
    const textKeys = new Set(bank.sentenceFragments.map((sentence) => sentence.textKey))

    for (const question of bank.questions) {
      for (const option of question.options) {
        expect(option.dimensionEffects.every((effect) => dimensionIds.has(effect.dimensionId))).toBe(true)
        expect(option.conflictsWith.every((id) => optionIds.has(id))).toBe(true)
        expect(option.boundaryIds.every((id) => boundaryIds.has(id))).toBe(true)
        expect(option.resultTextKeys.every((id) => textKeys.has(id))).toBe(true)
      }
    }
  })

  it.each(RELATIONSHIP_CONTEXTS)('%s has a contextual fallback for every important dimension', (context) => {
    const bank = getRelationshipBank(content, context)
    const textKeys = new Set(bank.sentenceFragments.map((sentence) => sentence.textKey))
    const important = content.content.dimensions.filter((dimension) => dimension.important)

    expect(important.length).toBeGreaterThan(0)
    expect(important.every((dimension) => textKeys.has(dimension.fallbackTextKeys?.[context] ?? ''))).toBe(true)
  })

  it('provides three relationship contexts, three NPC poses, and context-accurate intro copy', () => {
    expect(Object.keys(content.content.contextCopy).sort()).toEqual([
      'close-relationship', 'family', 'friendship',
    ])
    expect(new Set(content.content.npcCues.map((cue) => cue.pose))).toEqual(
      new Set(['daily', 'listening', 'reminder']),
    )
    expect(content.content.uiCopy.introBody).toContain('独立的场景题库')
  })

  it.each(RELATIONSHIP_CONTEXTS)('%s has a reachable conflict merge rule with a scoped NPC cue', (context) => {
    const bank = getRelationshipBank(content, context)
    const optionQuestion = new Map(bank.questions.flatMap((question) => (
      question.options.map((option) => [option.optionId, question] as const)
    )))

    expect(bank.conflictMergeRules.length).toBeGreaterThan(0)
    for (const rule of bank.conflictMergeRules) {
      const questions = rule.optionIds.map((optionId) => optionQuestion.get(optionId))
      expect(questions.every((question) => question !== undefined)).toBe(true)
      expect(questions[0]?.questionId !== questions[1]?.questionId || questions[0]?.multiple).toBe(true)
      expect(content.content.npcCues).toContainEqual(expect.objectContaining({
        trigger: 'conflict',
        relationshipContext: context,
        conflictRuleId: rule.ruleId,
      }))
    }
  })

  it('rejects a conflict cue whose relationship rule does not exist', () => {
    const broken = structuredClone(content)
    const cue = broken.content.npcCues.find((item) => item.trigger === 'conflict')!
    cue.conflictRuleId = 'missing-rule'

    expect(validateContent(broken).errors.some((error) => error.includes('unknown conflict rule'))).toBe(true)
  })

  it('rejects duplicate, exclusive, unrelated, and wrong-section conflict rules', () => {
    const duplicate = structuredClone(content)
    duplicate.content.relationshipBanks!.friendship.conflictMergeRules[0]!.optionIds = [
      'friend-conflict-jokes-stop', 'friend-conflict-jokes-stop',
    ]
    const exclusive = structuredClone(content)
    const exclusiveBank = exclusive.content.relationshipBanks!.friendship
    exclusiveBank.conflictMergeRules[0]!.optionIds = ['friend-conflict-jokes-stop', 'friend-conflict-jokes-ask']
    exclusiveBank.conflictMergeRules[0]!.replacesTextKeys = [
      'friend-conflict-jokes-stop-result', 'friend-conflict-jokes-ask-result',
    ]
    exclusiveBank.questions.find((question) => question.questionId === 'friend-conflict-jokes')!
      .options.find((option) => option.optionId === 'friend-conflict-jokes-stop')!.exclusive = true
    const unrelated = structuredClone(content)
    unrelated.content.relationshipBanks!['close-relationship'].conflictMergeRules[0]!.replacesTextKeys = [
      'close-care-language-action-result',
    ]
    const wrongSection = structuredClone(content)
    wrongSection.content.relationshipBanks!.family.conflictMergeRules[0]!.cardSectionId = 'space'

    expect(validateContent(duplicate).errors.some((error) => error.includes('distinct option'))).toBe(true)
    expect(validateContent(exclusive).errors.some((error) => error.includes('unreachable option combination'))).toBe(true)
    expect(validateContent(unrelated).errors.some((error) => error.includes('not emitted by triggering options'))).toBe(true)
    expect(validateContent(wrongSection).errors.some((error) => error.includes('section mismatch'))).toBe(true)
  })

  it('keeps share-card and local export copy complete', () => {
    expect(content.content.cardRules.requiredFields).toEqual([
      'title', 'relationshipLabel', 'sections', 'shareSummary', 'disclaimer', 'contentVersion',
    ])
    expect(content.content.uiCopy).toMatchObject({
      guideName: '小满',
      guideRole: '关系卡片整理员',
      shareExportLabel: '保存简洁长图',
      shareExportSuccess: '分享卡已保存到手机相册',
    })
    expect(Object.values(content.content.uiCopy).every((copy) => copy.trim().length > 0)).toBe(true)
  })

  it('does not contain coercive, shaming, controlling, or diagnostic language', () => {
    const visibleText = JSON.stringify(content.content)
    for (const pattern of FORBIDDEN_LANGUAGE_PATTERNS) expect(visibleText).not.toMatch(pattern)
  })

  it('rejects a cross-bank result reference', () => {
    const broken = structuredClone(content)
    broken.content.relationshipBanks!.family.questions[0]!.options[0]!.resultTextKeys = [
      broken.content.relationshipBanks!.friendship.sentenceFragments[0]!.textKey,
    ]

    expect(validateContent(broken).errors.some((error) => error.includes('cross-bank result key'))).toBe(true)
  })

  it('rejects result voice and intensity drift', () => {
    const brokenVoice = structuredClone(content)
    brokenVoice.content.relationshipBanks!.family.questions[0]!.resultVoices = ['self-commitment']
    const brokenIntensity = structuredClone(content)
    brokenIntensity.content.relationshipBanks!.family.questions[0]!.options[0]!.intensity = 3
    const key = brokenIntensity.content.relationshipBanks!.family.questions[0]!.options[0]!.resultTextKeys[0]!
    const sentence = brokenIntensity.content.relationshipBanks!.family.sentenceFragments.find((item) => item.textKey === key)!
    sentence.intensity = 1

    expect(validateContent(brokenVoice).errors.some((error) => error.includes('result voice mismatch'))).toBe(true)
    expect(validateContent(brokenIntensity).errors.some((error) => error.includes('result intensity mismatch'))).toBe(true)
  })

  it('rejects a neutral option that generates a result', () => {
    const broken = structuredClone(content)
    const bank = broken.content.relationshipBanks!['close-relationship']
    const option = bank.questions.flatMap((question) => question.options).find((item) => item.neutral)!
    option.resultTextKeys = [bank.sentenceFragments[0]!.textKey]

    expect(validateContent(broken).errors.some((error) => error.includes('neutral option must not generate results'))).toBe(true)
  })

  it('rejects malformed nested content without throwing', () => {
    const malformed = structuredClone(content) as unknown as Record<string, unknown>
    const malformedContent = malformed.content as Record<string, unknown>
    malformedContent.relationshipBanks = { family: { questions: [null] } }

    expect(() => validateContent(malformed)).not.toThrow()
    expect(validateContent(malformed).valid).toBe(false)
    expect(validateContent({ meta: { title: { trim: 1 } }, content: {} })).toEqual({
      valid: false,
      errors: ['$: invalid nested structure'],
    })
  })

  it.each(RELATIONSHIP_CONTEXTS)('%s provides broad, valid V2 answer migration coverage', (context) => {
    const migration = content.content.answerMigrations.find((item) => item.fromContentVersion === '2.0.0')
    const mappings = migration?.byContext[context] ?? {}
    const bank = getRelationshipBank(content, context)
    const questionById = new Map(bank.questions.map((question) => [question.questionId, question]))

    expect(Object.keys(mappings).length).toBeGreaterThanOrEqual(16)
    for (const mapping of Object.values(mappings)) {
      const question = questionById.get(mapping.questionId)
      expect(question).toBeDefined()
      const optionIds = new Set(question?.options.map((option) => option.optionId))
      expect(Object.values(mapping.optionIds).every((optionId) => optionIds.has(optionId))).toBe(true)
    }
  })
})
