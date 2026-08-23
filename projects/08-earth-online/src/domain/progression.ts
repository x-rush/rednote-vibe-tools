import type { AdventurerProfile, BadgeDefinition, QuestCategory, QuestHistoryEntry, StreakState } from '../content/schema'

export type LevelProgress = { level: number; levelStartXp: number; nextLevelXp: number; xpIntoLevel: number; xpToNextLevel: number }
export type ProgressSummary = { completedCount: number; level: number; streak: number; categoryCounts: Partial<Record<QuestCategory, number>> }
export type AdventurerProfileViewModel = LevelProgress & { xp: number; streak: StreakState; unlockedBadges: BadgeDefinition[]; completedCount: number }

export function levelFromXp(value: number): LevelProgress {
  const xp = Math.max(0, Math.floor(value))
  let level = 1
  while (xp >= thresholdForLevel(level + 1)) level += 1
  const levelStartXp = thresholdForLevel(level)
  const nextLevelXp = thresholdForLevel(level + 1)
  return { level, levelStartXp, nextLevelXp, xpIntoLevel: xp - levelStartXp, xpToNextLevel: nextLevelXp - xp }
}

export function updateStreak(streak: StreakState, completionDate: string): StreakState {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(completionDate) || Number.isNaN(Date.parse(`${completionDate}T00:00:00Z`))) return streak
  if (!streak.lastCompletionDate) return { current: 1, best: Math.max(1, streak.best), lastCompletionDate: completionDate }
  const difference = calendarDifference(streak.lastCompletionDate, completionDate)
  if (difference <= 0) return streak
  const current = difference === 1 ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastCompletionDate: completionDate }
}

export function unlockedBadges(definitions: BadgeDefinition[], summary: ProgressSummary, currentIds: string[]): string[] {
  const result = new Set(currentIds)
  for (const badge of definitions) if (matchesRule(badge, summary)) result.add(badge.id)
  return [...result]
}

export function createProfileViewModel(profile: AdventurerProfile, definitions: BadgeDefinition[], history: QuestHistoryEntry[]): AdventurerProfileViewModel {
  const progress = levelFromXp(profile.xp)
  return { ...progress, xp: profile.xp, streak: profile.streak, unlockedBadges: definitions.filter(({ id }) => profile.unlockedBadgeIds.includes(id)), completedCount: history.filter(({ status }) => status === 'completed').length }
}

function matchesRule(badge: BadgeDefinition, summary: ProgressSummary): boolean {
  switch (badge.rule.type) {
    case 'completed-count': return summary.completedCount >= badge.rule.count
    case 'streak': return summary.streak >= badge.rule.days
    case 'level': return summary.level >= badge.rule.level
    case 'category-count': return (summary.categoryCounts[badge.rule.category] ?? 0) >= badge.rule.count
  }
}

function thresholdForLevel(level: number): number { return 100 * (level - 1) * level / 2 }
function calendarDifference(from: string, to: string): number { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) }
