import { describe, expect, it } from 'vitest'
import { createIndexedDbAdventureLog, createMemoryAdventureLog } from './adventure-log'

describe('adventure log repository', () => {
  it('provides observable append, list, feedback, and clear behavior in fallback memory storage', async () => {
    const repository = createMemoryAdventureLog()
    await repository.append({ acceptanceId: 'accept-1', questId: 'quest-rest-window-color', questTitle: '把休息两分钟命名为「王国停战协议」', questContentVersion: '1.0.0', questCategory: 'rest', questDifficulty: 'tiny', status: 'completed', occurredAt: '2026-08-24T08:00:00.000Z', completionDate: '2026-08-24', xpAwarded: 20 })
    await repository.recordFeedback({ questId: 'quest-rest-window-color', category: 'rest', reason: 'environment', updatedAt: '2026-08-24T09:00:00.000Z' })
    expect(await repository.list()).toHaveLength(1)
    expect(await repository.listFeedback()).toEqual([{ questId: 'quest-rest-window-color', category: 'rest', reason: 'environment', active: true, updatedAt: '2026-08-24T09:00:00.000Z' }])
    await repository.undoFeedback('quest-rest-window-color', '2026-08-24T09:05:00.000Z')
    expect(await repository.listFeedback()).toEqual([{ questId: 'quest-rest-window-color', category: 'rest', reason: 'environment', active: false, updatedAt: '2026-08-24T09:05:00.000Z' }])
    await repository.clear()
    expect(await repository.list()).toEqual([])
  })

  it('reports IndexedDB unavailability instead of hanging', async () => {
    const unavailable = { open: () => { throw new Error('blocked') } } as unknown as IDBFactory
    await expect(createIndexedDbAdventureLog(unavailable).list()).rejects.toMatchObject({ code: 'storage-unavailable' })
  })

  it('opens IndexedDB lazily only when a repository operation needs it', async () => {
    let opens = 0
    const unavailable = { open: () => { opens += 1; throw new Error('blocked') } } as unknown as IDBFactory
    const repository = createIndexedDbAdventureLog(unavailable)
    expect(opens).toBe(0)
    await expect(repository.list()).rejects.toMatchObject({ code: 'storage-unavailable' })
    expect(opens).toBe(1)
  })
})
