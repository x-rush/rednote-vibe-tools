import { snapshotQuest, type QuestCatalog } from '../content/catalog'
import { DIFFICULTIES, QUEST_CATEGORIES } from '../content/schema'
import type { GuildSettings, QuestHistoryEntry, StoragePayload } from '../content/schema'

export const STORAGE_KEY = 'xhs-tool:earth-online:state:v1'
export const STORAGE_SCHEMA_VERSION = 2 as const
export type StorageEnvelope = { schemaVersion: 2; contentVersion: string; updatedAt: string; data: StoragePayload }
export type StorageLoadResult = { status: 'empty' } | { status: 'ok'; envelope: StorageEnvelope } | { status: 'corrupt'; reason: string } | { status: 'future-version'; foundVersion: number }
export type StorageSaveResult = { ok: true } | { ok: false; reason: 'forbidden-data' | 'quota-or-unavailable' }
type StorageQuestCatalog = Pick<QuestCatalog, 'activeById' | 'allById' | 'resolve'>
type LegacyHistoryEntry = { acceptanceId: string; questId: string; status: QuestHistoryEntry['status']; occurredAt: string; xpAwarded: number; completionDate?: string }

const forbiddenKeys = new Set(['image', 'images', 'base64', 'blob', 'audio', 'video', 'latitude', 'longitude', 'locationdata', 'proof', 'completionproof'])

export function loadState(storage: Pick<Storage, 'getItem'>, catalog: StorageQuestCatalog): StorageLoadResult {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return { status: 'empty' }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { status: 'corrupt', reason: 'invalid-json' } }
  if (!isRecord(parsed) || typeof parsed.schemaVersion !== 'number') return { status: 'corrupt', reason: 'invalid-envelope' }
  if (parsed.schemaVersion > STORAGE_SCHEMA_VERSION) return { status: 'future-version', foundVersion: parsed.schemaVersion }
  if (![1, STORAGE_SCHEMA_VERSION].includes(parsed.schemaVersion) || typeof parsed.contentVersion !== 'string' || typeof parsed.updatedAt !== 'string' || !isRecord(parsed.data)) return { status: 'corrupt', reason: 'invalid-envelope' }
  if (hasForbiddenData(parsed.data)) return { status: 'corrupt', reason: 'forbidden-data' }
  const sanitized = sanitizePayload(parsed.data, catalog, parsed.schemaVersion, parsed.contentVersion)
  if (!sanitized) return { status: 'corrupt', reason: 'invalid-state' }
  return { status: 'ok', envelope: { schemaVersion: STORAGE_SCHEMA_VERSION, contentVersion: parsed.contentVersion, updatedAt: parsed.updatedAt, data: sanitized } }
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

function sanitizePayload(data: Record<string, unknown>, catalog: StorageQuestCatalog, schemaVersion: number, envelopeContentVersion: string): StoragePayload | undefined {
  if (!isRecord(data.preference) || !Array.isArray(data.recentQuestIds) || !Array.isArray(data.completedQuestIds) || !Array.isArray(data.history) || typeof data.xp !== 'number' || !isRecord(data.streak) || !Array.isArray(data.unlockedBadgeIds) || typeof data.rngState !== 'number') return undefined
  const preference = data.preference as StoragePayload['preference']
  if (![5, 10, 15, 20].includes(preference.minutes) || ![1, 2, 3].includes(preference.energy) || !['indoor', 'outdoor'].includes(preference.environment)) return undefined
  const activeQuest = sanitizeActiveQuest(data.activeQuest, catalog, schemaVersion, envelopeContentVersion)
  if (data.activeQuest !== undefined && !activeQuest) return undefined
  const history = schemaVersion === 1
    ? data.history.filter(isLegacyHistoryEntry).flatMap((entry) => migrateHistoryEntry(entry, catalog, envelopeContentVersion)).slice(-100)
    : data.history.filter(isHistoryEntry).slice(-100)
  return {
    preference,
    offeredQuestId: typeof data.offeredQuestId === 'string' && catalog.activeById.has(data.offeredQuestId) ? data.offeredQuestId : undefined,
    activeQuest,
    recentQuestIds: data.recentQuestIds.filter((id): id is string => typeof id === 'string' && catalog.activeById.has(id)).slice(-10),
    completedQuestIds: [...new Set(data.completedQuestIds.filter((id): id is string => typeof id === 'string' && catalog.allById.has(id)))],
    history,
    xp: Math.max(0, Math.floor(data.xp)),
    streak: { current: nonNegative(data.streak.current), best: nonNegative(data.streak.best), lastCompletionDate: typeof data.streak.lastCompletionDate === 'string' ? data.streak.lastCompletionDate : undefined },
    unlockedBadgeIds: data.unlockedBadgeIds.filter((id): id is string => typeof id === 'string').slice(0, 100),
    rngState: Math.max(0, Math.floor(data.rngState)) >>> 0,
    settings: sanitizeSettings(data.settings),
  }
}

