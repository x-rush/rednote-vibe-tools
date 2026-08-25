import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { selectQuestionIds } from '../quiz/selection'
import type { StoragePayload } from './storage'
import { STORAGE_KEY, clearStorage, loadStorage, saveStorage } from './storage'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const content = validateContent(rawContent)
const payload: StoragePayload = {
  schemaVersion: 1,
  quizVersion: '1.0.0',
  updatedAt: '2026-08-24T00:00:00.000Z',
  data: {
    activeProgress: { seed: 'stored', questionIds: selectQuestionIds(content, 'stored'), currentIndex: 0, answers: [] },
    settings: { muted: false, reducedMotion: false },
  },
}

describe('SHBTI local storage adapter', () => {
  it('returns an empty outcome when no data exists', () => {
    expect(loadStorage(new MemoryStorage(), content)).toEqual({ status: 'empty' })
  })

  it('reports unavailable storage without attempting destructive recovery', () => {
    const unavailable = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') },
    }

    expect(loadStorage(unavailable, content)).toEqual({ status: 'unavailable', reason: '本机存储不可用' })
  })

  it('round-trips a valid versioned payload', () => {
    const storage = new MemoryStorage()
    saveStorage(storage, payload, content)
    expect(loadStorage(storage, content)).toEqual({ status: 'ready', payload })
  })

  it('migrates valid progress from the previous project namespace', () => {
    const storage = new MemoryStorage()
    const legacyKey = ['xhs-tool:s', 'bti:state:v1'].join('')
    storage.setItem(legacyKey, JSON.stringify(payload))

    expect(loadStorage(storage, content)).toEqual({ status: 'ready', payload })
    expect(storage.getItem('xhs-tool:shbti:state:v1')).toBe(JSON.stringify(payload))
    expect(storage.getItem(legacyKey)).toBeNull()
  })

  it('preserves previous progress when migration cannot write the new key', () => {
    const legacyKey = ['xhs-tool:s', 'bti:state:v1'].join('')
    const stored = JSON.stringify(payload)
    const values = new Map([[legacyKey, stored]])
    const storage = {
      getItem(key: string) { return values.get(key) ?? null },
      setItem() { throw new Error('blocked') },
      removeItem(key: string) { values.delete(key) },
    }

    expect(loadStorage(storage, content)).toEqual({ status: 'unavailable', reason: '本机存储不可用' })
    expect(storage.getItem(legacyKey)).toBe(stored)
  })

  it.each([
    ['corrupt JSON', '{"schemaVersion":', '数据不是有效 JSON'],
    ['unknown schema', JSON.stringify({ ...payload, schemaVersion: 99 }), '不支持的存储版本'],
    ['missing fields', JSON.stringify({ schemaVersion: 1, quizVersion: '1.0.0' }), '字段缺失'],
  ])('recovers safely from %s', (_name, stored, reason) => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, stored)
    expect(loadStorage(storage, content)).toEqual({ status: 'recovered', reason })
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clears progress that references stale content IDs', () => {
    const storage = new MemoryStorage()
    const stale = structuredClone(payload)
    stale.data.activeProgress!.questionIds[0] = 'question-retired'
    storage.setItem(STORAGE_KEY, JSON.stringify(stale))

    expect(loadStorage(storage, content)).toEqual({ status: 'recovered', reason: '存档引用的题目或选项已失效' })
  })

  it('rejects a quizVersion that does not match current content', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, quizVersion: '2.0.0' }))
    expect(loadStorage(storage, content)).toEqual({ status: 'recovered', reason: '题库版本不匹配' })
  })

  it('clears only the SHBTI project key', () => {
    const storage = new MemoryStorage()
    const legacyKey = ['xhs-tool:s', 'bti:state:v1'].join('')
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    storage.setItem('xhs-tool:shbti:state:v1', JSON.stringify(payload))
    storage.setItem(legacyKey, JSON.stringify(payload))
    storage.setItem('xhs-tool:another:state:v1', 'keep')
    clearStorage(storage)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem('xhs-tool:shbti:state:v1')).toBeNull()
    expect(storage.getItem(legacyKey)).toBeNull()
    expect(storage.getItem('xhs-tool:another:state:v1')).toBe('keep')
  })
})
