import type { Quest } from '../content/schema'
import { STORAGE_KEY, STORAGE_SCHEMA_VERSION } from './storage'

export function storageNeedsArchive(
  storage: Pick<Storage, 'getItem'>,
  activeById: ReadonlyMap<string, Quest>,
): boolean {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return false

  let envelope: unknown
  try { envelope = JSON.parse(raw) } catch { return false }
  if (!isRecord(envelope) || typeof envelope.schemaVersion !== 'number') return false
  if (envelope.schemaVersion === 1) return true
  if (envelope.schemaVersion !== STORAGE_SCHEMA_VERSION || !isRecord(envelope.data)) return false

  const activeQuest = envelope.data.activeQuest
  if (isRecord(activeQuest) && typeof activeQuest.questId === 'string') {
    const current = activeById.get(activeQuest.questId)
    if (!current || activeQuest.questContentVersion !== current.contentVersion) return true
  }

  const completedQuestIds = envelope.data.completedQuestIds
  return Array.isArray(completedQuestIds)
    && completedQuestIds.some((questId) => typeof questId === 'string' && !activeById.has(questId))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
