import rawContent from './content.json'
import type {
  ContentValidationResult,
  RelationshipContentPackage,
  RelationshipQuestion,
} from './schema'

export const FORBIDDEN_LANGUAGE_PATTERNS = [
  /你必须无条件/u,
  /如果爱我就应该/u,
  /人格障碍/u,
  /回避型/u,
  /焦虑型/u,
  /监控.{0,6}(手机|设备|账号)/u,
  /惩罚对方/u,
  /羞辱/u,
] as const

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u
const UI_COPY_KEYS = [
  'landingEyebrow', 'landingLead', 'privacyTitle', 'privacyBody', 'introEyebrow', 'introTitle',
  'introBody', 'contextHint', 'principlesTitle', 'reviewEyebrow', 'reviewTitle', 'reviewBody',
  'resultReadyEyebrow', 'resultSavedEyebrow', 'resultTitle', 'resultSavedTitle', 'resultBody',
  'editorEyebrow', 'editorTitle', 'editorBody', 'editorReviewNote', 'emptyTitle', 'emptyBody',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function duplicateIds(ids: string[]): string[] {
  const seen = new Set<string>()
  return ids.filter((id) => {
    if (seen.has(id)) return true
    seen.add(id)
    return false
  })
}

function validateQuestion(
  question: RelationshipQuestion,
  questionIndex: number,
  dimensionIds: Set<string>,
  optionIds: Set<string>,
  boundaryIds: Set<string>,
  textKeys: Set<string>,
  errors: string[],
) {
  const base = `$.content.questions[${questionIndex}]`
  if (!question.multiple && question.selectionLimit.max !== 1) {
    errors.push(`${base}.selectionLimit.max: single choice question must have max 1`)
  }
  if (question.selectionLimit.min < 1 || question.selectionLimit.min > question.selectionLimit.max) {
    errors.push(`${base}.selectionLimit: invalid min/max`)
  }
  if (question.selectionLimit.max > question.options.length) {
    errors.push(`${base}.selectionLimit.max: exceeds option count`)
  }
  question.options.forEach((option, optionIndex) => {
    const optionBase = `${base}.options[${optionIndex}]`
    option.dimensionEffects.forEach((effect, effectIndex) => {
      if (!dimensionIds.has(effect.dimensionId)) {
        errors.push(`${optionBase}.dimensionEffects[${effectIndex}].dimensionId: unknown dimension "${effect.dimensionId}"`)
      }
      if (effect.score < 0 || effect.score > 3) {
        errors.push(`${optionBase}.dimensionEffects[${effectIndex}].score: expected 0..3`)
      }
    })
    option.conflictsWith.forEach((id, index) => {
      if (!optionIds.has(id)) errors.push(`${optionBase}.conflictsWith[${index}]: unknown option "${id}"`)
    })
    option.boundaryIds.forEach((id, index) => {
      if (!boundaryIds.has(id)) errors.push(`${optionBase}.boundaryIds[${index}]: unknown boundary "${id}"`)
    })
    option.resultTextKeys.forEach((id, index) => {
      if (!textKeys.has(id)) errors.push(`${optionBase}.resultTextKeys[${index}]: unknown text key "${id}"`)
    })
    if (option.hasConflict !== (option.conflictsWith.length > 0)) {
      errors.push(`${optionBase}.hasConflict: does not match conflictsWith`)
    }
  })
}

function validateContentUnsafe(input: unknown): ContentValidationResult {
  const errors: string[] = []
  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['$: expected object'] }
  }

  const value = input as RelationshipContentPackage
  if (value.projectId !== 'relationship-manual') errors.push('$.projectId: expected "relationship-manual"')
  if (value.schemaVersion !== 1) errors.push('$.schemaVersion: expected 1')
  if (!value.meta?.title?.trim()) errors.push('$.meta.title: expected non-empty text')
  if (value.meta?.locale !== 'zh-CN') errors.push('$.meta.locale: expected "zh-CN"')
  if (!value.content) return { valid: false, errors: [...errors, '$.content: expected object'] }

  const { dimensions, questions, boundaryPreferences, sentenceFragments, cardRules, safetyRules, uiCopy } = value.content
  if (!Array.isArray(dimensions) || !Array.isArray(questions) || !Array.isArray(boundaryPreferences) || !Array.isArray(sentenceFragments)) {
    return { valid: false, errors: [...errors, '$.content: required arrays are missing'] }
  }
  if (dimensions.some((item) => !isRecord(item)
    || typeof item.dimensionId !== 'string'
    || typeof item.label !== 'string'
    || typeof item.description !== 'string'
    || typeof item.important !== 'boolean'
    || typeof item.fallbackTextKey !== 'string')) {
    return { valid: false, errors: [...errors, '$.content.dimensions: invalid item structure'] }
  }
  if (questions.some((question) => !isRecord(question)
    || typeof question.questionId !== 'string'
    || typeof question.prompt !== 'string'
    || typeof question.multiple !== 'boolean'
    || !isRecord(question.selectionLimit)
    || !Number.isInteger(question.selectionLimit.min)
    || !Number.isInteger(question.selectionLimit.max)
    || !isRecord(question.skipRule)
    || typeof question.skipRule.allowed !== 'boolean'
    || typeof question.skipRule.reason !== 'string'
    || !Array.isArray(question.options)
    || question.options.some((option) => !isRecord(option)
      || typeof option.optionId !== 'string'
      || typeof option.text !== 'string'
      || !Array.isArray(option.dimensionEffects)
      || option.dimensionEffects.some((effect) => !isRecord(effect)
        || typeof effect.dimensionId !== 'string'
        || typeof effect.score !== 'number')
      || !isStringArray(option.tags)
      || !isStringArray(option.scenarios)
      || typeof option.hasConflict !== 'boolean'
      || !isStringArray(option.conflictsWith)
      || !isStringArray(option.boundaryIds)
      || !isStringArray(option.resultTextKeys)))) {
    return { valid: false, errors: [...errors, '$.content.questions: invalid nested item structure'] }
  }
  if (boundaryPreferences.some((item) => !isRecord(item)
    || typeof item.boundaryId !== 'string'
    || typeof item.label !== 'string'
    || typeof item.textKey !== 'string'
    || !isStringArray(item.scenarioTags))) {
    return { valid: false, errors: [...errors, '$.content.boundaryPreferences: invalid item structure'] }
  }
  if (sentenceFragments.some((item) => !isRecord(item)
    || typeof item.textKey !== 'string'
    || typeof item.cardSectionId !== 'string'
    || typeof item.text !== 'string'
    || typeof item.sensitive !== 'boolean')) {
    return { valid: false, errors: [...errors, '$.content.sentenceFragments: invalid item structure'] }
  }
  if (!isRecord(cardRules)
    || !Array.isArray(cardRules.sections)
    || !isStringArray(cardRules.requiredFields)
    || !Array.isArray(cardRules.conflictMergeRules)
    || !Array.isArray(cardRules.boundaryCommitmentRules)
    || !isStringArray(cardRules.defaultCommitmentTextKeys)
    || typeof cardRules.maxParagraphChars !== 'number'
    || typeof cardRules.maxSummaryChars !== 'number'
    || typeof cardRules.title !== 'string'
    || typeof cardRules.disclaimer !== 'string'
    || typeof cardRules.safetyFallback !== 'string'
    || typeof cardRules.neutralSummary !== 'string'
    || typeof cardRules.summaryPrefix !== 'string'
    || !isRecord(cardRules.relationshipLabels)
    || typeof cardRules.relationshipLabels['close-relationship'] !== 'string'
    || typeof cardRules.relationshipLabels.friendship !== 'string'
    || cardRules.sections.some((section) => !isRecord(section)
      || typeof section.sectionId !== 'string'
      || typeof section.title !== 'string'
      || typeof section.maxItems !== 'number'
      || typeof section.fallbackText !== 'string')
    || cardRules.conflictMergeRules.some((rule) => !isRecord(rule)
      || typeof rule.ruleId !== 'string'
      || !isStringArray(rule.optionIds)
      || rule.optionIds.length !== 2
      || typeof rule.cardSectionId !== 'string'
      || typeof rule.text !== 'string'
      || !isStringArray(rule.replacesTextKeys))
    || cardRules.boundaryCommitmentRules.some((rule) => !isRecord(rule)
      || typeof rule.boundaryId !== 'string'
      || !isStringArray(rule.textKeys))) {
    return { valid: false, errors: [...errors, '$.content.cardRules: invalid structure'] }
  }
  if (!Array.isArray(safetyRules) || safetyRules.some((rule) => !isRecord(rule)
    || typeof rule.ruleId !== 'string'
    || typeof rule.label !== 'string'
    || !['reject', 'fallback'].includes(String(rule.action)))) {
    return { valid: false, errors: [...errors, '$.content.safetyRules: invalid item structure'] }
  }
  if (!isRecord(uiCopy)
    || UI_COPY_KEYS.some((key) => typeof uiCopy[key] !== 'string' || !uiCopy[key].trim())
    || Object.values(uiCopy).some((copy) => typeof copy !== 'string' || !copy.trim())) {
    return { valid: false, errors: [...errors, '$.content.uiCopy: expected non-empty text values'] }
  }

  const dimensionIds = new Set(dimensions.map((item) => item.dimensionId))
  const optionIds = new Set(questions.flatMap((question) => question.options.map((option) => option.optionId)))
  const boundaryIds = new Set(boundaryPreferences.map((item) => item.boundaryId))
  const textKeys = new Set(sentenceFragments.map((item) => item.textKey))
  const allIds = [
    ...dimensionIds,
    ...questions.map((item) => item.questionId),
    ...optionIds,
    ...boundaryIds,
    ...textKeys,
  ]
  for (const id of allIds) if (!ID_PATTERN.test(id)) errors.push(`$: illegal id "${id}"`)
  for (const id of duplicateIds(allIds)) errors.push(`$: duplicate id "${id}"`)

  questions.forEach((question, index) => validateQuestion(
    question,
    index,
    dimensionIds,
    optionIds,
    boundaryIds,
    textKeys,
    errors,
  ))

  dimensions.forEach((dimension, index) => {
    if (dimension.important && !textKeys.has(dimension.fallbackTextKey)) {
      errors.push(`$.content.dimensions[${index}].fallbackTextKey: unknown text key "${dimension.fallbackTextKey}"`)
    }
  })
  boundaryPreferences.forEach((boundary, index) => {
    if (!textKeys.has(boundary.textKey)) {
      errors.push(`$.content.boundaryPreferences[${index}].textKey: unknown text key "${boundary.textKey}"`)
    }
  })
  cardRules?.conflictMergeRules?.forEach((rule, index) => {
    rule.optionIds.forEach((id, optionIndex) => {
      if (!optionIds.has(id)) errors.push(`$.content.cardRules.conflictMergeRules[${index}].optionIds[${optionIndex}]: unknown option "${id}"`)
    })
    rule.replacesTextKeys.forEach((id, textIndex) => {
      if (!textKeys.has(id)) errors.push(`$.content.cardRules.conflictMergeRules[${index}].replacesTextKeys[${textIndex}]: unknown text key "${id}"`)
    })
  })
  cardRules.boundaryCommitmentRules.forEach((rule, index) => {
    if (!boundaryIds.has(rule.boundaryId)) {
      errors.push(`$.content.cardRules.boundaryCommitmentRules[${index}].boundaryId: unknown boundary "${rule.boundaryId}"`)
    }
    rule.textKeys.forEach((id, textIndex) => {
      if (!textKeys.has(id)) errors.push(`$.content.cardRules.boundaryCommitmentRules[${index}].textKeys[${textIndex}]: unknown text key "${id}"`)
    })
  })
  cardRules.defaultCommitmentTextKeys.forEach((id, index) => {
    if (!textKeys.has(id)) errors.push(`$.content.cardRules.defaultCommitmentTextKeys[${index}]: unknown text key "${id}"`)
  })

  const visibleText = JSON.stringify({ dimensions, questions, boundaryPreferences, sentenceFragments, cardRules, uiCopy })
  FORBIDDEN_LANGUAGE_PATTERNS.forEach((pattern) => {
    if (pattern.test(visibleText)) errors.push(`$.content: forbidden language matched ${String(pattern)}`)
  })

  const requiredCardFields = ['title', 'relationshipLabel', 'sections', 'shareSummary', 'disclaimer', 'contentVersion']
  if (!cardRules || cardRules.sections.length !== 6) errors.push('$.content.cardRules.sections: expected 6 sections')
  if (!cardRules || requiredCardFields.some((field) => !cardRules.requiredFields.includes(field as never))) {
    errors.push('$.content.cardRules.requiredFields: missing required share card field')
  }
  if (questions.length !== 16) errors.push('$.content.questions: expected 16 questions')
  if (sentenceFragments.length !== 42) errors.push('$.content.sentenceFragments: expected 42 fragments')
  questions.forEach((question, questionIndex) => question.options.forEach((option, optionIndex) => {
    if (Array.from(option.text).length > 60) errors.push(`$.content.questions[${questionIndex}].options[${optionIndex}].text: exceeds 60 characters`)
  }))
  sentenceFragments.forEach((sentence, index) => {
    if (!sentence.text.trim()) errors.push(`$.content.sentenceFragments[${index}].text: expected non-empty text`)
    if (Array.from(sentence.text).length > cardRules.maxParagraphChars) errors.push(`$.content.sentenceFragments[${index}].text: exceeds paragraph limit`)
  })

  return { valid: errors.length === 0, errors }
}

export function validateContent(input: unknown): ContentValidationResult {
  try {
    return validateContentUnsafe(input)
  } catch {
    return { valid: false, errors: ['$: invalid nested structure'] }
  }
}

export function getValidatedContent(): RelationshipContentPackage {
  const content = rawContent as unknown as RelationshipContentPackage
  const result = validateContent(content)
  if (!result.valid) throw new Error(`内容包校验失败：${result.errors.join('；')}`)
  return content
}
