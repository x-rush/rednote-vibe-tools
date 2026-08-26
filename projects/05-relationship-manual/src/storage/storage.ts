import type {
  CardSectionId,
  DraftPayload,
  RelationshipCategory,
  RelationshipContentPackage,
  RelationshipContext,
  RelationshipQuestion,
  SentenceRole,
} from '../content/schema'
import { getAllSentences, getRelationshipBank, RELATIONSHIP_CONTEXTS } from '../content/bank'
import { validateSelection } from '../domain/answers'

export const STORAGE_KEY_V2 = 'xhs-tool:relationship-manual:state:v2'
export const LEGACY_STORAGE_KEY_V1 = 'xhs-tool:relationship-manual:state:v1'
export const STORAGE_KEY = STORAGE_KEY_V2

export type StorageReferences = {
  questionsById?: Map<string, RelationshipQuestion>
  questionBanks?: Record<RelationshipContext, Map<string, RelationshipQuestion>>
  sentenceSectionByTextKey?: Map<string, CardSectionId>
  sentenceRoleByTextKey?: Map<string, SentenceRole>
}

export type DraftMigrationReport = {
  preservedAnswerCount: number
  needsAnswerQuestionIds: string[]
}

const MAX_DRAFT_CHARACTERS = 100_000
const SECTION_IDS: CardSectionId[] = ['contact', 'listening', 'conflict', 'space', 'care', 'boundary', 'repair']
const ROLES: SentenceRole[] = ['need', 'trigger', 'action', 'repair']
const CONTEXTS = ['close-relationship', 'friendship', 'family']
const LEGACY_SECTION_MAP: Record<string, CardSectionId> = {
  companion: 'contact',
  sadness: 'listening',
  disagreement: 'conflict',
  avoid: 'boundary',
  care: 'care',
  commitment: 'repair',
}
const LEGACY_TEXT_SECTION_MAP: Record<string, CardSectionId> = {
  'pref-space': 'space',
  'pref-conflict-timing': 'conflict',
  'pref-care-action': 'care',
  'boundary-private': 'boundary',
  'commit-repair-action': 'repair',
}

export type LoadDraftResult =
  | { status: 'empty' }
  | { status: 'ok'; payload: DraftPayload; contentChanged: boolean; migration?: DraftMigrationReport }
  | { status: 'corrupt'; reason: 'invalid-json' | 'invalid-payload' }
  | { status: 'unsupported-version'; schemaVersion: number }
  | { status: 'unavailable' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isAnswer(value: unknown): value is DraftPayload['answers'][number] {
  return isRecord(value)
    && typeof value.questionId === 'string'
    && isStringArray(value.optionIds)
    && typeof value.skipped === 'boolean'
    && isIsoDate(value.updatedAt)
}

function isCardItem(value: unknown): value is DraftPayload['cardItems'][number] {
  return isRecord(value)
    && typeof value.itemId === 'string'
    && SECTION_IDS.includes(String(value.sectionId) as CardSectionId)
    && ROLES.includes(String(value.role) as SentenceRole)
    && typeof value.suggestedText === 'string'
    && typeof value.editedText === 'string'
    && typeof value.visible === 'boolean'
    && typeof value.sensitive === 'boolean'
    && Number.isInteger(value.order)
    && typeof value.needsReview === 'boolean'
    && (value.sourceTextKey === undefined || typeof value.sourceTextKey === 'string')
    && isStringArray(value.provenanceIds)
}

function isCardResult(value: unknown): value is NonNullable<DraftPayload['lastResult']> {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.relationshipLabel !== 'string'
    || typeof value.shareSummary !== 'string' || typeof value.disclaimer !== 'string'
    || typeof value.contentVersion !== 'string' || !Array.isArray(value.sections)) return false
  return value.sections.every((section) => isRecord(section)
    && SECTION_IDS.includes(String(section.sectionId) as CardSectionId)
    && typeof section.title === 'string'
    && isStringArray(section.paragraphs)
    && isStringArray(section.paragraphRoles)
    && section.paragraphRoles.every((role) => ROLES.includes(role as SentenceRole))
    && isStringArray(section.paragraphIds)
    && Array.isArray(section.paragraphSourceTextKeys)
    && section.paragraphSourceTextKeys.every((item) => item === null || typeof item === 'string')
    && Array.isArray(section.paragraphProvenanceIds)
    && section.paragraphProvenanceIds.every(isStringArray)
    && section.paragraphs.length === section.paragraphRoles.length
    && section.paragraphs.length === section.paragraphIds.length
    && section.paragraphs.length === section.paragraphSourceTextKeys.length
    && section.paragraphs.length === section.paragraphProvenanceIds.length
    && typeof section.sensitive === 'boolean'
    && typeof section.visible === 'boolean'
    && Number.isInteger(section.order))
}

