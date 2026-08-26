import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { SavedChecklist } from '../content/schema'
import { loadContent } from '../content/validate'
import { STORAGE_KEY, createChecklistStorage } from './checklistStorage'

const content = loadContent(rawContent)

class MemoryStorage {
  values = new Map<string, string>()
  failReads = false
  failWrites = false
  failRemovals = false

  getItem(key: string) {
    if (this.failReads) throw new Error('storage blocked')
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('quota exceeded')
    this.values.set(key, value)
  }
  removeItem(key: string) {
    if (this.failRemovals) throw new Error('storage blocked')
    this.values.delete(key)
  }
}

const saved = (id: string, updatedAt: string, itemId = 'phone'): SavedChecklist => ({
  id,
  name: `清单${id}`,
  scenarioId: 'scenario-commute',
  conditions: { rain: true },
  items: [{ itemId, checked: id === 'save-2' }],
  createdAt: updatedAt,
  updatedAt,
  contentVersion: content.contentVersion,
})

describe('checklist storage', () => {
  it('round-trips a structured checklist without copying content text', () => {
    const memory = new MemoryStorage()
    const storage = createChecklistStorage(memory, content)

    expect(storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))).toEqual({ ok: true })
    const loaded = storage.load()

    expect(loaded.status).toBe('ok')
    expect(loaded.payload.savedChecklists[0]).toEqual(saved('save-1', '2026-08-24T01:00:00.000Z'))
    expect(memory.getItem(STORAGE_KEY)).not.toContain('用于联系支付与行程')
  })

  it('requires an explicit target before saving a fourth list', () => {
    const memory = new MemoryStorage()
    const storage = createChecklistStorage(memory, content)
    storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))
    storage.save(saved('save-2', '2026-08-24T02:00:00.000Z'))
    storage.save(saved('save-3', '2026-08-24T03:00:00.000Z'))

    expect(storage.save(saved('save-4', '2026-08-24T04:00:00.000Z'))).toEqual({
      ok: false,
      error: 'overwrite-required',
      candidateId: 'save-1',
    })
    expect(storage.load().payload.savedChecklists.map((item) => item.id)).toEqual(['save-3', 'save-2', 'save-1'])

    expect(storage.save(saved('save-4', '2026-08-24T04:00:00.000Z'), 'save-1')).toEqual({ ok: true })
    expect(storage.load().payload.savedChecklists.map((item) => item.id)).toEqual(['save-4', 'save-3', 'save-2'])
  })

  it('persists the guide preference across ordinary writes', () => {
    const memory = new MemoryStorage()
    const storage = createChecklistStorage(memory, content)

    expect(storage.setGuideDismissed(true)).toEqual({ ok: true })
    storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))

    expect(storage.load().payload.guideDismissed).toBe(true)
  })

  it('updates an existing ID rather than creating a duplicate', () => {
    const memory = new MemoryStorage()
    const storage = createChecklistStorage(memory, content)
    storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))
    storage.save({ ...saved('save-1', '2026-08-24T02:00:00.000Z'), name: '更新后的清单' })

    expect(storage.load().payload.savedChecklists).toHaveLength(1)
    expect(storage.load().payload.savedChecklists[0].name).toBe('更新后的清单')
  })

  it('reports malformed JSON without silently overwriting it', () => {
    const memory = new MemoryStorage()
    memory.setItem(STORAGE_KEY, '{"broken"')
    const storage = createChecklistStorage(memory, content)

    const result = storage.load()

    expect(result.status).toBe('corrupt')
    expect(result.recoverableRaw).toBe('{"broken"')
    expect(memory.getItem(STORAGE_KEY)).toBe('{"broken"')
  })

  it('reports a future schema as unsupported', () => {
    const memory = new MemoryStorage()
    memory.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, savedChecklists: [] }))

    expect(createChecklistStorage(memory, content).load().status).toBe('unsupported-version')
  })

  it('drops stale item references but keeps the usable checklist', () => {
    const memory = new MemoryStorage()
    const payload = {
      schemaVersion: 1,
      contentVersion: content.contentVersion,
      updatedAt: '2026-08-24T02:00:00.000Z',
      savedChecklists: [saved('save-1', '2026-08-24T01:00:00.000Z', 'removed-item')],
    }
    memory.setItem(STORAGE_KEY, JSON.stringify(payload))

    const result = createChecklistStorage(memory, content).load()

    expect(result.status).toBe('recovered')
    expect(result.payload.savedChecklists[0].items).toEqual([])
  })

  it('requires explicit recovery before replacing corrupt data', () => {
    const memory = new MemoryStorage()
    memory.setItem(STORAGE_KEY, 'not-json')
    const storage = createChecklistStorage(memory, content)

    expect(storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))).toEqual({ ok: false, error: 'storage-corrupt' })
    storage.clear()
    expect(storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))).toEqual({ ok: true })
  })

  it('surfaces write failures and can delete one saved checklist', () => {
    const memory = new MemoryStorage()
    const storage = createChecklistStorage(memory, content)
    storage.save(saved('save-1', '2026-08-24T01:00:00.000Z'))
    storage.save(saved('save-2', '2026-08-24T02:00:00.000Z'))
    expect(storage.remove('save-1')).toEqual({ ok: true })
    expect(storage.load().payload.savedChecklists.map((item) => item.id)).toEqual(['save-2'])

    memory.failWrites = true
    expect(storage.save(saved('save-3', '2026-08-24T03:00:00.000Z'))).toEqual({ ok: false, error: 'write-failed' })
  })

  it('reports unavailable reads and removals without throwing', () => {
    const memory = new MemoryStorage()
    const storage = createChecklistStorage(memory, content)
    memory.failReads = true
    expect(storage.load().status).toBe('unavailable')
    memory.failReads = false
    memory.failRemovals = true
    expect(storage.clear()).toEqual({ ok: false, error: 'write-failed' })
  })
})
