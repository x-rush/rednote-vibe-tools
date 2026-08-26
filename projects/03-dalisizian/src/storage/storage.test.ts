import { describe, expect, it } from 'vitest'
import { contentIndex, contentPackage } from '../content'
import { createInitialCaseState } from '../game/engine'
import {
  STORAGE_KEY,
  createDefaultSave,
  createResilientCaseRecordStore,
  loadSave,
  recordCaseCompletion,
  restoreCaseProgress,
  saveLauncher,
} from './storage'
import type { CaseRecordStore, ProjectSaveData, StorageLike } from './types'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

class MemoryCaseStore implements CaseRecordStore {
  readonly values = new Map<string, unknown>()
  async get<T>(store: 'caseProgress' | 'caseVerdicts', caseId: string): Promise<T | undefined> { return this.values.get(`${store}:${caseId}`) as T | undefined }
  async put<T>(store: 'caseProgress' | 'caseVerdicts', caseId: string, value: T): Promise<void> { this.values.set(`${store}:${caseId}`, value) }
  async delete(store: 'caseProgress' | 'caseVerdicts', caseId: string): Promise<void> { this.values.delete(`${store}:${caseId}`) }
  async clear(): Promise<void> { this.values.clear() }
}

const firstCaseId = 'case-home-roof-pig'