function isDraftPayloadV2(value: unknown): value is DraftPayload {
  if (!isRecord(value)) return false
  return value.schemaVersion === 2
    && typeof value.contentVersion === 'string'
    && isIsoDate(value.updatedAt)
    && typeof value.currentQuestionIndex === 'number'
    && Array.isArray(value.answers) && value.answers.every(isAnswer)
    && Array.isArray(value.cardItems) && value.cardItems.every(isCardItem)
    && (value.lastResult === null || isCardResult(value.lastResult))
    && isRecord(value.settings)
    && typeof value.settings.compactMode === 'boolean'
    && typeof value.settings.showSensitiveInCompact === 'boolean'
    && (value.conflictRuleDecisions === undefined || (isRecord(value.conflictRuleDecisions)
      && Object.values(value.conflictRuleDecisions).every((decision) => ['adopted', 'preserved', 'dismissed'].includes(String(decision)))))
    && ['chapterIntro', 'questionnaire', 'review', 'result', 'editCard', 'savedResult'].includes(String(value.page))
    && CONTEXTS.includes(String(value.relationshipContext))
    && isStringArray(value.seenChapterIds)
    && value.seenChapterIds.every((id) => SECTION_IDS.includes(id as RelationshipCategory))
}

type LegacyDraft = {
  schemaVersion: 1
  contentVersion: string
  updatedAt: string
  page: 'questionnaire' | 'review' | 'result' | 'editCard' | 'savedResult'
  relationshipContext: 'close-relationship' | 'friendship'
  currentQuestionIndex: number
  answers: DraftPayload['answers']
  cardItems: Array<Record<string, unknown>>
  lastResult: unknown
  settings: DraftPayload['settings']
}

function isLegacyDraft(value: unknown): value is LegacyDraft {
  if (!isRecord(value)) return false
  return value.schemaVersion === 1
    && typeof value.contentVersion === 'string'
    && isIsoDate(value.updatedAt)
    && typeof value.currentQuestionIndex === 'number'
    && Array.isArray(value.answers) && value.answers.every(isAnswer)
    && Array.isArray(value.cardItems) && value.cardItems.every((item) => isRecord(item)
      && typeof item.itemId === 'string'
      && typeof item.sectionId === 'string'
      && typeof item.suggestedText === 'string'
      && typeof item.editedText === 'string'
      && typeof item.visible === 'boolean'
      && typeof item.sensitive === 'boolean'
      && Number.isInteger(item.order)
      && typeof item.needsReview === 'boolean'
      && (item.sourceTextKey === undefined || typeof item.sourceTextKey === 'string')
      && isStringArray(item.provenanceIds))
    && isRecord(value.settings)
    && typeof value.settings.compactMode === 'boolean'
    && typeof value.settings.showSensitiveInCompact === 'boolean'
    && ['questionnaire', 'review', 'result', 'editCard', 'savedResult'].includes(String(value.page))
    && ['close-relationship', 'friendship'].includes(String(value.relationshipContext))
}

function hasForbiddenMedia(value: unknown): boolean {
  if (typeof value === 'string') return /data:image|;base64,|^blob:/iu.test(value)
  if (Array.isArray(value)) return value.some(hasForbiddenMedia)
  if (isRecord(value)) return Object.values(value).some(hasForbiddenMedia)
  return false
}

