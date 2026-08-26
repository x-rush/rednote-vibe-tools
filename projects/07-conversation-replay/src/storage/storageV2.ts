import type { ReplayDraftV2 } from '../domain/replay'

export const STORAGE_KEY_V2 = 'xhs-tool:conversation-replay:state:v2'
const MAX_SAVED_RESULTS = 3

export type StoredReplayV2 = {
  id: string
  savedAt: string
  scenarioId: string
  draft: ReplayDraftV2
}

export type StoragePayloadV2 = {
  schemaVersion: 2
  contentVersion: string
  updatedAt: string
  data: {
    saveMode: 'ephemeral' | 'local'
    draft?: ReplayDraftV2
    savedResults: StoredReplayV2[]
  }
}

export type StorageReferenceIndexV2 = {
  scenarioIds: Set<string>
  feelingIds: Set<string>
  inferenceExpressionIds: Set<string>
  needIds: Set<string>
  factOptionIds: Set<string>
  requestOptionIds: Set<string>
  practiceOptionIds: Set<string>
  practiceReplyIds: Set<string>
}

export type RestoreResultV2 = {
  status: 'ok' | 'empty' | 'migrated' | 'corrupt' | 'future-version' | 'content-updated'
  payload: StoragePayloadV2
  message?: string
}

function containsForbiddenMedia(value: unknown, key = ''): boolean {
  if (/(image|screenshot|base64|blob|audio|video|chat-record|transcript)/i.test(key)) return true
  if (typeof value === 'string') return /^(data:|blob:)/i.test(value)
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true
  if (Array.isArray(value)) return value.some((item) => containsForbiddenMedia(item))
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).some(([childKey, child]) => containsForbiddenMedia(child, childKey))
  }
  return false
}

export function serializeStorageV2(payload: unknown) {
  if (containsForbiddenMedia(payload)) throw new Error('存储边界拒绝媒体、Base64 或 Blob 数据')
  return JSON.stringify(payload)
}

function cloneDraft(draft: ReplayDraftV2): ReplayDraftV2 {
  return {
    ...draft,
    factOptionIds: [...draft.factOptionIds],
    feelingIds: [...draft.feelingIds],
    inferenceExpressionIds: [...draft.inferenceExpressionIds],
    needIds: [...draft.needIds],
    limitedEdits: Object.fromEntries(
      Object.entries(draft.limitedEdits).map(([tone, text]) => [tone, text?.slice(0, 280)]),
    ),
  }
}

function hasDraftProgress(draft: ReplayDraftV2): boolean {
  return Boolean(
    draft.relationshipType
    || draft.communicationGoal
    || draft.scenarioId
    || draft.conflictLevel
    || draft.factOptionIds.length
    || draft.feelingIds.length
    || draft.feelingIntensity
    || draft.inferenceExpressionIds.length
    || draft.needIds.length
    || draft.requestOptionId
    || draft.selectedTone
    || draft.practiceOptionId
    || draft.practiceReplyId
    || Object.values(draft.limitedEdits).some((text) => text?.trim()),
  )
}

export function createStoragePayloadV2(options: {
  contentVersion: string
  now?: string
  saveMode?: 'ephemeral' | 'local'
  draft?: ReplayDraftV2
  savedResults?: StoredReplayV2[]
}): StoragePayloadV2 {
  return {
    schemaVersion: 2,
    contentVersion: options.contentVersion,
    updatedAt: options.now ?? new Date().toISOString(),
    data: {
      saveMode: options.saveMode ?? 'ephemeral',
      draft: options.draft && hasDraftProgress(options.draft) ? cloneDraft(options.draft) : undefined,
      savedResults: [...(options.savedResults ?? [])]
        .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
        .slice(0, MAX_SAVED_RESULTS)
        .map((item) => ({ ...item, draft: cloneDraft(item.draft) })),
    },
  }
}

