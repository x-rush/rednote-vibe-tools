import type { ReplayAnswers, StoragePayload, StoredReplay } from '../domain/types'

export const STORAGE_KEY = 'xhs-tool:conversation-replay:state:v1'
const DATABASE_NAME = 'xhs_say_it_again'
const STORE_NAME = 'debriefs'
const MAX_SAVED_RESULTS = 3

export type StorageReferenceIndex = {
  scenarioIds: Set<string>
  emotionIds: Set<string>
  originalExpressionIds: Set<string>
  responseIds: Set<string>
}

export type RestoreStatus = 'ok' | 'empty' | 'corrupt' | 'future-version' | 'content-updated'
export type RestoreResult = { status: RestoreStatus; payload: StoragePayload; message?: string }

type CreatePayloadOptions = {
  contentVersion: string
  now?: string
  saveMode?: 'ephemeral' | 'local'
  draft?: Partial<ReplayAnswers>
  recentResult?: StoredReplay
  savedResults?: StoredReplay[]
}

function emptyPayload(contentVersion: string, now = new Date().toISOString()): StoragePayload {
  return {
    schemaVersion: 1,
    contentVersion,
    updatedAt: now,
    data: { saveMode: 'ephemeral', savedResults: [] },
  }
}

export function mergeSavedReplay(existing: StoredReplay[], next: StoredReplay): StoredReplay[] {
  return [next, ...existing.filter(({ id }) => id !== next.id)]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, MAX_SAVED_RESULTS)
}

export function createStoragePayload(options: CreatePayloadOptions): StoragePayload {
  return {
    schemaVersion: 1,
    contentVersion: options.contentVersion,
    updatedAt: options.now ?? new Date().toISOString(),
    data: {
      saveMode: options.saveMode ?? 'ephemeral',
      draft: options.draft ? { ...options.draft } : undefined,
      recentResult: options.recentResult ? structuredClone(options.recentResult) : undefined,
      savedResults: [...(options.savedResults ?? [])]
        .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
        .slice(0, MAX_SAVED_RESULTS)
        .map((item) => structuredClone(item)),
    },
  }
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

export function serializeStorage(payload: unknown): string {
  if (containsForbiddenMedia(payload)) throw new Error('存储边界拒绝媒体、Base64 或 Blob 数据')
  return JSON.stringify(payload)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const answerKeys = new Set(['relationshipType', 'communicationGoal', 'conflictLevel', 'emotionId', 'originalExpressionId', 'responseId', 'intention', 'scenarioId'])
const relationships = new Set(['friend', 'partner', 'family', 'coworker', 'general'])
const goals = new Set(['clarify', 'repair', 'coordinate', 'set-boundary', 'prepare-next-time'])
const conflicts = new Set(['low', 'medium', 'high', 'safety'])
const responses = new Set(['response-explained', 'response-defended', 'response-apologized', 'response-withdrew', 'response-refused', 'response-discussed'])
const intentions = new Set(['repair-now', 'prepare-next-time'])

function referenceIndex(input: Set<string> | StorageReferenceIndex): StorageReferenceIndex {
  return input instanceof Set
    ? { scenarioIds: input, emotionIds: new Set(), originalExpressionIds: new Set(), responseIds: new Set() }
    : input
}

function validReference(id: unknown, references: Set<string>) {
  return typeof id === 'string' && (references.size === 0 || references.has(id))
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every((key) => allowed.has(key))
}

function isAnswers(value: unknown, references: StorageReferenceIndex): value is ReplayAnswers {
  if (!isObject(value)) return false
  return hasOnlyKeys(value, answerKeys)
    && relationships.has(String(value.relationshipType))
    && goals.has(String(value.communicationGoal))
    && conflicts.has(String(value.conflictLevel))
    && validReference(value.emotionId, references.emotionIds)
    && validReference(value.originalExpressionId, references.originalExpressionIds)
    && responses.has(String(value.responseId))
    && validReference(value.responseId, references.responseIds)
    && intentions.has(String(value.intention))
    && (value.scenarioId === undefined || validReference(value.scenarioId, references.scenarioIds))
}

function isDraft(value: unknown, references: StorageReferenceIndex): value is Partial<ReplayAnswers> {
  if (!isObject(value)) return false
  if (!hasOnlyKeys(value, answerKeys)) return false
  const checks: Partial<Record<keyof ReplayAnswers, (item: unknown) => boolean>> = {
    relationshipType: (item) => relationships.has(String(item)),
    communicationGoal: (item) => goals.has(String(item)),
    conflictLevel: (item) => conflicts.has(String(item)),
    emotionId: (item) => validReference(item, references.emotionIds),
    originalExpressionId: (item) => validReference(item, references.originalExpressionIds),
    responseId: (item) => responses.has(String(item)) && validReference(item, references.responseIds),
    intention: (item) => intentions.has(String(item)),
    scenarioId: (item) => validReference(item, references.scenarioIds),
  }
  return Object.entries(value).every(([key, item]) => checks[key as keyof ReplayAnswers]?.(item) === true)
}

function isStoredReplay(value: unknown, references: StorageReferenceIndex): value is StoredReplay {
  return isObject(value)
    && hasOnlyKeys(value, new Set(['id', 'savedAt', 'answers', 'scenarioId']))
    && typeof value.id === 'string'
    && typeof value.savedAt === 'string'
    && !Number.isNaN(Date.parse(value.savedAt))
    && validReference(value.scenarioId, references.scenarioIds)
    && isAnswers(value.answers, references)
}

export function restoreStorage(
  raw: string | null,
  validReferences: Set<string> | StorageReferenceIndex,
  currentContentVersion: string,
): RestoreResult {
  if (raw === null) return { status: 'empty', payload: emptyPayload(currentContentVersion) }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据无法解析，已使用安全默认值。' }
  }
  if (containsForbiddenMedia(parsed)) {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据包含不允许的媒体字段，已使用安全默认值。' }
  }
  if (!isObject(parsed) || typeof parsed.schemaVersion !== 'number') {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据结构不完整。' }
  }
  if (parsed.schemaVersion > 1) {
    return { status: 'future-version', payload: emptyPayload(currentContentVersion), message: '数据来自更新版本，原数据未被覆盖。' }
  }
  if (parsed.schemaVersion !== 1 || !isObject(parsed.data)) {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据版本不受支持。' }
  }
  if (!hasOnlyKeys(parsed, new Set(['schemaVersion', 'contentVersion', 'updatedAt', 'data']))
    || !hasOnlyKeys(parsed.data, new Set(['saveMode', 'draft', 'recentResult', 'savedResults']))) {
    return { status: 'corrupt', payload: emptyPayload(currentContentVersion), message: '本地数据含有未知字段，已使用安全默认值。' }
  }

  const data = parsed.data
  const references = referenceIndex(validReferences)
  const sourceSaved = Array.isArray(data.savedResults) ? data.savedResults : []
  const savedResults = sourceSaved
    .filter((item): item is StoredReplay => isStoredReplay(item, references))
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, MAX_SAVED_RESULTS)
  const draft = isDraft(data.draft, references)
    ? data.draft
    : undefined
  const recentResult = isStoredReplay(data.recentResult, references)
    ? data.recentResult
    : undefined
  const contentChanged = parsed.contentVersion !== currentContentVersion
    || savedResults.length !== sourceSaved.length
    || (data.draft !== undefined && draft === undefined)
    || (data.recentResult !== undefined && recentResult === undefined)
    || !['ephemeral', 'local'].includes(String(data.saveMode))
  const payload = createStoragePayload({
    contentVersion: currentContentVersion,
    now: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    saveMode: data.saveMode === 'local' ? 'local' : 'ephemeral',
    draft,
    recentResult,
    savedResults,
  })
  return {
    status: contentChanged ? 'content-updated' : 'ok',
    payload,
    message: contentChanged ? '内容已更新，失效引用已安全移除。' : undefined,
  }
}

