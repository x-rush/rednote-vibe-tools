import { describe, expect, it } from 'vitest'
import type { ReplayDraftV2 } from '../domain/replay'
import {
  createStoragePayloadV2,
  restoreStorageV2,
  serializeStorageV2,
  type StorageReferenceIndexV2,
} from './storageV2'

const references: StorageReferenceIndexV2 = {
  scenarioIds: new Set(['friend-late']),
  feelingIds: new Set(['feel-worried']),
  inferenceExpressionIds: new Set(['expr-accusation']),
  needIds: new Set(['need-reliability']),
  factOptionIds: new Set(['friend-late-fact-observed']),
  requestOptionIds: new Set(['friend-late-request-next']),
  practiceOptionIds: new Set(['friend-late-practice-1']),
  practiceReplyIds: new Set(['friend-late-reply-repair-1']),
}

const draft: ReplayDraftV2 = {
  scenarioId: 'friend-late',
  relationshipType: 'friend',
  communicationGoal: 'coordinate',
  conflictLevel: 'medium',
  factOptionIds: ['friend-late-fact-observed'],
  feelingIds: ['feel-worried'],
  feelingIntensity: 'clear',
  inferenceExpressionIds: ['expr-accusation'],
  needIds: ['need-reliability'],
  requestOptionId: 'friend-late-request-next',
  selectedTone: 'direct',
  practiceOptionId: 'friend-late-practice-1',
  practiceReplyId: 'friend-late-reply-repair-1',
  limitedEdits: { direct: '保留这句有限编辑。' },
}

const emptyDraft: ReplayDraftV2 = {
  factOptionIds: [],
  feelingIds: [],
  inferenceExpressionIds: [],
  needIds: [],
  limitedEdits: {},
}

describe('V2 storage', () => {
  it('omits an empty current draft without deleting saved replays', () => {
    const payload = createStoragePayloadV2({
      contentVersion: '1.0.0',
      saveMode: 'local',
      draft: emptyDraft,
      savedResults: [{
        id: 'save-kept',
        scenarioId: 'friend-late',
        savedAt: '2026-08-26T10:00:00.000Z',
        draft,
      }],
    })

    expect(payload.data.draft).toBeUndefined()
    expect(payload.data.savedResults.map(({ id }) => id)).toEqual(['save-kept'])
  })

  it('restores a previously stored empty draft as no resumable progress', () => {
    const raw = JSON.stringify({
      schemaVersion: 2,
      contentVersion: '1.0.0',
      updatedAt: '2026-08-26T10:00:00.000Z',
      data: {
        saveMode: 'local',
        draft: emptyDraft,
        savedResults: [{
          id: 'save-kept',
          scenarioId: 'friend-late',
          savedAt: '2026-08-26T09:00:00.000Z',
          draft: emptyDraft,
        }],
      },
    })

    const restored = restoreStorageV2(raw, references, '1.0.0')

    expect(restored.status).toBe('ok')
    expect(restored.message).toBeUndefined()
    expect(restored.payload.data.saveMode).toBe('local')
    expect(restored.payload.data.draft).toBeUndefined()
    expect(restored.payload.data.savedResults.map(({ id }) => id)).toEqual(['save-kept'])
  })

  it('restores a valid V2 draft and limits saved results to three', () => {
    const payload = createStoragePayloadV2({
      contentVersion: '1.0.0',
      draft,
      savedResults: [1, 2, 3, 4].map((index) => ({
        id: `save-${index}`,
        scenarioId: 'friend-late',
        savedAt: `2026-08-2${index}T10:00:00.000Z`,
        draft,
      })),
    })

    const restored = restoreStorageV2(serializeStorageV2(payload), references, '1.0.0')

    expect(restored.status).toBe('ok')
    expect(restored.payload.data.draft?.requestOptionId).toBe('friend-late-request-next')
    expect(restored.payload.data.savedResults.map(({ id }) => id)).toEqual(['save-4', 'save-3', 'save-2'])
  })

  it('migrates mapped V1 answers without inventing missing V2 choices', () => {
    const rawV1 = JSON.stringify({
      schemaVersion: 1,
      contentVersion: '1.0.0',
      updatedAt: '2026-08-24T10:00:00.000Z',
      data: {
        saveMode: 'local',
        draft: {
          scenarioId: 'friend-late',
          relationshipType: 'friend',
          communicationGoal: 'coordinate',
          conflictLevel: 'medium',
          emotionId: 'feel-worried',
          originalExpressionId: 'expr-accusation',
          responseId: 'response-discussed',
          intention: 'prepare-next-time',
        },
        savedResults: [],
      },
    })

    const restored = restoreStorageV2(rawV1, references, '1.0.0')

    expect(restored.status).toBe('migrated')
    expect(restored.payload.data.saveMode).toBe('local')
    expect(restored.payload.data.draft?.feelingIds).toEqual(['feel-worried'])
    expect(restored.payload.data.draft?.inferenceExpressionIds).toEqual(['expr-accusation'])
    expect(restored.payload.data.draft?.factOptionIds).toEqual([])
    expect(restored.message).toContain('旧版')
  })

  it('rejects media fields and future schemas without overwriting them', () => {
    expect(() => serializeStorageV2({ screenshot: 'data:image/png;base64,abc' })).toThrow(/媒体/)

    const restored = restoreStorageV2(JSON.stringify({ schemaVersion: 99 }), references, '1.0.0')
    expect(restored.status).toBe('future-version')
    expect(restored.message).toContain('原数据未被覆盖')
  })
})