function emptyPayload(contentVersion: string): StoragePayloadV2 {
  return createStoragePayloadV2({ contentVersion })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validId(value: unknown, references: Set<string>): value is string {
  return typeof value === 'string' && references.has(value)
}

function validIdArray(value: unknown, references: Set<string>) {
  return Array.isArray(value) && value.every((id) => validId(id, references))
}

function normalizeDraft(value: unknown, references: StorageReferenceIndexV2): ReplayDraftV2 | undefined {
  if (!isObject(value)) return undefined
  if (value.scenarioId !== undefined && !validId(value.scenarioId, references.scenarioIds)) return undefined
  if (!validIdArray(value.factOptionIds, references.factOptionIds)) return undefined
  if (!validIdArray(value.feelingIds, references.feelingIds)) return undefined
  if (!validIdArray(value.inferenceExpressionIds, references.inferenceExpressionIds)) return undefined
  if (!validIdArray(value.needIds, references.needIds)) return undefined
  if (value.requestOptionId !== undefined && !validId(value.requestOptionId, references.requestOptionIds)) return undefined
  if (value.practiceOptionId !== undefined && !validId(value.practiceOptionId, references.practiceOptionIds)) return undefined
  if (value.practiceReplyId !== undefined && !validId(value.practiceReplyId, references.practiceReplyIds)) return undefined
  if (!isObject(value.limitedEdits)) return undefined
  const edits = Object.fromEntries(
    Object.entries(value.limitedEdits)
      .filter(([tone, text]) => ['gentle', 'direct', 'firm'].includes(tone) && typeof text === 'string')
      .map(([tone, text]) => [tone, (text as string).slice(0, 280)]),
  )
  return cloneDraft({
    scenarioId: typeof value.scenarioId === 'string' ? value.scenarioId : undefined,
    relationshipType: ['friend', 'partner', 'family', 'coworker', 'general'].includes(String(value.relationshipType)) ? value.relationshipType as ReplayDraftV2['relationshipType'] : undefined,
    communicationGoal: ['clarify', 'repair', 'coordinate', 'set-boundary', 'prepare-next-time'].includes(String(value.communicationGoal)) ? value.communicationGoal as ReplayDraftV2['communicationGoal'] : undefined,
    conflictLevel: ['low', 'medium', 'high', 'safety'].includes(String(value.conflictLevel)) ? value.conflictLevel as ReplayDraftV2['conflictLevel'] : undefined,
    factOptionIds: value.factOptionIds as string[],
    feelingIds: value.feelingIds as string[],
    feelingIntensity: ['light', 'clear', 'strong'].includes(String(value.feelingIntensity)) ? value.feelingIntensity as ReplayDraftV2['feelingIntensity'] : undefined,
    inferenceExpressionIds: value.inferenceExpressionIds as string[],
    needIds: value.needIds as string[],
    requestOptionId: typeof value.requestOptionId === 'string' ? value.requestOptionId : undefined,
    selectedTone: ['gentle', 'direct', 'firm'].includes(String(value.selectedTone)) ? value.selectedTone as ReplayDraftV2['selectedTone'] : undefined,
    practiceOptionId: typeof value.practiceOptionId === 'string' ? value.practiceOptionId : undefined,
    practiceReplyId: typeof value.practiceReplyId === 'string' ? value.practiceReplyId : undefined,
    limitedEdits: edits,
  })
}

function migrateV1Draft(value: unknown, references: StorageReferenceIndexV2): ReplayDraftV2 | undefined {
  if (!isObject(value)) return undefined
  if (value.scenarioId !== undefined && !validId(value.scenarioId, references.scenarioIds)) return undefined
  const feelingIds = validId(value.emotionId, references.feelingIds) ? [value.emotionId] : []
  const inferenceExpressionIds = validId(value.originalExpressionId, references.inferenceExpressionIds) ? [value.originalExpressionId] : []
  return {
    scenarioId: typeof value.scenarioId === 'string' ? value.scenarioId : undefined,
    relationshipType: ['friend', 'partner', 'family', 'coworker', 'general'].includes(String(value.relationshipType)) ? value.relationshipType as ReplayDraftV2['relationshipType'] : undefined,
    communicationGoal: ['clarify', 'repair', 'coordinate', 'set-boundary', 'prepare-next-time'].includes(String(value.communicationGoal)) ? value.communicationGoal as ReplayDraftV2['communicationGoal'] : undefined,
    conflictLevel: ['low', 'medium', 'high', 'safety'].includes(String(value.conflictLevel)) ? value.conflictLevel as ReplayDraftV2['conflictLevel'] : undefined,
    factOptionIds: [],
    feelingIds,
    inferenceExpressionIds,
    needIds: [],
    limitedEdits: {},
  }
}

function validStored(value: unknown, references: StorageReferenceIndexV2): StoredReplayV2 | undefined {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))) return undefined
  if (!validId(value.scenarioId, references.scenarioIds)) return undefined
  const draft = normalizeDraft(value.draft, references)
  return draft ? { id: value.id, savedAt: value.savedAt, scenarioId: value.scenarioId as string, draft } : undefined
}

