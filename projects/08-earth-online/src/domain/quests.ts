import type { ActiveQuest, BadgeDefinition, Quest, QuestCategory, QuestHistoryEntry, QuestMatch, QuestPreference, StreakState } from '../content/schema'
import { levelFromXp, unlockedBadges, updateStreak } from './progression'

export type GuildDomainState = {
  preference: QuestPreference
  offeredQuestId?: string
  offeredAt?: string
  activeQuest?: ActiveQuest
  recentQuestIds: string[]
  completedQuestIds: string[]
  history: QuestHistoryEntry[]
  xp: number
  streak: StreakState
  unlockedBadgeIds: string[]
  rngState: number
  categoryCompletionCounts: Partial<Record<QuestCategory, number>>
}
export type CompletionResult = { state: GuildDomainState; awardedXp: number; newlyUnlockedBadgeIds: string[]; alreadyCompleted: boolean }
export type QuestHistorySummary = { total: number; completed: number; abandoned: number; swapped: number; earnedXp: number; entries: { questId: string; title: string; status: QuestHistoryEntry['status']; occurredAt: string }[] }

export function createGuildState(preference: QuestPreference, rngState: number): GuildDomainState {
  return { preference, recentQuestIds: [], completedQuestIds: [], history: [], xp: 0, streak: { current: 0, best: 0 }, unlockedBadgeIds: [], rngState, categoryCompletionCounts: {} }
}

export function offerQuest(state: GuildDomainState, match: QuestMatch, offeredAt: string): GuildDomainState {
  return { ...state, offeredQuestId: match.quest.questId, offeredAt, rngState: match.nextSeed, recentQuestIds: [...state.recentQuestIds, match.quest.questId].slice(-10) }
}

export function acceptQuest(state: GuildDomainState, acceptedAt: string): GuildDomainState {
  if (state.activeQuest || !state.offeredQuestId) return state
  const activeQuest = { acceptanceId: `${state.offeredQuestId}:${acceptedAt}:${state.rngState}`, questId: state.offeredQuestId, acceptedAt, preference: state.preference }
  return { ...state, activeQuest, offeredQuestId: undefined, offeredAt: undefined }
}

export function swapQuest(state: GuildDomainState, match: QuestMatch, swappedAt: string): GuildDomainState {
  if (!state.offeredQuestId) return offerQuest(state, match, swappedAt)
  const history = appendHistory(state.history, { acceptanceId: `offer:${state.offeredQuestId}:${swappedAt}`, questId: state.offeredQuestId, status: 'swapped', occurredAt: swappedAt, xpAwarded: 0 })
  return offerQuest({ ...state, history, offeredQuestId: undefined, offeredAt: undefined }, match, swappedAt)
}

export function abandonQuest(state: GuildDomainState, abandonedAt: string): GuildDomainState {
  if (!state.activeQuest) return state
  const entry: QuestHistoryEntry = { acceptanceId: state.activeQuest.acceptanceId, questId: state.activeQuest.questId, status: 'abandoned', occurredAt: abandonedAt, xpAwarded: 0 }
  return { ...state, activeQuest: undefined, history: appendHistory(state.history, entry) }
}

export function completeQuest(state: GuildDomainState, quest: Quest, badges: BadgeDefinition[], completedAt: string, completionDate: string): CompletionResult {
  if (!state.activeQuest || state.activeQuest.questId !== quest.questId || state.history.some(({ acceptanceId, status }) => acceptanceId === state.activeQuest?.acceptanceId && status === 'completed')) {
    return { state, awardedXp: 0, newlyUnlockedBadgeIds: [], alreadyCompleted: true }
  }
  const entry: QuestHistoryEntry = { acceptanceId: state.activeQuest.acceptanceId, questId: quest.questId, status: 'completed', occurredAt: completedAt, completionDate, xpAwarded: quest.xp, category: quest.category }
  const history = appendHistory(state.history, entry)
  const xp = state.xp + quest.xp
  const streak = updateStreak(state.streak, completionDate)
  const categoryCompletionCounts = { ...state.categoryCompletionCounts, [quest.category]: (state.categoryCompletionCounts[quest.category] ?? 0) + 1 }
  const nextBadgeIds = unlockedBadges(badges, { completedCount: history.filter(({ status }) => status === 'completed').length, level: levelFromXp(xp).level, streak: streak.current, categoryCounts: categoryCompletionCounts }, state.unlockedBadgeIds)
  const newlyUnlockedBadgeIds = nextBadgeIds.filter((id) => !state.unlockedBadgeIds.includes(id))
  const completedQuestIds = state.completedQuestIds.includes(quest.questId) ? state.completedQuestIds : [...state.completedQuestIds, quest.questId]
  return { state: { ...state, activeQuest: undefined, history, xp, streak, unlockedBadgeIds: nextBadgeIds, completedQuestIds, categoryCompletionCounts }, awardedXp: quest.xp, newlyUnlockedBadgeIds, alreadyCompleted: false }
}

export function summarizeHistory(history: QuestHistoryEntry[], questsById: ReadonlyMap<string, Quest>): QuestHistorySummary {
  return {
    total: history.length,
    completed: history.filter(({ status }) => status === 'completed').length,
    abandoned: history.filter(({ status }) => status === 'abandoned').length,
    swapped: history.filter(({ status }) => status === 'swapped').length,
    earnedXp: history.reduce((sum, { xpAwarded }) => sum + xpAwarded, 0),
    entries: history.map((entry) => ({ questId: entry.questId, title: questsById.get(entry.questId)?.title ?? '已下线任务', status: entry.status, occurredAt: entry.occurredAt })),
  }
}

function appendHistory(history: QuestHistoryEntry[], entry: QuestHistoryEntry): QuestHistoryEntry[] { return [...history, entry].slice(-100) }
