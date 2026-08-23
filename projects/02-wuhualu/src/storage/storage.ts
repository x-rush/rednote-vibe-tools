import type { CollectionEntry, QuizSession, RecentAttempt, StoragePayload } from '../content/types.ts'

export const STORAGE_KEY = 'xhs-tool:wuhualu:state:v1'
const MAX_RECENT_ATTEMPTS = 20
const MAX_RECENT_ARTIFACTS = 10

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type StorageRecoveryReason =
  | 'corrupt-json'
  | 'unsupported-schema'
  | 'invalid-payload'
  | 'sanitized-references'
  | 'content-version-changed'

export type StorageLoadResult = {
  payload: StoragePayload
  recovery: StorageRecoveryReason | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function createDefaultStoragePayload(contentVersion: string, now = new Date().toISOString()): StoragePayload {
  return {
    schemaVersion: 1,
    contentVersion,
    updatedAt: now,
    collection: [],
    bestScore: 0,
    recentAttempts: [],
    currentSession: null,
    recentArtifactIds: [],
    settings: { muted: false, reducedMotion: false },
  }
}

function isCollectionEntry(value: unknown, validIds: ReadonlySet<string>): value is CollectionEntry {
  if (!isRecord(value)) return false
  return typeof value.artifactId === 'string'
    && validIds.has(value.artifactId)
    && (value.bestStars === 1 || value.bestStars === 2 || value.bestStars === 3)
    && typeof value.unlockedAt === 'string'
}

function isRecentAttempt(value: unknown, validIds: ReadonlySet<string>): value is RecentAttempt {
  if (!isRecord(value)) return false
  return typeof value.artifactId === 'string'
    && validIds.has(value.artifactId)
    && typeof value.correct === 'boolean'
    && (value.stars === 1 || value.stars === 2 || value.stars === 3)
    && typeof value.answeredAt === 'string'
}

function isSession(value: unknown, validIds: ReadonlySet<string>): value is QuizSession {
  if (!isRecord(value)) return false
  return typeof value.seed === 'string'
    && Array.isArray(value.artifactIds)
    && value.artifactIds.every(id => typeof id === 'string' && validIds.has(id))
    && typeof value.index === 'number'
    && Array.isArray(value.answers)
    && Array.isArray(value.revealedClueIds)
    && typeof value.score === 'number'
    && typeof value.streak === 'number'
}

function normalizeStoragePayload(
  input: Record<string, unknown>,
  validIds: ReadonlySet<string>,
  contentVersion: string,
  now: string,
): StorageLoadResult {
  if (input.schemaVersion !== 1) {
    return { payload: createDefaultStoragePayload(contentVersion, now), recovery: 'unsupported-schema' }
  }
  if (!Array.isArray(input.collection) || !Array.isArray(input.recentAttempts) || !Array.isArray(input.recentArtifactIds)) {
    return { payload: createDefaultStoragePayload(contentVersion, now), recovery: 'invalid-payload' }
  }

  const collection = input.collection.filter(entry => isCollectionEntry(entry, validIds))
  const recentAttempts = input.recentAttempts.filter(entry => isRecentAttempt(entry, validIds)).slice(-MAX_RECENT_ATTEMPTS)
  const recentArtifactIds = [...new Set(input.recentArtifactIds.filter((id): id is string => typeof id === 'string' && validIds.has(id)))].slice(-MAX_RECENT_ARTIFACTS)
  const contentChanged = input.contentVersion !== contentVersion
  const currentSession = !contentChanged && (input.currentSession === null || isSession(input.currentSession, validIds))
    ? input.currentSession as QuizSession | null
    : null
  const settings = isRecord(input.settings)
    ? { muted: input.settings.muted === true, reducedMotion: input.settings.reducedMotion === true }
    : { muted: false, reducedMotion: false }
  const sanitized = collection.length !== input.collection.length
    || recentAttempts.length !== input.recentAttempts.length
    || recentArtifactIds.length !== input.recentArtifactIds.length
    || (!contentChanged && input.currentSession !== null && currentSession === null)

  return {
    payload: {
      schemaVersion: 1,
      contentVersion,
      updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : now,
      collection,
      bestScore: typeof input.bestScore === 'number' && Number.isFinite(input.bestScore) ? Math.max(0, input.bestScore) : 0,
      recentAttempts,
      currentSession,
      recentArtifactIds,
      settings,
    },
    recovery: contentChanged ? 'content-version-changed' : sanitized ? 'sanitized-references' : null,
  }
}

export function loadStorage(
  storage: StorageLike,
  validArtifactIds: ReadonlySet<string>,
  contentVersion: string,
  now = new Date().toISOString(),
): StorageLoadResult {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return { payload: createDefaultStoragePayload(contentVersion, now), recovery: null }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { payload: createDefaultStoragePayload(contentVersion, now), recovery: 'corrupt-json' }
  }
  if (!isRecord(parsed)) return { payload: createDefaultStoragePayload(contentVersion, now), recovery: 'invalid-payload' }
  return normalizeStoragePayload(parsed, validArtifactIds, contentVersion, now)
}

function assertPersistable(value: unknown, seen = new Set<object>()): void {
  if (typeof value === 'string' && /^(?:data:|blob:|https?:\/\/)/i.test(value)) throw new Error('禁止持久化媒体或二进制数据')
  if (typeof Blob !== 'undefined' && value instanceof Blob) throw new Error('禁止持久化媒体或二进制数据')
  if (typeof value !== 'object' || value === null) return
  if (seen.has(value)) throw new Error('存储数据不能包含循环引用')
  seen.add(value)
  for (const child of Object.values(value)) assertPersistable(child, seen)
  seen.delete(value)
}

export function saveStorage(storage: StorageLike, payload: StoragePayload): void {
  assertPersistable(payload)
  storage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearStorage(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEY)
}
