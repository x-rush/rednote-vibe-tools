import rawContent from './content.json'
import { RELATIONSHIP_CONTEXTS } from './bank'
import { validateSelection } from '../domain/answers'
import type {
  ContentValidationResult,
  ManualSentence,
  RelationshipCategory,
  RelationshipContentPackage,
  RelationshipContext,
  RelationshipQuestion,
  ResultVoice,
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
const CHAPTER_CATEGORIES: RelationshipCategory[] = [
  'contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair',
]
const CONTEXT_PREFIXES: Record<RelationshipContext, string> = {
  'close-relationship': 'close-',
  friendship: 'friend-',
  family: 'family-',
}
const RESULT_VOICES: ResultVoice[] = ['request', 'boundary', 'self-commitment']
const SENTENCE_ROLES = ['need', 'trigger', 'action', 'repair']
const NPC_POSES = ['daily', 'listening', 'reminder']
const UI_COPY_KEYS = [
  'landingEyebrow', 'landingLead', 'privacyTitle', 'privacyBody', 'introEyebrow', 'introTitle',
  'introBody', 'contextHint', 'principlesTitle', 'guideName', 'guideRole', 'guideMessage',
  'reviewEyebrow', 'reviewTitle', 'reviewBody',
  'resultReadyEyebrow', 'resultSavedEyebrow', 'resultTitle', 'resultSavedTitle', 'resultBody',
  'shareExportLabel', 'shareExportingLabel', 'shareExportDescription', 'shareExportSuccess', 'shareExportFailure',
  'editorEyebrow', 'editorTitle', 'editorBody', 'editorReviewNote', 'emptyTitle', 'emptyBody',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    if (seen.has(value)) return true
    seen.add(value)
    return false
  })
}

function hasQuestionShape(value: unknown): value is RelationshipQuestion {
  if (!isRecord(value)
    || typeof value.questionId !== 'string'
    || !CHAPTER_CATEGORIES.includes(String(value.category) as RelationshipCategory)
    || typeof value.sceneLead !== 'string'
    || typeof value.prompt !== 'string'
    || !Array.isArray(value.resultVoices)
    || !value.resultVoices.every((voice) => RESULT_VOICES.includes(String(voice) as ResultVoice))
    || typeof value.multiple !== 'boolean'
    || !isRecord(value.selectionLimit)
    || !Number.isInteger(value.selectionLimit.min)
    || !Number.isInteger(value.selectionLimit.max)
    || !isRecord(value.skipRule)
    || typeof value.skipRule.allowed !== 'boolean'
    || typeof value.skipRule.reason !== 'string'
    || !Array.isArray(value.options)) return false

  return value.options.every((option) => isRecord(option)
    && typeof option.optionId === 'string'
    && typeof option.text === 'string'
    && typeof option.subtitle === 'string'
    && Array.isArray(option.dimensionEffects)
    && option.dimensionEffects.every((effect) => isRecord(effect)
      && typeof effect.dimensionId === 'string'
      && typeof effect.score === 'number')
    && [1, 2, 3].includes(Number(option.intensity))
    && isStringArray(option.tags)
    && isStringArray(option.scenarios)
    && typeof option.hasConflict === 'boolean'
    && isStringArray(option.conflictsWith)
    && isStringArray(option.boundaryIds)
    && isStringArray(option.resultTextKeys))
}