function isBounded(payload: DraftPayload): boolean {
  const resultParagraphCount = payload.lastResult?.sections.reduce((count, section) => count + section.paragraphs.length, 0) ?? 0
  const conflictDecisions = Object.entries(payload.conflictRuleDecisions ?? {})
  return payload.answers.length <= 21
    && payload.cardItems.length <= 84
    && payload.currentQuestionIndex >= 0
    && payload.currentQuestionIndex <= 20
    && payload.seenChapterIds.length <= 7
    && conflictDecisions.length <= 12
    && conflictDecisions.every(([ruleId]) => ruleId.length <= 100)
    && payload.answers.every((answer) => answer.optionIds.length <= 3
      && answer.questionId.length <= 80
      && answer.optionIds.every((id) => id.length <= 80))
    && payload.cardItems.every((item) => Array.from(item.editedText).length <= 120
      && Array.from(item.suggestedText).length <= 120
      && item.itemId.length <= 160
      && (item.sourceTextKey?.length ?? 0) <= 80
      && item.provenanceIds.length <= 16
      && item.provenanceIds.every((id) => id.length <= 160))
    && (payload.lastResult === null || (
      payload.lastResult.sections.length <= 7
      && resultParagraphCount <= 84
      && Array.from(payload.lastResult.title).length <= 80
      && Array.from(payload.lastResult.relationshipLabel).length <= 40
      && Array.from(payload.lastResult.shareSummary).length <= 52
      && Array.from(payload.lastResult.disclaimer).length <= 240
      && payload.lastResult.sections.every((section) => section.paragraphs.length <= 14
        && section.paragraphs.every((text) => Array.from(text).length <= 120)
        && section.paragraphIds.every((id) => id.length <= 160)
        && section.paragraphProvenanceIds.every((ids) => ids.length <= 16 && ids.every((id) => id.length <= 160)))
    ))
}

function cleanAnswers(
  answers: DraftPayload['answers'],
  references?: StorageReferences,
  relationshipContext?: RelationshipContext,
) {
  if (!references) return answers
  const questionsById = relationshipContext
    ? references.questionBanks?.[relationshipContext] ?? references.questionsById
    : references.questionsById
  if (!questionsById) return answers
  return answers.filter((answer) => {
    const question = questionsById.get(answer.questionId)
    return question !== undefined
      && new Set(answer.optionIds).size === answer.optionIds.length
      && validateSelection(question, answer.optionIds, answer.skipped).valid
  })
}

export function buildStorageReferences(content: RelationshipContentPackage): StorageReferences {
  return {
    questionBanks: Object.fromEntries(RELATIONSHIP_CONTEXTS.map((context) => [
      context,
      new Map(getRelationshipBank(content, context).questions.map((question) => [question.questionId, question])),
    ])) as StorageReferences['questionBanks'],
    sentenceSectionByTextKey: new Map(getAllSentences(content)
      .map((sentence) => [sentence.textKey, sentence.cardSectionId])),
    sentenceRoleByTextKey: new Map(getAllSentences(content)
      .map((sentence) => [sentence.textKey, sentence.role])),
  }
}

export function migrateAnswers(
  answers: DraftPayload['answers'],
  fromContentVersion: string,
  context: RelationshipContext,
  content: RelationshipContentPackage,
): { answers: DraftPayload['answers']; preservedAnswerCount: number } {
  const migration = content.content.answerMigrations.find((item) => item.fromContentVersion === fromContentVersion)
  const mappings = migration?.byContext[context]
  if (!mappings) {
    const preserved = cleanAnswers(answers, buildStorageReferences(content), context)
    return { answers: preserved, preservedAnswerCount: preserved.length }
  }
  const migrated = answers.flatMap((answer) => {
    const mapping = mappings[answer.questionId]
    if (!mapping) return []
    if (answer.skipped) return [{ ...answer, questionId: mapping.questionId, optionIds: [] }]
    const optionIds = answer.optionIds.map((optionId) => mapping.optionIds[optionId]).filter(Boolean)
    if (optionIds.length !== answer.optionIds.length) return []
    return [{ ...answer, questionId: mapping.questionId, optionIds }]
  })
  const byQuestion = new Map<string, DraftPayload['answers'][number]>()
  for (const answer of migrated) {
    const previous = byQuestion.get(answer.questionId)
    if (!previous || Date.parse(answer.updatedAt) >= Date.parse(previous.updatedAt)) byQuestion.set(answer.questionId, answer)
  }
  const result = [...byQuestion.values()]
  return { answers: result, preservedAnswerCount: result.length }
}