describe('versioned project storage', () => {
  it('saves and restores a structured launcher envelope', () => {
    const storage = new MemoryStorage()
    const save = createDefaultSave(firstCaseId)
    save.currentCaseId = firstCaseId
    save.completedCaseIds = [firstCaseId]

    expect(saveLauncher(storage, save, contentPackage.contentVersion, '2026-08-24T00:00:00.000Z').ok).toBe(true)
    const loaded = loadSave(storage, contentIndex, contentPackage.contentVersion)

    expect(loaded.recovered).toBe(false)
    expect(loaded.data.currentCaseId).toBe(firstCaseId)
    expect(loaded.data.completedCaseIds).toEqual([firstCaseId])
  })

  it.each([
    ['truncated JSON', '{"schemaVersion":1'],
    ['future schema', JSON.stringify({ schemaVersion: 99, contentVersion: '1.0.0', updatedAt: '2026-08-24T00:00:00.000Z', data: {} })],
  ])('recovers safely from %s without overwriting the original value', (_label, raw) => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, raw)

    const loaded = loadSave(storage, contentIndex, contentPackage.contentVersion)
    expect(loaded.recovered).toBe(true)
    expect(loaded.data.unlockedCaseIds).toEqual([firstCaseId])
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('filters invalid references, duplicates, and unbounded arrays', () => {
    const storage = new MemoryStorage()
    const data: ProjectSaveData = {
      ...createDefaultSave(firstCaseId),
      currentCaseId: 'case-does-not-exist',
      unlockedCaseIds: Array.from({ length: 30 }, () => 'case-does-not-exist'),
      completedCaseIds: [firstCaseId, firstCaseId, 'case-does-not-exist'],
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, contentVersion: '0.9.0', updatedAt: '2026-08-24T00:00:00.000Z', data }))

    const loaded = loadSave(storage, contentIndex, contentPackage.contentVersion)
    expect(loaded.recovered).toBe(true)
    expect(loaded.data.currentCaseId).toBeUndefined()
    expect(loaded.data.unlockedCaseIds).toEqual([firstCaseId])
    expect(loaded.data.completedCaseIds).toEqual([firstCaseId])
  })

  it('drops an unknown saved rating before the collection can render it', () => {
    const storage = new MemoryStorage()
    const data = {
      ...createDefaultSave(firstCaseId),
      completedCaseIds: [firstCaseId],
      bestRatings: {
        [firstCaseId]: { rating: '伪造评级', score: 99, completedAt: '2026-08-26T00:00:00.000Z' },
      },
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, contentVersion: contentPackage.contentVersion, updatedAt: '2026-08-26T00:00:00.000Z', data }))

    const loaded = loadSave(storage, contentIndex, contentPackage.contentVersion)
    expect(loaded.recovered).toBe(true)
    expect(loaded.data.bestRatings[firstCaseId]).toBeUndefined()
  })

  it('keeps the best evaluation and unlocks a valid next case', () => {
    const initial = createDefaultSave(firstCaseId)
    const first = recordCaseCompletion(initial, firstCaseId, '案牍清通', 68, 'case-rest-under-tree', '2026-08-24T00:00:00.000Z', contentIndex)
    const lower = recordCaseCompletion(first, firstCaseId, '重审有得', 40, undefined, '2026-08-24T01:00:00.000Z', contentIndex)

    expect(lower.bestRatings[firstCaseId].score).toBe(68)
    expect(lower.unlockedCaseIds).toContain('case-rest-under-tree')
    expect(lower.completedCaseIds).toContain(firstCaseId)
  })

  it('refuses Base64 and Blob values before writing', () => {
    const storage = new MemoryStorage()
    const base64Save = { ...createDefaultSave(firstCaseId), unsafe: 'data:image/png;base64,AAAA' } as unknown as ProjectSaveData
    expect(saveLauncher(storage, base64Save, contentPackage.contentVersion).ok).toBe(false)

    const blobSave = { ...createDefaultSave(firstCaseId), unsafe: new Blob(['image']) } as unknown as ProjectSaveData
    expect(saveLauncher(storage, blobSave, contentPackage.contentVersion).ok).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('falls back to a bounded local record store when the primary store fails', async () => {
    const storage = new MemoryStorage()
    const failing: CaseRecordStore = {
      get: async () => { throw new Error('blocked') },
      put: async () => { throw new Error('blocked') },
      delete: async () => { throw new Error('blocked') },
      clear: async () => { throw new Error('blocked') },
    }
    const records = createResilientCaseRecordStore(failing, storage)
    const caseData = contentIndex.cases.get(firstCaseId)
    if (!caseData) throw new Error('case fixture missing')
    const progress = createInitialCaseState(caseData)

    const written = await records.put('caseProgress', firstCaseId, progress)
    const restored = await records.get<typeof progress>('caseProgress', firstCaseId)
    expect(written.degraded).toBe(true)
    expect(restored.degraded).toBe(true)
    expect(restored.value?.caseId).toBe(firstCaseId)
  })

  it('uses a healthy record store without degradation', async () => {
    const records = createResilientCaseRecordStore(new MemoryCaseStore(), new MemoryStorage())
    await records.put('caseVerdicts', firstCaseId, { score: 88 })
    const restored = await records.get<{ score: number }>('caseVerdicts', firstCaseId)
    expect(restored).toEqual({ value: { score: 88 }, degraded: false })
  })

  it('sanitizes saved case progress and restarts only a case with a missing current node', () => {
    const caseData = contentIndex.cases.get(firstCaseId)
    if (!caseData) throw new Error('case fixture missing')
    const valid = {
      ...createInitialCaseState(caseData),
      clueIds: ['clue-home-form', 'clue-home-form', 'clue-does-not-exist'],
      evidenceIds: ['evidence-home-early-form', 'evidence-does-not-exist'],
      visitedNodeIds: ['node-home-00', 'node-home-00', 'node-does-not-exist'],
    }
    const restored = restoreCaseProgress(valid, caseData, contentIndex)
    expect(restored.recovered).toBe(true)
    expect(restored.data.clueIds).toEqual(['clue-home-form'])
    expect(restored.data.evidenceIds).toEqual(['evidence-home-early-form'])
    expect(restored.data.visitedNodeIds).toEqual(['node-home-00'])

    const broken = restoreCaseProgress({ ...valid, currentNodeId: 'node-does-not-exist' }, caseData, contentIndex)
    expect(broken.recovered).toBe(true)
    expect(broken.data.currentNodeId).toBe(caseData.startNodeId)
    expect(broken.data.clueIds).toEqual([])
  })

  it('adds safe V2 reasoning defaults when restoring an older case save', () => {
    const caseData = contentIndex.cases.get(firstCaseId)
    if (!caseData) throw new Error('case fixture missing')
    const legacy = createInitialCaseState(caseData) as Partial<ReturnType<typeof createInitialCaseState>>
    delete legacy.deductionAttempts
    delete legacy.firstDeductionAnswers
    delete legacy.reviewedRouteIds
    delete legacy.evidenceObservationIdsByEvidenceId

    const restored = restoreCaseProgress(legacy, caseData, contentIndex)

    expect(restored.data.deductionAttempts).toEqual({})
    expect(restored.data.firstDeductionAnswers).toEqual({})
    expect(restored.data.reviewedRouteIds).toEqual([])
    expect(restored.data.evidenceObservationIdsByEvidenceId).toEqual({})
  })

  it('sanitizes evidence observations by case, point ID, uniqueness, and source order', () => {
    const caseData = contentIndex.cases.get(firstCaseId)
    if (!caseData) throw new Error('case fixture missing')
    const progress = {
      ...createInitialCaseState(caseData),
      evidenceObservationIdsByEvidenceId: {
        'evidence-home-early-form': ['home-early-form-focus-b', 'bad-id', 'home-early-form-focus-a', 'home-early-form-focus-b'],
        'evidence-rest-components': ['rest-components-focus-a'],
      },
    }

    const restored = restoreCaseProgress(progress, caseData, contentIndex)

    expect(restored.recovered).toBe(true)
    expect(restored.data.evidenceObservationIdsByEvidenceId).toEqual({
      'evidence-home-early-form': ['home-early-form-focus-a', 'home-early-form-focus-b'],
    })
  })
})