function sanitizeSettings(value: unknown): GuildSettings {
  if (!isRecord(value)) return { hasSeenGuide: false, softAvoidCategoryIds: [] }
  return {
    hasSeenGuide: value.hasSeenGuide === true,
    softAvoidCategoryIds: Array.isArray(value.softAvoidCategoryIds)
      ? [...new Set(value.softAvoidCategoryIds.filter((id): id is GuildSettings['softAvoidCategoryIds'][number] => QUEST_CATEGORIES.includes(id as GuildSettings['softAvoidCategoryIds'][number])))].slice(0, QUEST_CATEGORIES.length)
      : [],
  }
}

function sanitizeActiveQuest(value: unknown, catalog: StorageQuestCatalog, schemaVersion: number, envelopeContentVersion: string): StoragePayload['activeQuest'] {
  if (value === undefined) return undefined
  if (!isRecord(value) || typeof value.acceptanceId !== 'string' || typeof value.questId !== 'string' || typeof value.acceptedAt !== 'string' || !isRecord(value.preference)) return undefined
  const requestedVersion = schemaVersion === 1 ? envelopeContentVersion : value.questContentVersion
  if (typeof requestedVersion !== 'string' || requestedVersion.length === 0) return undefined
  const quest = catalog.resolve(value.questId, requestedVersion)
  if (!quest) return undefined
  return { acceptanceId: value.acceptanceId, questId: value.questId, acceptedAt: value.acceptedAt, questContentVersion: quest.contentVersion, preference: value.preference as StoragePayload['preference'] }
}

function migrateHistoryEntry(value: LegacyHistoryEntry, catalog: StorageQuestCatalog, envelopeContentVersion: string): QuestHistoryEntry[] {
  const quest = catalog.resolve(value.questId, envelopeContentVersion)
  return quest ? [{ acceptanceId: value.acceptanceId, questId: value.questId, status: value.status, occurredAt: value.occurredAt, completionDate: value.completionDate, xpAwarded: Math.max(0, Math.floor(value.xpAwarded)), ...snapshotQuest(quest) }] : []
}

function isLegacyHistoryEntry(value: unknown): value is LegacyHistoryEntry { return isRecord(value) && typeof value.acceptanceId === 'string' && typeof value.questId === 'string' && ['completed', 'abandoned', 'swapped'].includes(String(value.status)) && typeof value.occurredAt === 'string' && typeof value.xpAwarded === 'number' }
function isHistoryEntry(value: unknown): value is QuestHistoryEntry { return isRecord(value) && typeof value.acceptanceId === 'string' && typeof value.questId === 'string' && ['completed', 'abandoned', 'swapped'].includes(String(value.status)) && typeof value.occurredAt === 'string' && typeof value.xpAwarded === 'number' && typeof value.questTitle === 'string' && typeof value.questContentVersion === 'string' && QUEST_CATEGORIES.includes(value.questCategory as QuestHistoryEntry['questCategory']) && DIFFICULTIES.includes(value.questDifficulty as QuestHistoryEntry['questDifficulty']) }
function hasForbiddenData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenData)
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, child]) => forbiddenKeys.has(key.toLowerCase()) || hasForbiddenData(child))
}
function nonNegative(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0 }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
