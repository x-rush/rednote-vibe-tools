import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { EarthOnlineContent, QuestArchiveContent } from '../content/schema'
import { STORAGE_KEY } from '../storage/storage'
import { prepareRuntime } from './bootstrap'

const fullContent = rawContent as unknown as EarthOnlineContent
const archive: QuestArchiveContent = {
  retiredTasks: fullContent.content.retiredTasks,
  legacyTasks: fullContent.content.legacyTasks,
}

describe('runtime content bootstrap', () => {
  it('does not load the archive for empty or current v2 storage', async () => {
    const currentQuest = fullContent.content.tasks[0]
    let calls = 0
    const loader = async () => { calls += 1; return archive }
    const empty = await prepareRuntime(memoryStorage(), loader)
    const current = await prepareRuntime(memoryStorage(JSON.stringify(envelope(2, {
      activeQuest: { questId: currentQuest.questId, questContentVersion: currentQuest.contentVersion },
      completedQuestIds: [],
    }))), loader)

    expect(empty.status).toBe('ready')
    expect(current.status).toBe('ready')
    expect(empty.catalog.retired).toHaveLength(0)
    expect(calls).toBe(0)
  })

  it('loads the archive for v1 storage and resolves the original definition', async () => {
    const classic = fullContent.content.legacyTasks[0]
    let calls = 0
    const runtime = await prepareRuntime(memoryStorage(JSON.stringify(envelope(1, {}))), async () => {
      calls += 1
      return archive
    })

    expect(runtime.status).toBe('ready')
    expect(calls).toBe(1)
    expect(runtime.catalog.resolve(classic.questId, classic.contentVersion)).toMatchObject({
      title: classic.title,
      xp: classic.xp,
    })
  })

  it('returns a recoverable archive error without changing persisted storage', async () => {
    const persisted = JSON.stringify(envelope(1, {}))
    const storage = memoryStorage(persisted)
    const before = storage.getItem(STORAGE_KEY)
    const runtime = await prepareRuntime(storage, async () => { throw new Error('chunk unavailable') })

    expect(runtime.status).toBe('archive-error')
    expect(runtime.catalog.retired).toHaveLength(0)
    expect(storage.getItem(STORAGE_KEY)).toBe(before)
  })
})

function envelope(schemaVersion: number, data: Record<string, unknown>) {
  return { schemaVersion, contentVersion: schemaVersion === 1 ? '1.0.0' : fullContent.contentVersion, updatedAt: '2026-08-29T00:00:00.000Z', data }
}

function memoryStorage(initial: string | null = null): Pick<Storage, 'getItem'> {
  return { getItem: (key) => key === STORAGE_KEY ? initial : null }
}