function validateQuestion(
  question: RelationshipQuestion,
  base: string,
  dimensionIds: Set<string>,
  optionIds: Set<string>,
  boundaryIds: Set<string>,
  sentenceByKey: Map<string, ManualSentence>,
  errors: string[],
) {
  if (!question.multiple && question.selectionLimit.max !== 1) {
    errors.push(`${base}.selectionLimit.max: single choice question must have max 1`)
  }
  if (question.selectionLimit.min < 1 || question.selectionLimit.min > question.selectionLimit.max) {
    errors.push(`${base}.selectionLimit: invalid min/max`)
  }
  if (question.selectionLimit.max > question.options.length) {
    errors.push(`${base}.selectionLimit.max: exceeds option count`)
  }
  if (Array.from(question.sceneLead).length < 28) errors.push(`${base}.sceneLead: expected at least 28 characters`)

  question.options.forEach((option, optionIndex) => {
    const optionBase = `${base}.options[${optionIndex}]`
    if (Array.from(option.text).length > 60) errors.push(`${optionBase}.text: exceeds 60 characters`)
    if (Array.from(option.subtitle).length < 16) errors.push(`${optionBase}.subtitle: expected at least 16 characters`)
    option.dimensionEffects.forEach((effect, effectIndex) => {
      if (!dimensionIds.has(effect.dimensionId)) {
        errors.push(`${optionBase}.dimensionEffects[${effectIndex}].dimensionId: unknown dimension "${effect.dimensionId}"`)
      }
      if (effect.score < 0 || effect.score > 3) errors.push(`${optionBase}.dimensionEffects[${effectIndex}].score: expected 0..3`)
    })
    option.conflictsWith.forEach((id, index) => {
      if (!optionIds.has(id)) errors.push(`${optionBase}.conflictsWith[${index}]: cross-bank option "${id}"`)
    })
    option.boundaryIds.forEach((id, index) => {
      if (!boundaryIds.has(id)) errors.push(`${optionBase}.boundaryIds[${index}]: cross-bank boundary "${id}"`)
    })
    if (option.hasConflict !== (option.conflictsWith.length > 0)) {
      errors.push(`${optionBase}.hasConflict: does not match conflictsWith`)
    }
    if ((option.neutral || option.tags.includes('not-applicable'))
      && (option.resultTextKeys.length > 0 || option.boundaryIds.length > 0)) {
      errors.push(`${optionBase}: neutral option must not generate results`)
    }
    option.resultTextKeys.forEach((textKey, textIndex) => {
      const sentence = sentenceByKey.get(textKey)
      if (!sentence) {
        errors.push(`${optionBase}.resultTextKeys[${textIndex}]: cross-bank result key "${textKey}"`)
        return
      }
      if (!question.resultVoices.includes(sentence.voice)) {
        errors.push(`${optionBase}.resultTextKeys[${textIndex}]: result voice mismatch`)
      }
      if (!sentence.sensitive && Math.abs(option.intensity - Number(sentence.intensity)) > 1) {
        errors.push(`${optionBase}.resultTextKeys[${textIndex}]: result intensity mismatch`)
      }
    })
  })
}

