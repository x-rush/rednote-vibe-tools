import { describe, expect, it } from 'vitest'
import {
  STORAGE_KEY,
  createStoragePayload,
  loadLocalState,
  mergeSavedReplay,
  restoreStorage,
  saveLocalState,
  serializeStorage,
} from './storage'
import type { ReplayAnswers, StoredReplay } from '../domain/types'

const answers: ReplayAnswers = {
  relationshipType: 'friend',
  communicationGoal: 'coordinate',
  conflictLevel: 'medium',
  emotionId: 'feel-uneasy',
  originalExpressionId: 'expr-accusation',
  responseId: 'response-discussed',
  intention: 'repair-now',
  scenarioId: 'friend-late',
}
const saved = (id: string, scenarioId = 'friend-late'): StoredReplay => ({
  id,
  savedAt: `2026-08-24T00:00:0${id.at(-1)}.000Z`,
  answers: { ...answers, scenarioId },
  scenarioId,
})

class MemoryStorage implements Storage {
  #data = new Map<string, string>()
  get length() { return this.#data.size }
  clear() { this.#data.clear() }
  getItem(key: string) { return this.#data.get(key) ?? null }
  key(index: number) { return [...this.#data.keys()][index] ?? null }
  removeItem(key: string) { this.#data.delete(key) }
  setItem(key: string, value: string) { this.#data.set(key, value) }
}

describe('structured local storage', () => {
  it('round-trips a valid payload', () => {
    const payload = createStoragePayload({
      contentVersion: '1.0.0',
      now: '2026-08-24T00:00:00.000Z',
      saveMode: 'local',
      draft: answers,
      savedResults: [saved('save-1')],
    })
    const restored = restoreStorage(serializeStorage(payload), new Set(['friend-late']), '1.0.0')

    expect(restored.status).toBe('ok')
    expect(restored.payload.data.draft).toEqual(answers)
    expect(restored.payload.data.savedResults).toHaveLength(1)
  })

  it('recovers from truncated JSON', () => {
    const restored = restoreStorage('{"schemaVersion":', new Set(['friend-late']), '1.0.0')

    expect(restored.status).toBe('corrupt')
    expect(restored.payload.data.savedResults).toEqual([])
  })

  it('recovers from a future schema without overwriting it', () => {
    const restored = restoreStorage(JSON.stringify({ schemaVersion: 99 }), new Set(['friend-late']), '1.0.0')
    expect(restored.status).toBe('future-version')
  })

  it('drops dangling scenario references and reports a content update', () => {
    const payload = createStoragePayload({ contentVersion: '0.9.0', savedResults: [saved('save-1', 'missing')] })
    const restored = restoreStorage(serializeStorage(payload), new Set(['friend-late']), '1.0.0')

    expect(restored.status).toBe('content-updated')
    expect(restored.payload.data.savedResults).toEqual([])
  })

  it('keeps only the newest three saved results', () => {
    const merged = mergeSavedReplay([saved('save-1'), saved('save-2'), saved('save-3')], saved('save-4'))
    expect(merged.map(({ id }) => id)).toEqual(['save-4', 'save-3', 'save-2'])
  })

  it('rejects media and Base64-like values at the write boundary', () => {
    const payload = createStoragePayload({ contentVersion: '1.0.0' }) as unknown as Record<string, unknown>
    payload.image = 'data:image/png;base64,abc'
    expect(() => serializeStorage(payload)).toThrow(/媒体/)
  })

  it('saves and loads through an injected localStorage implementation', () => {
    const storage = new MemoryStorage()
    const payload = createStoragePayload({ contentVersion: '1.0.0', recentResult: saved('save-1') })
    saveLocalState(storage, payload)

    expect(storage.getItem(STORAGE_KEY)).toBeTruthy()
    expect(loadLocalState(storage, new Set(['friend-late']), '1.0.0').payload.data.recentResult?.id).toBe('save-1')
  })

  it('drops records with invalid enums, unknown fields, or forbidden media on restore', () => {
    const payload = createStoragePayload({ contentVersion: '1.0.0', savedResults: [saved('save-1')] }) as unknown as {
      data: { savedResults: Array<Record<string, unknown>> }
    }
    payload.data.savedResults[0]!.answers = { ...answers, relationshipType: 'stranger' }
    payload.data.savedResults[0]!.screenshot = 'data:image/png;base64,abc'

    const restored = restoreStorage(JSON.stringify(payload), new Set(['friend-late']), '1.0.0')

    expect(restored.status).toBe('corrupt')
    expect(restored.payload.data.savedResults).toEqual([])
  })

  it('validates content IDs when a complete reference index is supplied', () => {
    const payload = createStoragePayload({ contentVersion: '1.0.0', draft: { ...answers, emotionId: 'feel-missing-ref' } })
    const restored = restoreStorage(serializeStorage(payload), {
      scenarioIds: new Set(['friend-late']),
      emotionIds: new Set(['feel-uneasy']),
      originalExpressionIds: new Set(['expr-accusation']),
      responseIds: new Set(['response-discussed']),
    }, '1.0.0')

    expect(restored.status).toBe('content-updated')
    expect(restored.payload.data.draft).toBeUndefined()
  })
})
