import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import type { RelationshipContentPackage } from './schema'
import { FORBIDDEN_LANGUAGE_PATTERNS, validateContent } from './validate'

const content = rawContent as unknown as RelationshipContentPackage

describe('relationship content package', () => {
  it('accepts the production package and frozen content counts', () => {
    const result = validateContent(content)

    expect(result.errors).toEqual([])
    expect(content.projectId).toBe('relationship-manual')
    expect(content.schemaVersion).toBe(1)
    expect(content.contentVersion).toBe('1.0.0')
    expect(content.content.questions).toHaveLength(16)
    expect(content.content.sentenceFragments).toHaveLength(42)
    expect(content.content.cardRules.sections).toHaveLength(6)
  })

  it('keeps every built-in ID unique and every option selectable', () => {
    const ids = [
      ...content.content.dimensions.map((item) => item.dimensionId),
      ...content.content.questions.map((item) => item.questionId),
      ...content.content.questions.flatMap((question) => question.options.map((option) => option.optionId)),
      ...content.content.sentenceFragments.map((item) => item.textKey),
    ]

    expect(new Set(ids).size).toBe(ids.length)
    for (const question of content.content.questions) {
      expect(question.options.length).toBeGreaterThanOrEqual(3)
      expect(question.selectionLimit.min).toBeGreaterThanOrEqual(1)
      expect(question.selectionLimit.max).toBeLessThanOrEqual(question.options.length)
      expect(question.multiple ? question.selectionLimit.max : 1).toBe(question.selectionLimit.max)
    }
  })

  it('resolves all dimensions, conflicts, boundaries, and result text keys', () => {
    const dimensionIds = new Set(content.content.dimensions.map((item) => item.dimensionId))
    const optionIds = new Set(content.content.questions.flatMap((question) => question.options.map((option) => option.optionId)))
    const boundaryIds = new Set(content.content.boundaryPreferences.map((item) => item.boundaryId))
    const textKeys = new Set(content.content.sentenceFragments.map((item) => item.textKey))

    for (const question of content.content.questions) {
      for (const option of question.options) {
        expect(option.dimensionEffects.every((effect) => dimensionIds.has(effect.dimensionId))).toBe(true)
        expect(option.conflictsWith.every((id) => optionIds.has(id))).toBe(true)
        expect(option.boundaryIds.every((id) => boundaryIds.has(id))).toBe(true)
        expect(option.resultTextKeys.every((id) => textKeys.has(id))).toBe(true)
      }
    }
  })

  it('provides a valid fallback for every important dimension', () => {
    const textKeys = new Set(content.content.sentenceFragments.map((item) => item.textKey))
    const important = content.content.dimensions.filter((dimension) => dimension.important)

    expect(important.length).toBeGreaterThan(0)
    expect(important.every((dimension) => textKeys.has(dimension.fallbackTextKey))).toBe(true)
  })

  it('contains all required share card fields and no empty visible copy', () => {
    const rules = content.content.cardRules

    expect(rules.requiredFields).toEqual([
      'title',
      'relationshipLabel',
      'sections',
      'shareSummary',
      'disclaimer',
      'contentVersion',
    ])
    expect(rules.title.trim()).not.toBe('')
    expect(rules.disclaimer.trim()).not.toBe('')
    expect(rules.safetyFallback.trim()).not.toBe('')
    expect(rules.sections.every((section) => section.title.trim().length > 0)).toBe(true)
    expect(Object.values(content.content.uiCopy).every((copy) => copy.trim().length > 0)).toBe(true)
  })

  it('does not contain coercive, shaming, controlling, or diagnostic language', () => {
    const visibleText = JSON.stringify(content.content)
    for (const pattern of FORBIDDEN_LANGUAGE_PATTERNS) {
      expect(visibleText).not.toMatch(pattern)
    }
  })

  it('reports paths for broken references and illegal selection limits', () => {
    const broken = structuredClone(content)
    broken.content.questions[0]!.selectionLimit.max = 9
    broken.content.questions[0]!.options[0]!.resultTextKeys = ['missing-text-key']

    const result = validateContent(broken)

    expect(result.errors).toContain('$.content.questions[0].selectionLimit.max: exceeds option count')
    expect(result.errors).toContain('$.content.questions[0].options[0].resultTextKeys[0]: unknown text key "missing-text-key"')
  })

  it('rejects malformed nested content without throwing during recovery', () => {
    const malformed = structuredClone(content) as unknown as Record<string, unknown>
    const malformedContent = malformed.content as Record<string, unknown>
    malformedContent.questions = [{ questionId: 'question-broken', options: [null] }]

    expect(() => validateContent(malformed)).not.toThrow()
    expect(validateContent(malformed)).toEqual({
      valid: false,
      errors: ['$.content.questions: invalid nested item structure'],
    })
    expect(validateContent({ meta: { title: { trim: 1 } }, content: {} })).toEqual({
      valid: false,
      errors: ['$: invalid nested structure'],
    })
  })

  it('rejects missing UI dependencies without throwing', () => {
    const missingSafetyRules = structuredClone(content) as unknown as Record<string, unknown>
    delete (missingSafetyRules.content as Record<string, unknown>).safetyRules
    const missingLabels = structuredClone(content) as unknown as Record<string, unknown>
    delete (((missingLabels.content as Record<string, unknown>).cardRules as Record<string, unknown>).relationshipLabels)

    expect(() => validateContent(missingSafetyRules)).not.toThrow()
    expect(validateContent(missingSafetyRules).valid).toBe(false)
    expect(() => validateContent(missingLabels)).not.toThrow()
    expect(validateContent(missingLabels).valid).toBe(false)
  })

  it('validates boundary commitment references from the content package', () => {
    const broken = structuredClone(content)
    broken.content.cardRules.boundaryCommitmentRules[0]!.textKeys = ['missing-commitment']

    expect(validateContent(broken).errors).toContain(
      '$.content.cardRules.boundaryCommitmentRules[0].textKeys[0]: unknown text key "missing-commitment"',
    )
  })
})
