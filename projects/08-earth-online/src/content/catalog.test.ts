import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import type { EarthOnlineContent, Quest } from './schema'
import { createQuestCatalog, snapshotQuest } from './catalog'

const original = rawContent as unknown as EarthOnlineContent
const retired = original.content.tasks[0]
const content: EarthOnlineContent = {
  ...original,
  content: {
    ...original.content,
    tasks: original.content.tasks.slice(1),
    retiredTasks: [retired],
  },
}

describe('versioned quest catalog', () => {
  it('resolves retained v1 and v2 definitions by both ID and content version', () => {
    const versionedContent = original as EarthOnlineContent & { content: { legacyTasks: Quest[] } }
    expect(versionedContent.content.legacyTasks).toHaveLength(160)
    const legacyQuest = versionedContent.content.legacyTasks.find(({ questId, xp }) => original.content.tasks.some((quest) => quest.questId === questId && quest.xp !== xp))
    const fallbackLegacy = versionedContent.content.legacyTasks.find(({ questId }) => questId === 'quest-rest-name-enough')
    const archived = legacyQuest ?? fallbackLegacy
    expect(archived).toBeDefined()
    if (!archived) return
    const current = original.content.tasks.find(({ questId }) => questId === archived.questId)
    const catalog = createQuestCatalog(original)

    expect(catalog.resolve(archived.questId, archived.contentVersion)).toBe(archived)
    expect(catalog.resolve(archived.questId, current?.contentVersion)).toBe(current)
    expect(catalog.isClassic(archived.questId, archived.contentVersion)).toBe(true)

    const archivedV2 = versionedContent.content.legacyTasks.find(({ contentVersion }) => contentVersion === '2.0.0')
    expect(archivedV2).toBeDefined()
    if (!archivedV2) return
    expect(catalog.resolve(archivedV2.questId, '2.0.0')).toBe(archivedV2)
    expect(catalog.resolve(archivedV2.questId, '3.0.0')).toBe(original.content.tasks.find(({ questId }) => questId === archivedV2.questId))
    expect(catalog.isClassic(archivedV2.questId, '2.0.0')).toBe(true)
  })

  it('keeps retired quests available without exposing them as active', () => {
    const active = content.content.tasks[0]
    const retiredQuest = content.content.retiredTasks[0]
    const catalog = createQuestCatalog(content)

    expect(catalog.activeById.get(active.questId)).toBe(active)
    expect(catalog.activeById.has(retiredQuest.questId)).toBe(false)
    expect(catalog.retiredById.get(retiredQuest.questId)).toBe(retiredQuest)
    expect(catalog.resolve(retiredQuest.questId)).toBe(retiredQuest)
    expect(catalog.isRetired(retiredQuest.questId)).toBe(true)
  })

  it('takes an authored snapshot that does not change with future catalog copy', () => {
    const quest = content.content.tasks[0] as Quest
    const snapshot = snapshotQuest(quest)
    const revised = { ...quest, title: '未来版本标题', contentVersion: '9.0.0' }

    expect(snapshot).toEqual({
      questTitle: quest.title,
      questContentVersion: quest.contentVersion,
      questCategory: quest.category,
      questDifficulty: quest.difficulty,
    })
    expect(snapshot.questTitle).not.toBe(revised.title)
    expect(snapshot.questContentVersion).not.toBe(revised.contentVersion)
  })
})
