import { describe, expect, it } from 'vitest'
import { createIndexedDbAdventureLog, createMemoryAdventureLog } from './adventure-log'

describe('adventure log repository', () => {
  it('provides observable append, list, feedback, and clear behavior in fallback memory storage', async () => {
    const repository = createMemoryAdventureLog()
    await repository.append({ acceptanceId: 'accept-1', questId: 'quest-rest-window-color', status: 'completed', occurredAt: '2026-08-24T08:00:00.000Z', completionDate: '2026-08-24', xpAwarded: 20 })
    await repository.recordFeedback('quest-rest-window-color', 'abandoned', '2026-08-24T09:00:00.000Z')
    expect(await repository.list()).toHaveLength(1)
    expect(await repository.listFeedback()).toEqual([{ questId: 'quest-rest-window-color', unsuitableCount: 1, lastUnsuitableAt: '2026-08-24T09:00:00.000Z' }])
    await repository.clear()
    expect(await repository.list()).toEqual([])
  })

  it('reports IndexedDB unavailability instead of hanging', async () => {
    const unavailable = { open: () => { throw new Error('blocked') } } as unknown as IDBFactory
    await expect(createIndexedDbAdventureLog(unavailable).list()).rejects.toMatchObject({ code: 'storage-unavailable' })
  })
})
