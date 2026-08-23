import type { QuestHistoryEntry, StoragePayload } from '../content/schema'

export const STORAGE_KEY = 'xhs-tool:earth-online:state:v1'
export const STORAGE_SCHEMA_VERSION = 1 as const
export type StorageEnvelope = { schemaVersion: 1; contentVersion: string; updatedAt: string; data: StoragePayload }
export type StorageLoadResult = { status: 'empty' } | { status: 'ok'; envelope: StorageEnvelope } | { status: 'corrupt'; reason: string } | { status: 'future-version'; foundVersion: number }
export type StorageSaveResult = { ok: true } | { ok: false; reason: 'forbidden-data' | 'quota-or-unavailable' }

const forbiddenKeys = new Set(['image', 'images', 'base64', 'blob', 'audio', 'video', 'latitude', 'longitude', 'locationdata', 'proof', 'completionproof'])

export function loadState(storage: Pick<Storage, 'getItem'>, validQuestIds: ReadonlySet<string>): StorageLoadResult {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return { status: 'empty' }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { status: 'corrupt', reason: 'invalid-json' } }
  if (!isRecord(parsed) || typeof parsed.schemaVersion !== 'number') return { status: 'corrupt', reason: 'invalid-envelope' }
  if (parsed.schemaVersion > STORAGE_SCHEMA_VERSION) return { status: 'future-version', foundVersion: parsed.schemaVersion }
  if (parsed.schemaVersion !== STORAGE_SCHEMA_VERSION || typeof parsed.contentVersion !== 'string' || typeof parsed.updatedAt !== 'string' || !isRecord(parsed.data)) return { status: 'corrupt', reason: 'invalid-envelope' }
  if (hasForbiddenData(parsed.data)) return { status: 'corrupt', reason: 'forbidden-data' }
  const sanitized = sanitizePayload(parsed.data, validQuestIds)
  if (!sanitized) return { status: 'corrupt', reason: 'invalid-state' }
  return { status: 'ok', envelope: { schemaVersion: 1, contentVersion: parsed.contentVersion, updatedAt: parsed.updatedAt, data: sanitized } }
}

export function saveState(storage: Pick<Storage, 'setItem'>, envelope: StorageEnvelope): StorageSaveResult {
  if (hasForbiddenData(envelope)) return { ok: false, reason: 'forbidden-data' }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope))
    return { ok: true }
  } catch {
    return { ok: false, reason: 'quota-or-unavailable' }
  }
}

export function clearState(storage: Pick<Storage, 'removeItem'>): void { storage.removeItem(STORAGE_KEY) }

function sanitizePayload(data: Record<string, unknown>, validQuestIds: ReadonlySet<string>): StoragePayload | undefined {
  if (!isRecord(data.preference) || !Array.isArray(data.recentQuestIds) || !Array.isArray(data.completedQuestIds) || !Array.isArray(data.history) || typeof data.xp !== 'number' || !isRecord(data.streak) || !Array.isArray(data.unlockedBadgeIds) || typeof data.rngState !== 'number') return undefined
  const preference = data.preference as StoragePayload['preference']
  if (![5, 10, 15, 20].includes(preference.minutes) || ![1, 2, 3].includes(preference.energy) || !['indoor', 'outdoor'].includes(preference.environment)) return undefined
  const activeQuest = sanitizeActiveQuest(data.activeQuest, validQuestIds)
  if (data.activeQuest !== undefined && !activeQuest) return undefined
  const history = data.history.filter(isHistoryEntry).filter((entry) => validQuestIds.has(entry.questId)).slice(-100)
  return {
    preference,
    offeredQuestId: typeof data.offeredQuestId === 'string' && validQuestIds.has(data.offeredQuestId) ? data.offeredQuestId : undefined,
    activeQuest,
    recentQuestIds: data.recentQuestIds.filter((id): id is string => typeof id === 'string' && validQuestIds.has(id)).slice(-10),
    completedQuestIds: [...new Set(data.completedQuestIds.filter((id): id is string => typeof id === 'string' && validQuestIds.has(id)))],
    history,
    xp: Math.max(0, Math.floor(data.xp)),
    streak: { current: nonNegative(data.streak.current), best: nonNegative(data.streak.best), lastCompletionDate: typeof data.streak.lastCompletionDate === 'string' ? data.streak.lastCompletionDate : undefined },
    unlockedBadgeIds: data.unlockedBadgeIds.filter((id): id is string => typeof id === 'string').slice(0, 100),
    rngState: Math.max(0, Math.floor(data.rngState)) >>> 0,
  }
}

function sanitizeActiveQuest(value: unknown, validQuestIds: ReadonlySet<string>): StoragePayload['activeQuest'] {
  if (value === undefined) return undefined
  if (!isRecord(value) || typeof value.acceptanceId !== 'string' || typeof value.questId !== 'string' || !validQuestIds.has(value.questId) || typeof value.acceptedAt !== 'string' || !isRecord(value.preference)) return undefined
  return value as StoragePayload['activeQuest']
}
function isHistoryEntry(value: unknown): value is QuestHistoryEntry { return isRecord(value) && typeof value.acceptanceId === 'string' && typeof value.questId === 'string' && ['completed', 'abandoned', 'swapped'].includes(String(value.status)) && typeof value.occurredAt === 'string' && typeof value.xpAwarded === 'number' }
function hasForbiddenData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenData)
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, child]) => forbiddenKeys.has(key.toLowerCase()) || hasForbiddenData(child))
}
function nonNegative(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0 }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
