import type { StoragePayload } from '../content/schema'
import type { GuildDomainState } from '../domain/quests'
import { saveState, type StorageEnvelope } from '../storage/storage'

export type PersistDecision =
  | { kind: 'persisted' }
  | { kind: 'temporary-required'; reason: 'forbidden-data' | 'quota-or-unavailable' }

export function createStorageEnvelope(guild: GuildDomainState, contentVersion: string, updatedAt: string): StorageEnvelope {
  return { schemaVersion: 2, contentVersion, updatedAt, data: toStoragePayload(guild) }
}

export function persistBeforeTransition(storage: Pick<Storage, 'setItem'>, envelope: StorageEnvelope): PersistDecision {
  const result = saveState(storage, envelope)
  return result.ok ? { kind: 'persisted' } : { kind: 'temporary-required', reason: result.reason }
}

export function toStoragePayload(guild: GuildDomainState): StoragePayload {
  return {
    preference: guild.preference,
    offeredQuestId: guild.offeredQuestId,
    activeQuest: guild.activeQuest,
    recentQuestIds: guild.recentQuestIds,
    completedQuestIds: guild.completedQuestIds,
    history: guild.history,
    xp: guild.xp,
    streak: guild.streak,
    unlockedBadgeIds: guild.unlockedBadgeIds,
    rngState: guild.rngState,
    settings: guild.settings,
  }
}
