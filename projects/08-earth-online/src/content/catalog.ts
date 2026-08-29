import type { EarthOnlineContent, Quest, QuestSnapshot } from './schema'

export type QuestCatalog = {
  active: readonly Quest[]
  retired: readonly Quest[]
  legacy: readonly Quest[]
  activeById: ReadonlyMap<string, Quest>
  retiredById: ReadonlyMap<string, Quest>
  allById: ReadonlyMap<string, Quest>
  resolve: (questId: string, contentVersion?: string) => Quest | undefined
  isRetired: (questId: string) => boolean
  isClassic: (questId: string, contentVersion: string) => boolean
}

export function createQuestCatalog(content: EarthOnlineContent): QuestCatalog {
  const active = content.content.tasks
  const retired = content.content.retiredTasks
  const legacy = content.content.legacyTasks
  const activeById = new Map(active.map((quest) => [quest.questId, quest]))
  const retiredById = new Map(retired.map((quest) => [quest.questId, quest]))
  const allById = new Map([...activeById, ...retiredById])
  const byVersion = new Map([...active, ...retired, ...legacy].map((quest) => [`${quest.questId}@${quest.contentVersion}`, quest]))
  return {
    active,
    retired,
    legacy,
    activeById,
    retiredById,
    allById,
    resolve: (questId, contentVersion) => contentVersion ? byVersion.get(`${questId}@${contentVersion}`) : allById.get(questId),
    isRetired: (questId) => retiredById.has(questId),
    isClassic: (questId, contentVersion) => byVersion.has(`${questId}@${contentVersion}`) && activeById.get(questId)?.contentVersion !== contentVersion,
  }
}

export function snapshotQuest(quest: Quest): QuestSnapshot {
  return {
    questTitle: quest.title,
    questContentVersion: quest.contentVersion,
    questCategory: quest.category,
    questDifficulty: quest.difficulty,
  }
}
