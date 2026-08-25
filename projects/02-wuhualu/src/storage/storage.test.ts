import { describe, expect, it } from 'vitest'
import {
  STORAGE_KEY,
  clearStorage,
  createDefaultStoragePayload,
  loadStorage,
  saveStorage,
  type StorageLike,
} from './storage.ts'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const validIds = new Set(['artifact-a', 'artifact-b'])

describe('versioned local storage', () => {
  it('round-trips a valid payload through the project-only key', () => {
    const storage = new MemoryStorage()
    const payload = createDefaultStoragePayload('1.0.0', '2026-08-24T00:00:00.000Z')
    payload.collection = [{ artifactId: 'artifact-a', bestStars: 2, unlockedAt: payload.updatedAt }]
    saveStorage(storage, payload)
    expect(storage.values.has(STORAGE_KEY)).toBe(true)
    expect(loadStorage(storage, validIds, '1.0.0', payload.updatedAt)).toEqual({ payload, recovery: null })
    clearStorage(storage)
    expect(storage.values.size).toBe(0)
  })

  it('recovers from truncated JSON without replacing the original value', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, '{"schemaVersion":1')
    const loaded = loadStorage(storage, validIds, '1.0.0', '2026-08-24T00:00:00.000Z')
    expect(loaded.recovery).toBe('corrupt-json')
    expect(loaded.payload.collection).toEqual([])
    expect(storage.getItem(STORAGE_KEY)).toBe('{"schemaVersion":1')
  })

  it('uses a safe default for unknown future schemas', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }))
    expect(loadStorage(storage, validIds, '1.0.0', '2026-08-24T00:00:00.000Z').recovery).toBe('unsupported-schema')
  })

  it('drops stale IDs and caps recent records instead of trusting stored arrays', () => {
    const storage = new MemoryStorage()
    const payload = createDefaultStoragePayload('1.0.0', '2026-08-24T00:00:00.000Z')
    payload.collection = [
      { artifactId: 'artifact-a', bestStars: 2, unlockedAt: payload.updatedAt },
      { artifactId: 'artifact-stale', bestStars: 3, unlockedAt: payload.updatedAt },
    ]
    payload.recentArtifactIds = Array.from({ length: 40 }, (_, index) => index % 2 ? 'artifact-a' : 'artifact-stale')
    payload.recentAttempts = Array.from({ length: 40 }, () => ({ artifactId: 'artifact-a', correct: true, stars: 3, answeredAt: payload.updatedAt }))
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    const loaded = loadStorage(storage, validIds, '1.0.0', payload.updatedAt)
    expect(loaded.payload.collection.map(({ artifactId }) => artifactId)).toEqual(['artifact-a'])
    expect(loaded.payload.recentArtifactIds).toEqual(['artifact-a'])
    expect(loaded.payload.recentAttempts).toHaveLength(20)
    expect(loaded.recovery).toBe('sanitized-references')
  })

  it('keeps compatible collection data but clears a session from another content version', () => {
    const storage = new MemoryStorage()
    const payload = createDefaultStoragePayload('0.9.0', '2026-08-24T00:00:00.000Z')
    payload.currentSession = { seed: 'old', artifactIds: ['artifact-a'], index: 0, answers: [], revealedClueIds: [], score: 0, streak: 0 }
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    const loaded = loadStorage(storage, validIds, '1.0.0', payload.updatedAt)
    expect(loaded.recovery).toBe('content-version-changed')
    expect(loaded.payload.contentVersion).toBe('1.0.0')
    expect(loaded.payload.currentSession).toBeNull()
  })

  it('adds empty V2 learning fields while preserving a V1 collection', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      contentVersion: '1.0.0',
      updatedAt: '2026-08-24T00:00:00.000Z',
      collection: [{ artifactId: 'artifact-a', bestStars: 2, unlockedAt: '2026-08-24T00:00:00.000Z' }],
      bestScore: 200,
      recentAttempts: [],
      currentSession: null,
      recentArtifactIds: [],
      settings: { muted: false, reducedMotion: false },
    }))

    const loaded = loadStorage(storage, validIds, '1.0.0', '2026-08-25T00:00:00.000Z')
    expect(loaded.payload.collection).toHaveLength(1)
    expect(loaded.payload.artifactProgress).toEqual([])
    expect(loaded.payload.setSealIds).toEqual([])
  })

  it('drops a malformed current session before it can crash resume', () => {
    const storage = new MemoryStorage()
    const payload = createDefaultStoragePayload('2.0.0', '2026-08-25T00:00:00.000Z')
    Object.assign(payload, {
      currentSession: {
        seed: 'broken', artifactIds: ['artifact-a'], index: 9,
        answers: [null], revealedClueIds: [], score: 0, streak: 0,
      },
    })
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    const loaded = loadStorage(storage, validIds, '2.0.0', payload.updatedAt)
    expect(loaded.payload.currentSession).toBeNull()
    expect(loaded.recovery).toBe('sanitized-references')
  })

  it('round-trips and sanitizes V2 learning progress without storing media', () => {
    const storage = new MemoryStorage()
    const payload = createDefaultStoragePayload('2.0.0', '2026-08-25T00:00:00.000Z')
    Object.assign(payload, {
      artifactProgress: [
        { artifactId: 'artifact-a', observedSpotIds: ['spot-a', 'spot-a'], storyReadSections: ['first-look', 'bad-section'], memoryCompleted: true },
        { artifactId: 'artifact-stale', observedSpotIds: ['spot-stale'], storyReadSections: [], memoryCompleted: false },
      ],
      setSealIds: ['first-fire', 'not-a-set', 'first-fire'],
    })
    saveStorage(storage, payload)

    const loaded = loadStorage(storage, validIds, '2.0.0', payload.updatedAt)
    expect(loaded.payload.artifactProgress).toEqual([
      { artifactId: 'artifact-a', observedSpotIds: ['spot-a'], storyReadSections: ['first-look'], memoryCompleted: true },
    ])
    expect(loaded.payload.setSealIds).toEqual(['first-fire'])
    expect(loaded.recovery).toBe('sanitized-references')
  })

  it('rejects Base64 or binary-shaped values at the persistence boundary', () => {
    const storage = new MemoryStorage()
    const payload = createDefaultStoragePayload('1.0.0')
    expect(() => saveStorage(storage, { ...payload, rogue: 'data:image/png;base64,AAAA' } as never)).toThrow('禁止持久化媒体或二进制数据')
    expect(() => saveStorage(storage, { ...payload, rogue: 'https://images.example/item.webp' } as never)).toThrow('禁止持久化媒体或二进制数据')
  })
})