export function saveLocalState(storage: Pick<Storage, 'setItem'>, payload: StoragePayload) {
  storage.setItem(STORAGE_KEY, serializeStorage(payload))
}

export function loadLocalState(
  storage: Pick<Storage, 'getItem'>,
  validReferences: Set<string> | StorageReferenceIndex,
  contentVersion: string,
) {
  return restoreStorage(storage.getItem(STORAGE_KEY), validReferences, contentVersion)
}

export function clearLocalState(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(STORAGE_KEY)
}

export type SavedReplayRepository = {
  list(): Promise<StoredReplay[]>
  save(replay: StoredReplay): Promise<StoredReplay[]>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务已取消'))
  })
}

export async function createIndexedDbSavedReplayRepository(
  factory: IDBFactory,
  validReferences?: StorageReferenceIndex,
): Promise<SavedReplayRepository> {
  const openRequest = factory.open(DATABASE_NAME, 1)
  openRequest.onupgradeneeded = () => {
    const database = openRequest.result
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' })
  }
  const database = await requestResult(openRequest)
  const references = validReferences ?? { scenarioIds: new Set(), emotionIds: new Set(), originalExpressionIds: new Set(), responseIds: new Set() }
  const list = async () => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll()) as unknown[]
    await transactionDone(transaction)
    return records
      .filter((item): item is StoredReplay => !containsForbiddenMedia(item) && isStoredReplay(item, references))
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .slice(0, MAX_SAVED_RESULTS)
  }
  return {
    list,
    async save(replay) {
      if (containsForbiddenMedia(replay)) throw new Error('保存内容不能包含媒体数据')
      if (!isStoredReplay(replay, references)) throw new Error('保存内容引用了无效的结构化选项')
      const existing = await list()
      const next = mergeSavedReplay(existing, replay)
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      store.clear()
      next.forEach((item) => store.put(item))
      await transactionDone(transaction)
      return next
    },
    async remove(id) {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(id)
      await transactionDone(transaction)
    },
    async clear() {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).clear()
      await transactionDone(transaction)
    },
  }
}
