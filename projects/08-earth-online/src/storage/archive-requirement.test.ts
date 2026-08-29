import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { EarthOnlineContent } from '../content/schema'
import { STORAGE_KEY } from './storage'
import { storageNeedsArchive } from './archive-requirement'

const content = rawContent as unknown as EarthOnlineContent
const active = content.content.tasks[0]
const activeById = new Map(content.content.tasks.map((quest) => [quest.questId, quest]))

describe('archive requirement inspector', () => {
  it('loads the archive only for storage that can reference classic quest definitions', () => {
    expect(storageNeedsArchive(memoryStorage(), activeById)).toBe(false)
    expect(storageNeedsArchive(memoryStorage('{'), activeById)).toBe(false)
    expect(storageNeedsArchive(memoryStorage(envelope(1, {})), activeById)).toBe(true)
    expect(storageNeedsArchive(memoryStorage(envelope(99, {})), activeById)).toBe(false)
    expect(storageNeedsArchive(memoryStorage(envelope(2, {
      activeQuest: { questId: active.questId, questContentVersion: active.contentVersion },
      completedQuestIds: [],
    })), activeById)).toBe(false)
    expect(storageNeedsArchive(memoryStorage(envelope(2, {
      activeQuest: { questId: active.questId, questContentVersion: '1.0.0' },
      completedQuestIds: [],
    })), activeById)).toBe(true)
    expect(storageNeedsArchive(memoryStorage(envelope(2, {
      completedQuestIds: ['quest-retired-id'],
    })), activeById)).toBe(true)
  })

  it('does not treat self-contained v2 history snapshots as an archive dependency', () => {
    const value = envelope(2, {
      completedQuestIds: [active.questId],
      history: [{ questId: 'quest-retired-id', questContentVersion: '1.0.0', questTitle: '旧任务快照' }],
    })
    expect(storageNeedsArchive(memoryStorage(value), activeById)).toBe(false)
  })

  it('only reads storage and leaves its original value unchanged', () => {
    const raw = JSON.stringify(envelope(1, {}))
    let stored = raw
    const storage = { getItem: (key: string) => key === STORAGE_KEY ? stored : null }

    expect(storageNeedsArchive(storage, activeById)).toBe(true)
    expect(stored).toBe(raw)
  })
})

function envelope(schemaVersion: number, data: Record<string, unknown>) {
  return { schemaVersion, contentVersion: schemaVersion === 1 ? '1.0.0' : content.contentVersion, updatedAt: '2026-08-29T00:00:00.000Z', data }
}

function memoryStorage(value?: unknown): Pick<Storage, 'getItem'> {
  const raw = value === undefined ? null : typeof value === 'string' ? value : JSON.stringify(value)
  return { getItem: (key) => key === STORAGE_KEY ? raw : null }
}