function validateContentUnsafe(input: unknown): ContentValidationResult {
  const errors: string[] = []
  if (!isRecord(input)) return { valid: false, errors: ['$: expected object'] }
  const value = input as unknown as RelationshipContentPackage
  if (value.projectId !== 'relationship-manual') errors.push('$.projectId: expected "relationship-manual"')
  if (value.schemaVersion !== 3) errors.push('$.schemaVersion: expected 3')
  if (!value.meta?.title?.trim()) errors.push('$.meta.title: expected non-empty text')
  if (value.meta?.locale !== 'zh-CN') errors.push('$.meta.locale: expected "zh-CN"')
  if (!isRecord(value.content)) return { valid: false, errors: [...errors, '$.content: expected object'] }

  const { chapters, contextCopy, npcCues, dimensions, relationshipBanks, cardRules, safetyRules, uiCopy } = value.content
  if (!Array.isArray(chapters) || !Array.isArray(npcCues) || !Array.isArray(dimensions)) {
    return { valid: false, errors: [...errors, '$.content: required arrays are missing'] }
  }
  if (!isRecord(relationshipBanks)) {
    return { valid: false, errors: [...errors, '$.content.relationshipBanks: expected three banks'] }
  }
  if (chapters.some((chapter) => !isRecord(chapter)
    || typeof chapter.chapterId !== 'string'
    || !CHAPTER_CATEGORIES.includes(String(chapter.category) as RelationshipCategory)
    || typeof chapter.title !== 'string'
    || typeof chapter.shortTitle !== 'string'
    || typeof chapter.folderLabel !== 'string')) {
    errors.push('$.content.chapters: invalid item structure')
  }
  if (JSON.stringify(chapters.map((chapter) => chapter.category)) !== JSON.stringify(CHAPTER_CATEGORIES)) {
    errors.push('$.content.chapters: expected frozen seven-chapter order')
  }
  if (!isRecord(contextCopy) || RELATIONSHIP_CONTEXTS.some((context) => {
    const copy = contextCopy[context]
    return !isRecord(copy)
      || typeof copy.label !== 'string'
      || typeof copy.subjectLabel !== 'string'
      || !isRecord(copy.chapterLeads)
      || CHAPTER_CATEGORIES.some((category) => typeof copy.chapterLeads[category] !== 'string')
  })) errors.push('$.content.contextCopy: invalid structure')

  if (npcCues.some((cue) => !isRecord(cue)
    || typeof cue.cueId !== 'string'
    || !NPC_POSES.includes(String(cue.pose))
    || cue.speaker !== '小满'
    || cue.roleLabel !== '关系卡片整理员'
    || typeof cue.text !== 'string'
    || typeof cue.primaryAction !== 'string'
    || typeof cue.skippable !== 'boolean')) {
    errors.push('$.content.npcCues: invalid item structure')
  }

  const dimensionIds = new Set<string>()
  if (dimensions.some((dimension) => {
    if (!isRecord(dimension)
      || typeof dimension.dimensionId !== 'string'
      || typeof dimension.label !== 'string'
      || typeof dimension.description !== 'string'
      || typeof dimension.important !== 'boolean'
      || !isRecord(dimension.fallbackTextKeys)
      || RELATIONSHIP_CONTEXTS.some((context) => typeof dimension.fallbackTextKeys[context] !== 'string')) return true
    dimensionIds.add(dimension.dimensionId)
    return false
  })) errors.push('$.content.dimensions: invalid item structure')

  const globalIds: string[] = [
    ...chapters.flatMap((chapter) => isRecord(chapter) && typeof chapter.chapterId === 'string' ? [chapter.chapterId] : []),
    ...npcCues.flatMap((cue) => isRecord(cue) && typeof cue.cueId === 'string' ? [cue.cueId] : []),
    ...dimensionIds,
  ]

  for (const context of RELATIONSHIP_CONTEXTS) {
    const base = `$.content.relationshipBanks.${context}`
    const bank = relationshipBanks[context]
    if (!isRecord(bank)
      || !Array.isArray(bank.questions)
      || !Array.isArray(bank.boundaryPreferences)
      || !Array.isArray(bank.sentenceFragments)
      || !Array.isArray(bank.conflictMergeRules)
      || !Array.isArray(bank.boundaryCommitmentRules)
      || !isStringArray(bank.defaultCommitmentTextKeys)
      || !isRecord(bank.sectionFallbacks)) {
      errors.push(`${base}: invalid structure`)
      continue
    }
    if (bank.questions.some((question) => !hasQuestionShape(question))) {
      errors.push(`${base}.questions: invalid nested item structure`)
      continue
    }
    if (bank.sentenceFragments.some((sentence) => !isRecord(sentence)
      || typeof sentence.textKey !== 'string'
      || !CHAPTER_CATEGORIES.includes(String(sentence.cardSectionId) as RelationshipCategory)
      || !SENTENCE_ROLES.includes(String(sentence.role))
      || !RESULT_VOICES.includes(String(sentence.voice) as ResultVoice)
      || ![1, 2, 3].includes(Number(sentence.intensity))
      || typeof sentence.text !== 'string'
      || typeof sentence.sensitive !== 'boolean')) {
      errors.push(`${base}.sentenceFragments: invalid item structure`)
      continue
    }
    if (CHAPTER_CATEGORIES.some((category) => {
      const fallback = bank.sectionFallbacks[category]
      return !isRecord(fallback) || typeof fallback.needText !== 'string' || typeof fallback.actionText !== 'string'
    })) errors.push(`${base}.sectionFallbacks: invalid structure`)

    const questions = bank.questions as RelationshipQuestion[]
    const optionIds = new Set(questions.flatMap((question) => question.options.map((option) => option.optionId)))
    const boundaryIds = new Set(bank.boundaryPreferences.flatMap((boundary) => (
      isRecord(boundary) && typeof boundary.boundaryId === 'string' ? [boundary.boundaryId] : []
    )))
    const sentences = bank.sentenceFragments as ManualSentence[]
    const sentenceByKey = new Map(sentences.map((sentence) => [sentence.textKey, sentence]))
    const conflictRules = bank.conflictMergeRules.filter((rule) => isRecord(rule)
      && typeof rule.ruleId === 'string'
      && Array.isArray(rule.optionIds)
      && rule.optionIds.length === 2
      && isStringArray(rule.optionIds)
      && CHAPTER_CATEGORIES.includes(String(rule.cardSectionId) as RelationshipCategory)
      && typeof rule.text === 'string'
      && isStringArray(rule.replacesTextKeys))
    if (conflictRules.length !== bank.conflictMergeRules.length) {
      errors.push(`${base}.conflictMergeRules: invalid item structure`)
    }
    const prefix = CONTEXT_PREFIXES[context]
    const localIds = [
      ...questions.map((question) => question.questionId),
      ...optionIds,
      ...boundaryIds,
      ...sentences.map((sentence) => sentence.textKey),
      ...conflictRules.map((rule) => String(rule.ruleId)),
    ]
    globalIds.push(...localIds)
    for (const id of localIds) {
      if (!id.startsWith(prefix)) errors.push(`${base}: id "${id}" must start with "${prefix}"`)
    }
    if (questions.length !== 21) errors.push(`${base}.questions: expected 21 questions`)
    for (const category of CHAPTER_CATEGORIES) {
      if (questions.filter((question) => question.category === category).length !== 3) {
        errors.push(`${base}.questions: expected 3 questions for ${category}`)
      }
    }
    questions.forEach((question, index) => validateQuestion(
      question,
      `${base}.questions[${index}]`,
      dimensionIds,
      optionIds,
      boundaryIds,
      sentenceByKey as Map<string, ManualSentence>,
      errors,
    ))
    const questionByOptionId = new Map(questions.flatMap((question) => (
      question.options.map((option) => [option.optionId, question] as const)
    )))
    const optionById = new Map(questions.flatMap((question) => (
      question.options.map((option) => [option.optionId, option] as const)
    )))
    for (const rule of conflictRules) {
      const ruleBase = `${base}.conflictMergeRules.${String(rule.ruleId)}`
      const ruleOptionIds = rule.optionIds as string[]
      const ruleQuestions = ruleOptionIds.map((optionId) => questionByOptionId.get(optionId))
      const firstQuestion = ruleQuestions[0]
      const secondQuestion = ruleQuestions[1]
      if (new Set(ruleOptionIds).size !== 2) errors.push(`${ruleBase}: expected two distinct option IDs`)
      if (!firstQuestion || !secondQuestion) {
        errors.push(`${ruleBase}: cross-bank option reference`)
      } else if (firstQuestion.questionId === secondQuestion.questionId
        && !validateSelection(firstQuestion, ruleOptionIds, false).valid) {
        errors.push(`${ruleBase}: unreachable option combination`)
      }
      const triggeringTextKeys = new Set(ruleOptionIds.flatMap((optionId) => optionById.get(optionId)?.resultTextKeys ?? []))
      for (const textKey of rule.replacesTextKeys as string[]) {
        const sentence = sentenceByKey.get(textKey)
        if (!sentence) errors.push(`${ruleBase}: cross-bank replacement text key`)
        else if (!triggeringTextKeys.has(textKey)) errors.push(`${ruleBase}: replacement not emitted by triggering options`)
        else if (sentence.cardSectionId !== rule.cardSectionId) errors.push(`${ruleBase}: replacement section mismatch`)
      }
      const hasCue = npcCues.some((cue) => isRecord(cue)
        && cue.trigger === 'conflict'
        && cue.relationshipContext === context
        && cue.conflictRuleId === rule.ruleId)
      if (!hasCue) errors.push(`${ruleBase}: missing scoped NPC cue`)
    }
    for (const dimension of dimensions) {
      if (!isRecord(dimension) || !dimension.important || !isRecord(dimension.fallbackTextKeys)) continue
      const textKey = dimension.fallbackTextKeys[context]
      if (typeof textKey !== 'string' || !sentenceByKey.has(textKey)) {
        errors.push(`${base}: missing contextual fallback for ${String(dimension.dimensionId)}`)
      }
    }
    for (const sentence of sentences) {
      if (!sentence.text.trim()) errors.push(`${base}.sentenceFragments: expected non-empty text`)
      if (Array.from(sentence.text).length > Number(cardRules?.maxParagraphChars ?? 120)) {
        errors.push(`${base}.sentenceFragments: exceeds paragraph limit`)
      }
    }
  }

  for (const cue of npcCues) {
    if (!isRecord(cue) || cue.trigger !== 'conflict') continue
    const context = cue.relationshipContext
    const ruleId = cue.conflictRuleId
    const scopedBank = RELATIONSHIP_CONTEXTS.includes(String(context) as RelationshipContext)
      ? relationshipBanks[context as RelationshipContext]
      : undefined
    if (!scopedBank
      || typeof ruleId !== 'string'
      || !scopedBank.conflictMergeRules.some((rule) => (
        isRecord(rule) && rule.ruleId === ruleId
      ))) {
      errors.push(`$.content.npcCues.${String(cue.cueId)}: unknown conflict rule`)
    }
  }

  if (Array.isArray(safetyRules)) {
    globalIds.push(...safetyRules.flatMap((rule) => (
      isRecord(rule) && typeof rule.ruleId === 'string' ? [rule.ruleId] : []
    )))
  }
  for (const id of globalIds) if (!ID_PATTERN.test(id)) errors.push(`$: illegal id "${id}"`)
  for (const id of duplicates(globalIds)) errors.push(`$: duplicate id "${id}"`)

  if (!isRecord(cardRules)
    || !Array.isArray(cardRules.sections)
    || cardRules.sections.length !== 7
    || !isStringArray(cardRules.requiredFields)
    || typeof cardRules.maxParagraphChars !== 'number'
    || typeof cardRules.maxSummaryChars !== 'number'
    || typeof cardRules.title !== 'string'
    || typeof cardRules.disclaimer !== 'string'
    || typeof cardRules.neutralSummary !== 'string'
    || typeof cardRules.summaryPrefix !== 'string'
    || !isRecord(cardRules.relationshipLabels)
    || RELATIONSHIP_CONTEXTS.some((context) => typeof cardRules.relationshipLabels?.[context] !== 'string')) {
    errors.push('$.content.cardRules: invalid structure')
  }
  if (!Array.isArray(safetyRules) || safetyRules.some((rule) => !isRecord(rule)
    || typeof rule.ruleId !== 'string'
    || typeof rule.label !== 'string'
    || !['reject', 'fallback'].includes(String(rule.action)))) {
    errors.push('$.content.safetyRules: invalid item structure')
  }
  if (!isRecord(uiCopy)
    || UI_COPY_KEYS.some((key) => typeof uiCopy[key] !== 'string' || !uiCopy[key].trim())) {
    errors.push('$.content.uiCopy: expected non-empty text values')
  }

  const visibleText = JSON.stringify({ chapters, contextCopy, npcCues, dimensions, relationshipBanks, cardRules, safetyRules, uiCopy })
  for (const pattern of FORBIDDEN_LANGUAGE_PATTERNS) {
    if (pattern.test(visibleText)) errors.push(`$.content: forbidden language matched ${String(pattern)}`)
  }
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