export function restoreStorageV2(
  raw: string | null,
  references: StorageReferenceIndexV2,
  currentContentVersion: string,
): RestoreResultV2 {
  if (raw === null) return { status: 'empty', payload: emptyPayload(currentContentVersion) }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据无法解析，原数据未被覆盖。' }
  }
  if (containsForbiddenMedia(parsed) || !isObject(parsed) || typeof parsed.schemaVersion !== 'number') {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据结构不安全，原数据未被覆盖。' }
  }
  if (parsed.schemaVersion > 2) {
    return { status: 'future-version', payload: emptyPayload(currentContentVersion), message: '数据来自更新版本，原数据未被覆盖。' }
  }
  if (!isObject(parsed.data)) {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据结构不完整，原数据未被覆盖。' }
  }
  if (parsed.schemaVersion === 1) {
    const draft = migrateV1Draft(parsed.data.draft, references)
    return {
      status: 'migrated',
      payload: createStoragePayloadV2({
        contentVersion: currentContentVersion,
        now: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
        saveMode: parsed.data.saveMode === 'local' ? 'local' : 'ephemeral',
        draft,
      }),
      message: '已恢复旧版可映射选择；五步新增内容需要继续补充。',
    }
  }
  if (parsed.schemaVersion !== 2) {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据版本不受支持，原数据未被覆盖。' }
  }
  const sourceSaved = Array.isArray(parsed.data.savedResults) ? parsed.data.savedResults : []
  const savedResults = sourceSaved
    .map((item) => validStored(item, references))
    .filter((item): item is StoredReplayV2 => item !== undefined)
  const normalizedDraft = parsed.data.draft === undefined ? undefined : normalizeDraft(parsed.data.draft, references)
  const draft = normalizedDraft && hasDraftProgress(normalizedDraft) ? normalizedDraft : undefined
  const changed = parsed.contentVersion !== currentContentVersion
    || savedResults.length !== sourceSaved.length
    || (parsed.data.draft !== undefined && normalizedDraft === undefined)
  return {
    status: changed ? 'content-updated' : 'ok',
    payload: createStoragePayloadV2({
      contentVersion: currentContentVersion,
      now: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
      saveMode: parsed.data.saveMode === 'local' ? 'local' : 'ephemeral',
      draft,
      savedResults,
    }),
    message: changed ? '内容已更新，失效引用已安全移除。' : undefined,
  }
}

export function saveLocalStateV2(storage: Pick<Storage, 'setItem'>, payload: StoragePayloadV2) {
  storage.setItem(STORAGE_KEY_V2, serializeStorageV2(payload))
}

export function loadLocalStateV2(storage: Pick<Storage, 'getItem'>, references: StorageReferenceIndexV2, contentVersion: string) {
  return restoreStorageV2(storage.getItem(STORAGE_KEY_V2), references, contentVersion)
}

export function clearLocalStateV2(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(STORAGE_KEY_V2)
}