function migrateLegacyCardItem(item: Record<string, unknown>, references?: StorageReferences): DraftPayload['cardItems'][number] | null {
  const sourceTextKey = typeof item.sourceTextKey === 'string' ? item.sourceTextKey : undefined
  const mappedSection = sourceTextKey ? references?.sentenceSectionByTextKey?.get(sourceTextKey) : undefined
  const legacyTextSection = sourceTextKey ? LEGACY_TEXT_SECTION_MAP[sourceTextKey] : undefined
  const legacySection = typeof item.sectionId === 'string' ? LEGACY_SECTION_MAP[item.sectionId] : undefined
  const sectionId = mappedSection ?? legacyTextSection ?? legacySection
  if (!sectionId) return null
  const mappedRole = sourceTextKey ? references?.sentenceRoleByTextKey?.get(sourceTextKey) : undefined
  const role = mappedRole ?? (item.sectionId === 'avoid' ? 'trigger' : item.sectionId === 'commitment' ? 'repair' : 'need')
  return {
    itemId: String(item.itemId),
    sectionId,
    role,
    sourceTextKey,
    provenanceIds: item.provenanceIds as string[],
    suggestedText: String(item.suggestedText),
    editedText: String(item.editedText),
    visible: Boolean(item.visible),
    sensitive: Boolean(item.sensitive),
    order: Number(item.order),
    needsReview: true,
  }
}

function migrateV1Draft(
  legacy: LegacyDraft,
  currentContentVersion: string,
  references?: StorageReferences,
  content?: RelationshipContentPackage,
): { payload: DraftPayload; migration?: DraftMigrationReport } {
  // Schema-v1 and content-v2 used the same legacy question IDs. Reuse the
  // explicit v2 mapping so an actual v1-key draft reaches the active bank.
  const migrationSourceVersion = legacy.contentVersion === '1.0.0' ? '2.0.0' : legacy.contentVersion
  const answerMigration = content
    ? migrateAnswers(legacy.answers, migrationSourceVersion, legacy.relationshipContext, content)
    : null
  const answers = cleanAnswers(answerMigration?.answers ?? legacy.answers, references, legacy.relationshipContext)
  const payload: DraftPayload = {
    schemaVersion: 2,
    contentVersion: currentContentVersion,
    updatedAt: legacy.updatedAt,
    page: answers.length > 0 ? 'review' : 'questionnaire',
    relationshipContext: legacy.relationshipContext,
    currentQuestionIndex: Math.min(20, Math.max(0, legacy.currentQuestionIndex)),
    seenChapterIds: [],
    answers,
    cardItems: legacy.cardItems.flatMap((item) => {
      const migrated = migrateLegacyCardItem(item, references)
      return migrated ? [migrated] : []
    }),
    lastResult: null,
    conflictRuleDecisions: {},
    settings: legacy.settings,
  }
  if (!content || !answerMigration) return { payload }
  const answeredIds = new Set(answers.map((answer) => answer.questionId))
  return {
    payload,
    migration: {
      preservedAnswerCount: answerMigration.preservedAnswerCount,
      needsAnswerQuestionIds: getRelationshipBank(content, legacy.relationshipContext).questions
        .map((question) => question.questionId)
        .filter((questionId) => !answeredIds.has(questionId)),
    },
  }
}

export function saveDraft(
  storage: Pick<Storage, 'setItem'>,
  payload: DraftPayload,
): { ok: true } | { ok: false; error: 'forbidden-media' | 'payload-too-large' | 'write-failed' } {
  if (hasForbiddenMedia(payload)) return { ok: false, error: 'forbidden-media' }
  if (!isBounded(payload)) return { ok: false, error: 'payload-too-large' }
  const serialized = JSON.stringify(payload)
  if (serialized.length > MAX_DRAFT_CHARACTERS) return { ok: false, error: 'payload-too-large' }
  try {
    storage.setItem(STORAGE_KEY_V2, serialized)
    return { ok: true }
  } catch {
    return { ok: false, error: 'write-failed' }
  }
}

