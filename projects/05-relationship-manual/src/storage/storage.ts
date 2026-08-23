import type { DraftPayload, RelationshipQuestion } from '../content/schema'
import { validateSelection } from '../domain/answers'

export const STORAGE_KEY = 'xhs-tool:relationship-manual:state:v1'

export type StorageReferences = {
  questionsById: Map<string, RelationshipQuestion>
}

const MAX_DRAFT_CHARACTERS = 100_000

export type LoadDraftResult =
  | { status: 'empty' }
  | { status: 'ok'; payload: DraftPayload; contentChanged: boolean }
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
    && ['companion', 'sadness', 'disagreement', 'avoid', 'care', 'commitment'].includes(String(value.sectionId))
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
    && ['companion', 'sadness', 'disagreement', 'avoid', 'care', 'commitment'].includes(String(section.sectionId))
    && typeof section.title === 'string'
    && isStringArray(section.paragraphs)
    && isStringArray(section.paragraphIds)
    && Array.isArray(section.paragraphSourceTextKeys)
    && section.paragraphSourceTextKeys.every((item) => item === null || typeof item === 'string')
    && Array.isArray(section.paragraphProvenanceIds)
    && section.paragraphProvenanceIds.every(isStringArray)
    && section.paragraphs.length === section.paragraphIds.length
    && section.paragraphs.length === section.paragraphSourceTextKeys.length
    && section.paragraphs.length === section.paragraphProvenanceIds.length
    && typeof section.sensitive === 'boolean'
    && typeof section.visible === 'boolean'
    && Number.isInteger(section.order))
}

function isDraftPayload(value: unknown): value is DraftPayload {
  if (!isRecord(value)) return false
  return value.schemaVersion === 1
    && typeof value.contentVersion === 'string'
    && typeof value.updatedAt === 'string'
    && typeof value.currentQuestionIndex === 'number'
    && isIsoDate(value.updatedAt)
    && Array.isArray(value.answers) && value.answers.every(isAnswer)
    && Array.isArray(value.cardItems) && value.cardItems.every(isCardItem)
    && (value.lastResult === null || isCardResult(value.lastResult))
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
  return payload.answers.length <= 16
    && payload.cardItems.length <= 42
    && payload.currentQuestionIndex >= 0
    && payload.currentQuestionIndex <= 15
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
      payload.lastResult.sections.length <= 6
      && resultParagraphCount <= 42
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

export function saveDraft(
  storage: Pick<Storage, 'setItem'>,
  payload: DraftPayload,
): { ok: true } | { ok: false; error: 'forbidden-media' | 'payload-too-large' | 'write-failed' } {
  if (hasForbiddenMedia(payload)) return { ok: false, error: 'forbidden-media' }
  if (!isBounded(payload)) return { ok: false, error: 'payload-too-large' }
  const serialized = JSON.stringify(payload)
  if (serialized.length > MAX_DRAFT_CHARACTERS) return { ok: false, error: 'payload-too-large' }
  try {
    storage.setItem(STORAGE_KEY, serialized)
    return { ok: true }
  } catch {
    return { ok: false, error: 'write-failed' }
  }
}

export function loadDraft(
  storage: Pick<Storage, 'getItem'>,
  currentContentVersion: string,
  references?: StorageReferences,
): LoadDraftResult {
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { status: 'unavailable' }
  }
  if (raw === null) return { status: 'empty' }
  if (raw.length > MAX_DRAFT_CHARACTERS) return { status: 'corrupt', reason: 'invalid-payload' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupt', reason: 'invalid-json' }
  }
  if (isRecord(parsed) && typeof parsed.schemaVersion === 'number' && parsed.schemaVersion !== 1) {
    return { status: 'unsupported-version', schemaVersion: parsed.schemaVersion }
  }
  if (!isDraftPayload(parsed) || hasForbiddenMedia(parsed) || !isBounded(parsed)) {
    return { status: 'corrupt', reason: 'invalid-payload' }
  }

  const answers = references
    ? parsed.answers.filter((answer) => {
      const question = references.questionsById.get(answer.questionId)
      return question !== undefined
        && new Set(answer.optionIds).size === answer.optionIds.length
        && validateSelection(question, answer.optionIds, answer.skipped).valid
    })
    : parsed.answers
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
  return {
    status: 'ok',
    payload,
    contentChanged,
  }
}

export function clearDraft(storage: Pick<Storage, 'removeItem'>): boolean {
  try {
    storage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
