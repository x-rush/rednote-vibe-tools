import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { EarthOnlineContent, Quest } from '../content/schema'
import { createQuestCatalog } from '../content/catalog'
import type { StoragePayload } from '../content/schema'
import { STORAGE_KEY, loadState, saveState } from './storage'
import { completeQuest, createGuildState } from '../domain/quests'

const content = rawContent as unknown as EarthOnlineContent
const active = content.content.tasks[0]
const retired: Quest = { ...content.content.tasks[1], questId: 'quest-retired-storage-fixture', title: '旧版存储任务', contentVersion: '1.0.0' }
const catalog = {
  activeById: new Map([[active.questId, active]]),
  allById: new Map([[active.questId, active], [retired.questId, retired]]),
  resolve: (questId: string, contentVersion?: string) => [active, retired].find((quest) => quest.questId === questId && (!contentVersion || quest.contentVersion === contentVersion)),
}
const emptyCatalog = { activeById: new Map<string, Quest>(), allById: new Map<string, Quest>(), resolve: () => undefined }
type LegacyPayload = Omit<StoragePayload, 'activeQuest' | 'history'> & {
  activeQuest?: Omit<NonNullable<StoragePayload['activeQuest']>, 'questContentVersion'>
  history: Array<{ acceptanceId: string; questId: string; status: 'completed' | 'abandoned' | 'swapped'; occurredAt: string; xpAwarded: number; completionDate?: string; category?: string }>
}

