export const QUEST_CATEGORIES = ['rest', 'tidy', 'observe', 'move', 'create', 'learn', 'connect', 'kind', 'digital', 'adventure'] as const
export const TIME_COSTS = [5, 10, 15, 20] as const
export const ENERGY_LEVELS = [1, 2, 3] as const
export const ENVIRONMENTS = ['indoor', 'outdoor'] as const
export const SOCIAL_LEVELS = ['solo', 'optional', 'required'] as const
export const TIMES_OF_DAY = ['day', 'night'] as const
export const LOCATIONS = ['any-safe-place', 'familiar-indoor', 'familiar-public-area'] as const
export const DIFFICULTIES = ['tiny', 'light', 'standard', 'brave'] as const

export type QuestCategory = typeof QUEST_CATEGORIES[number]
export type TimeCost = typeof TIME_COSTS[number]
export type EnergyLevel = typeof ENERGY_LEVELS[number]
export type Environment = typeof ENVIRONMENTS[number]
export type SocialLevel = typeof SOCIAL_LEVELS[number]
export type TimeOfDay = typeof TIMES_OF_DAY[number]
export type LocationCondition = typeof LOCATIONS[number]
export type QuestDifficulty = typeof DIFFICULTIES[number]
export type MatchStage = 'exact' | 'goal-relaxed' | 'energy-relaxed' | 'recent-relaxed' | 'safe-fallback'

export type QuestPreference = {
  minutes: TimeCost
  energy: EnergyLevel
  environment: Environment
  social: 'none' | 'optional'
  spend: 'none' | 'allowed'
  timeOfDay: TimeOfDay
  location: LocationCondition
  goalId: string
  excludedConditions: string[]
}

export type Quest = {
  questId: string
  title: string
  description: string
  category: QuestCategory
  timeCost: TimeCost
  energyLevel: EnergyLevel
  locationCondition: LocationCondition
  environments: Environment[]
  socialLevel: SocialLevel
  costRequired: boolean
  maxCost: number
  difficulty: QuestDifficulty
  xp: number
  goalIds: string[]
  times: TimeOfDay[]
  steps: string[]
  completionMethod: string
  abandonRule: string
  cooldownDays: number
  recentRepeatTag: string
  safetyTags: string[]
  inapplicableConditions: string[]
  acceptText: string
  completionText: string
  abandonText: string
  shareText: string
  iconAssetId: string
  relatedBadgeIds: string[]
  approved: boolean
  contentVersion: string
}

export type BadgeRule =
  | { type: 'completed-count'; count: number }
  | { type: 'streak'; days: number }
  | { type: 'level'; level: number }
  | { type: 'category-count'; category: QuestCategory; count: number }

export type BadgeDefinition = { id: string; title: string; description: string; rule: BadgeRule; assetId: string; contentVersion: string }
export type QuestCategoryDefinition = { id: QuestCategory; name: string; goalIds: string[]; assetId: string }
export type GoalDefinition = { id: string; name: string }

export type EarthOnlineContent = {
  schemaVersion: number
  contentVersion: string
  projectId: 'earth-online'
  meta: { title: string; locale: 'zh-CN'; updatedAt: string }
  sources: { id: string; title: string; license: string }[]
  content: {
    categories: QuestCategoryDefinition[]
    goals: GoalDefinition[]
    badges: BadgeDefinition[]
    tasks: Quest[]
    filters: { id: string; values: string[] }[]
    cooldown: { recentOfferLimit: number; historyLimit: number }
    fallback: { categoryIds: QuestCategory[] }
    safetyRules: { id: string; description: string; neverRelax: boolean }[]
  }
}

export type ValidationIssue = { path: string; message: string }
export type ValidationResult = { ok: boolean; issues: ValidationIssue[] }

export type StreakState = { current: number; best: number; lastCompletionDate?: string }
export type ActiveQuest = { acceptanceId: string; questId: string; acceptedAt: string; preference: QuestPreference }
export type CompletedQuest = { acceptanceId: string; questId: string; acceptedAt: string; completedAt: string; completionDate: string; xpAwarded: number }
export type QuestHistoryEntry = { acceptanceId: string; questId: string; status: 'completed' | 'abandoned' | 'swapped'; occurredAt: string; xpAwarded: number; completionDate?: string; category?: QuestCategory }
export type AdventurerProfile = { xp: number; streak: StreakState; unlockedBadgeIds: string[] }
export type StoragePayload = { preference: QuestPreference; offeredQuestId?: string; activeQuest?: ActiveQuest; recentQuestIds: string[]; completedQuestIds: string[]; history: QuestHistoryEntry[]; xp: number; streak: StreakState; unlockedBadgeIds: string[]; rngState: number }
export type QuestMatch = { kind: 'match'; quest: Quest; score: number; stage: MatchStage; reasons: string[]; relaxed: string[]; nextSeed: number }
export type NoMatch = { kind: 'no-match'; reasons: string[]; neverRelaxed: string[] }
