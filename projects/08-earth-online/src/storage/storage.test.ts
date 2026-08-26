import { describe, expect, it } from 'vitest'
import type { StoragePayload } from '../content/schema'
import { STORAGE_KEY, loadState, saveState } from './storage'

describe('versioned local storage', () => {
  it('recovers from missing, truncated, and future-version data without throwing', () => {
    expect(loadState(memoryStorage(), new Set()).status).toBe('empty')
    expect(loadState(memoryStorage('{"schemaVersion":'), new Set()).status).toBe('corrupt')
    expect(loadState(memoryStorage(JSON.stringify({ schemaVersion: 99, contentVersion: '9.0.0', updatedAt: '2026-08-24', data: payload() })), new Set(['quest-rest-window-color'])).status).toBe('future-version')
  })

  it('trims finite histories and removes invalid noncritical references', () => {
    const value = payload()
    value.recentQuestIds = Array.from({ length: 12 }, (_, index) => index % 2 === 0 ? 'quest-rest-window-color' : `quest-invalid-${index}`)
    value.history = Array.from({ length: 120 }, (_, index) => ({ acceptanceId: `accept-${index}`, questId: 'quest-rest-window-color', status: 'completed' as const, occurredAt: `2026-08-24T08:${String(index % 60).padStart(2, '0')}:00.000Z`, xpAwarded: 20 }))
    const storage = memoryStorage(JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-24T09:00:00.000Z', data: value }))
    const loaded = loadState(storage, new Set(['quest-rest-window-color']))
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.envelope.data.recentQuestIds).toEqual(['quest-rest-window-color', 'quest-rest-window-color', 'quest-rest-window-color', 'quest-rest-window-color', 'quest-rest-window-color', 'quest-rest-window-color'])
    expect(loaded.envelope.data.history).toHaveLength(100)
  })

  it('rejects forbidden media, location, or proof fields and reports quota failures', () => {
    const unsafe = { schemaVersion: 1 as const, contentVersion: '1.0.0', updatedAt: '2026-08-24T09:00:00.000Z', data: { ...payload(), image: 'data:image/png;base64,bad' } }
    expect(saveState(memoryStorage(), unsafe).ok).toBe(false)
    const quotaStorage = { getItem: () => null, removeItem: () => undefined, setItem: () => { throw new Error('quota') } }
    expect(saveState(quotaStorage, { schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-24T09:00:00.000Z', data: payload() })).toEqual({ ok: false, reason: 'quota-or-unavailable' })
  })

  it('loads legacy schema-v1 state with safe default guild settings', () => {
    const legacy = payload() as Partial<StoragePayload>
    delete legacy.settings
    const storage = memoryStorage(JSON.stringify({ schemaVersion: 1, contentVersion: '1.0.0', updatedAt: '2026-08-24T09:00:00.000Z', data: legacy }))
    const loaded = loadState(storage, new Set(['quest-rest-window-color']))
    expect(loaded.status).toBe('ok')
    if (loaded.status === 'ok') expect(loaded.envelope.data.settings).toEqual({ hasSeenGuide: false, softAvoidCategoryIds: [] })
  })
})

function payload(): StoragePayload {
  return { preference: { minutes: 10, energy: 1, environment: 'indoor', social: 'none', spend: 'none', timeOfDay: 'day', location: 'familiar-indoor', goalId: 'relax', excludedConditions: [] }, recentQuestIds: [], completedQuestIds: [], history: [], xp: 0, streak: { current: 0, best: 0 }, unlockedBadgeIds: [], rngState: 1, settings: { hasSeenGuide: false, softAvoidCategoryIds: [] } }
}

function memoryStorage(initial?: string): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  let value = initial ?? null
  return { getItem: (key) => key === STORAGE_KEY ? value : null, setItem: (key, next) => { if (key === STORAGE_KEY) value = next }, removeItem: (key) => { if (key === STORAGE_KEY) value = null } }
}