function parseStoredDraft(raw: string): unknown | 'invalid-json' {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return 'invalid-json'
  }
}

export function loadDraft(
  storage: Pick<Storage, 'getItem'>,
  content: RelationshipContentPackage,
  references?: StorageReferences,
): LoadDraftResult
export function loadDraft(
  storage: Pick<Storage, 'getItem'>,
  currentContentVersion: string,
  references?: StorageReferences,
): LoadDraftResult
export function loadDraft(
  storage: Pick<Storage, 'getItem'>,
  contentOrVersion: RelationshipContentPackage | string,
  providedReferences?: StorageReferences,
): LoadDraftResult {
  const content = typeof contentOrVersion === 'string' ? undefined : contentOrVersion
  const currentContentVersion = typeof contentOrVersion === 'string' ? contentOrVersion : contentOrVersion.contentVersion
  const references = providedReferences ?? (content ? buildStorageReferences(content) : undefined)
  let rawV2: string | null
  let rawV1: string | null = null
  try {
    rawV2 = storage.getItem(STORAGE_KEY_V2)
    if (rawV2 === null) rawV1 = storage.getItem(LEGACY_STORAGE_KEY_V1)
  } catch {
    return { status: 'unavailable' }
  }
  const raw = rawV2 ?? rawV1
  if (raw === null) return { status: 'empty' }
  if (raw.length > MAX_DRAFT_CHARACTERS) return { status: 'corrupt', reason: 'invalid-payload' }
  const parsed = parseStoredDraft(raw)
  if (parsed === 'invalid-json') return { status: 'corrupt', reason: 'invalid-json' }
  if (isRecord(parsed) && typeof parsed.schemaVersion === 'number' && ![1, 2].includes(parsed.schemaVersion)) {
    return { status: 'unsupported-version', schemaVersion: parsed.schemaVersion }
  }
  if (rawV2 === null) {
    if (!isLegacyDraft(parsed) || hasForbiddenMedia(parsed)) return { status: 'corrupt', reason: 'invalid-payload' }
    const migrated = migrateV1Draft(parsed, currentContentVersion, references, content)
    const { payload } = migrated
    if (!isBounded(payload)) return { status: 'corrupt', reason: 'invalid-payload' }
    return { status: 'ok', payload, contentChanged: true, ...(migrated.migration ? { migration: migrated.migration } : {}) }
  }
  if (!isDraftPayloadV2(parsed) || hasForbiddenMedia(parsed) || !isBounded(parsed)) {
    return { status: 'corrupt', reason: 'invalid-payload' }
  }
  const answerMigration = content && parsed.contentVersion !== currentContentVersion
    ? migrateAnswers(parsed.answers, parsed.contentVersion, parsed.relationshipContext, content)
    : null
  const answers = cleanAnswers(
    answerMigration?.answers ?? parsed.answers,
    references,
    parsed.relationshipContext,
  )
  const contentChanged = parsed.contentVersion !== currentContentVersion
  const payload: DraftPayload = contentChanged
    ? {
        ...parsed,
        contentVersion: currentContentVersion,
        page: answers.length > 0 ? 'review' : 'questionnaire',
        answers,
        cardItems: parsed.cardItems.map((item) => ({ ...item, needsReview: true })),
        lastResult: null,
      }
    : { ...parsed, answers }
  const activeQuestionIds = content
    ? getRelationshipBank(content, parsed.relationshipContext).questions.map((question) => question.questionId)
    : []
  const answeredIds = new Set(answers.map((answer) => answer.questionId))
  const migration = answerMigration ? {
    preservedAnswerCount: answerMigration.preservedAnswerCount,
    needsAnswerQuestionIds: activeQuestionIds.filter((questionId) => !answeredIds.has(questionId)),
  } : undefined
  return { status: 'ok', payload, contentChanged, ...(migration ? { migration } : {}) }
}

export function clearDraft(storage: Pick<Storage, 'removeItem'>): boolean {
  try {
    storage.removeItem(STORAGE_KEY_V2)
    storage.removeItem(LEGACY_STORAGE_KEY_V1)
    return true
  } catch {
    return false
  }
}