describe('versioned local storage', () => {
  it('migrates a retained v1 active quest to its old definition and XP', () => {
    const versioned = content as EarthOnlineContent & { content: { legacyTasks: Quest[] } }
    const oldQuest = versioned.content.legacyTasks?.find(({ questId, xp }) => content.content.tasks.some((quest) => quest.questId === questId && quest.xp !== xp))
    expect(oldQuest).toBeDefined()
    if (!oldQuest) return
    const legacy = legacyPayload()
    legacy.activeQuest = { acceptanceId: 'retained-v1-active', questId: oldQuest.questId, acceptedAt: '2026-08-28T08:00:00.000Z', preference: legacy.preference }
    const loaded = loadState(memoryStorage(JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-28T09:00:00.000Z', data: legacy })), createQuestCatalog(content))

    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.envelope.data.activeQuest).toMatchObject({ questId: oldQuest.questId, questContentVersion: '1.0.0' })
    const resolved = createQuestCatalog(content).resolve(oldQuest.questId, '1.0.0')
    expect(resolved?.xp).toBe(oldQuest.xp)
    if (!resolved) return
    const guild = { ...createGuildState(legacy.preference, loaded.envelope.data.rngState), ...loaded.envelope.data, categoryCompletionCounts: {} }
    const completed = completeQuest(guild, resolved, content.content.badges, '2026-08-28T09:00:00.000Z', '2026-08-28')
    expect(completed.awardedXp).toBe(oldQuest.xp)
    expect(completed.state.history.at(-1)).toMatchObject({ questTitle: oldQuest.title, questContentVersion: '1.0.0', xpAwarded: oldQuest.xp })
  })

  it('migrates v1 history snapshots and keeps a retired active quest playable', () => {
    const legacy = legacyPayload()
    legacy.activeQuest = { acceptanceId: 'legacy-active', questId: retired.questId, acceptedAt: '2026-08-28T08:00:00.000Z', preference: legacy.preference }
    legacy.history = [{ acceptanceId: 'legacy-history', questId: retired.questId, status: 'completed', occurredAt: '2026-08-27T08:00:00.000Z', completionDate: '2026-08-27', xpAwarded: retired.xp, category: retired.category }]
    const loaded = loadState(memoryStorage(JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-28T09:00:00.000Z', data: legacy })), catalog)

    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.envelope.schemaVersion).toBe(2)
    expect(loaded.envelope.data.activeQuest).toMatchObject({ questId: retired.questId, questContentVersion: retired.contentVersion })
    expect(loaded.envelope.data.history[0]).toMatchObject({ questTitle: retired.title, questContentVersion: retired.contentVersion, questCategory: retired.category, questDifficulty: retired.difficulty, xpAwarded: retired.xp })
  })

  it('rejects an unknown v1 active quest but drops unknown noncritical history', () => {
    const unknownActive = legacyPayload()
    unknownActive.activeQuest = { acceptanceId: 'missing', questId: 'quest-missing', acceptedAt: '2026-08-28T08:00:00.000Z', preference: unknownActive.preference }
    expect(loadState(memoryStorage(JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-28T09:00:00.000Z', data: unknownActive })), catalog)).toMatchObject({ status: 'corrupt', reason: 'invalid-state' })

    const unknownHistory = legacyPayload()
    unknownHistory.history = [{ acceptanceId: 'missing', questId: 'quest-missing', status: 'abandoned', occurredAt: '2026-08-27T08:00:00.000Z', xpAwarded: 0 }]
    const loaded = loadState(memoryStorage(JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-28T09:00:00.000Z', data: unknownHistory })), catalog)
    expect(loaded.status).toBe('ok')
    if (loaded.status === 'ok') expect(loaded.envelope.data.history).toEqual([])
  })

  it('recovers from missing, truncated, and future-version data without throwing', () => {
    expect(loadState(memoryStorage(), emptyCatalog).status).toBe('empty')
    expect(loadState(memoryStorage('{"schemaVersion":'), emptyCatalog).status).toBe('corrupt')
    expect(loadState(memoryStorage(JSON.stringify({ schemaVersion: 99, contentVersion: '9.0.0', updatedAt: '2026-08-24', data: payload() })), catalog).status).toBe('future-version')
  })

  it('trims finite histories and removes invalid noncritical references', () => {
    const value = payload()
    value.recentQuestIds = Array.from({ length: 12 }, (_, index) => index % 2 === 0 ? active.questId : `quest-invalid-${index}`)
    value.history = Array.from({ length: 120 }, (_, index) => ({ acceptanceId: `accept-${index}`, questId: active.questId, questTitle: active.title, questContentVersion: active.contentVersion, questCategory: active.category, questDifficulty: active.difficulty, status: 'completed' as const, occurredAt: `2026-08-24T08:${String(index % 60).padStart(2, '0')}:00.000Z`, xpAwarded: active.xp }))
    const storage = memoryStorage(JSON.stringify({ schemaVersion: 2, contentVersion: content.contentVersion, updatedAt: '2026-08-24T09:00:00.000Z', data: value }))
    const loaded = loadState(storage, catalog)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.envelope.data.recentQuestIds).toEqual(Array.from({ length: 6 }, () => active.questId))
    expect(loaded.envelope.data.history).toHaveLength(100)
  })

  it('rejects forbidden media, location, or proof fields and reports quota failures', () => {
    const unsafe = { schemaVersion: 2 as const, contentVersion: '1.0.0', updatedAt: '2026-08-24T09:00:00.000Z', data: { ...payload(), image: 'data:image/png;base64,bad' } }
    expect(saveState(memoryStorage(), unsafe).ok).toBe(false)
    const quotaStorage = { getItem: () => null, removeItem: () => undefined, setItem: () => { throw new Error('quota') } }
    expect(saveState(quotaStorage, { schemaVersion: 2, contentVersion: '1.0.0', updatedAt: '2026-08-24T09:00:00.000Z', data: payload() })).toEqual({ ok: false, reason: 'quota-or-unavailable' })
  })

  it('loads legacy schema-v1 state with safe default guild settings', () => {
    const legacy = payload() as Partial<StoragePayload>
    delete legacy.settings
    const storage = memoryStorage(JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-24T09:00:00.000Z', data: legacy }))
    const loaded = loadState(storage, catalog)
    expect(loaded.status).toBe('ok')
    if (loaded.status === 'ok') expect(loaded.envelope.data.settings).toEqual({ hasSeenGuide: false, softAvoidCategoryIds: [] })
  })
})

function payload(): StoragePayload {
  return { preference: { minutes: 10, energy: 1, environment: 'indoor', social: 'none', spend: 'none', timeOfDay: 'day', location: 'familiar-indoor', goalId: 'relax', excludedConditions: [] }, recentQuestIds: [], completedQuestIds: [], history: [], xp: 0, streak: { current: 0, best: 0 }, unlockedBadgeIds: [], rngState: 1, settings: { hasSeenGuide: false, softAvoidCategoryIds: [] } }
}

function legacyPayload(): LegacyPayload {
  return { preference: { minutes: 10, energy: 1, environment: 'indoor', social: 'none', spend: 'none', timeOfDay: 'day', location: 'familiar-indoor', goalId: 'relax', excludedConditions: [] }, recentQuestIds: [], completedQuestIds: [], history: [], xp: 0, streak: { current: 0, best: 0 }, unlockedBadgeIds: [], rngState: 1, settings: { hasSeenGuide: false, softAvoidCategoryIds: [] } }
}

function memoryStorage(initial?: string): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  let value = initial ?? null
  return { getItem: (key) => key === STORAGE_KEY ? value : null, setItem: (key, next) => { if (key === STORAGE_KEY) value = next }, removeItem: (key) => { if (key === STORAGE_KEY) value = null } }
}
