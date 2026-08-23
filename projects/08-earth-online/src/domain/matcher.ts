import type { CompletedQuest, MatchStage, NoMatch, Quest, QuestHistoryEntry, QuestMatch, QuestPreference } from '../content/schema'
import { hashSeed, nextRandom } from './random'

export type MatchContext = {
  seed: string | number
  nowDate: string
  recentQuestIds: string[]
  completed: CompletedQuest[]
  abandoned: QuestHistoryEntry[]
  previousCategoryIds: Quest['category'][]
}

const requiredSafety = ['no-purchase', 'no-photo-required', 'no-personal-data']

export function matchQuest(quests: Quest[], preference: QuestPreference, context: MatchContext): QuestMatch | NoMatch {
  const hardPool = quests.filter((quest) => passesHardConditions(quest, preference))
  if (hardPool.length === 0) return noMatch()

  const recent = new Set(context.recentQuestIds.slice(-3))
  const abandoned = new Set(context.abandoned.filter((entry) => daysBetween(entry.occurredAt.slice(0, 10), context.nowDate) <= 7).map((entry) => entry.questId))
  const cooling = new Set(context.completed.filter((entry) => {
    const quest = quests.find(({ questId }) => questId === entry.questId)
    return quest !== undefined && daysBetween(entry.completionDate, context.nowDate) < quest.cooldownDays
  }).map((entry) => entry.questId))
  const clean = (quest: Quest) => !recent.has(quest.questId) && !abandoned.has(quest.questId) && !cooling.has(quest.questId)

  const stages: { stage: MatchStage; candidates: Quest[]; relaxed: string[]; reasons: string[] }[] = [
    { stage: 'exact', candidates: hardPool.filter((quest) => clean(quest) && quest.energyLevel === preference.energy && quest.goalIds.includes(preference.goalId)), relaxed: [], reasons: ['时间、精力、地点和目标都正合适。'] },
    { stage: 'goal-relaxed', candidates: hardPool.filter((quest) => clean(quest) && quest.energyLevel === preference.energy), relaxed: ['目标类型'], reasons: ['暂时放宽目标类型，其他硬条件保持不变。'] },
    { stage: 'energy-relaxed', candidates: hardPool.filter(clean), relaxed: ['精力贴合度'], reasons: ['选择了不超过当前精力的更轻任务。'] },
    { stage: 'recent-relaxed', candidates: hardPool.filter((quest) => !cooling.has(quest.questId)), relaxed: ['近期展示与放弃记录'], reasons: ['安全候选较少，按最旧优先放宽近期去重。'] },
    { stage: 'safe-fallback', candidates: hardPool, relaxed: ['目标类型', '精力贴合度', '近期展示与放弃记录', '完成冷却'], reasons: ['进入低压力安全回退池，全部硬条件仍然有效。'] },
  ]
  const selectedStage = stages.find(({ candidates }) => candidates.length > 0)
  if (!selectedStage) return noMatch()

  const ranked = selectedStage.candidates.map((quest) => ({ quest, score: scoreQuest(quest, preference, context, recent, abandoned, cooling) }))
  const bestScore = Math.max(...ranked.map(({ score }) => score))
  const best = ranked.filter(({ score }) => score === bestScore).sort((left, right) => left.quest.questId.localeCompare(right.quest.questId))
  const random = nextRandom(hashSeed(context.seed))
  const chosen = best[Math.floor(random.value * best.length)]
  return { kind: 'match', quest: chosen.quest, score: chosen.score, stage: selectedStage.stage, reasons: [...selectedStage.reasons, ...positiveReasons(chosen.quest, preference)], relaxed: selectedStage.relaxed, nextSeed: random.state }
}

function passesHardConditions(quest: Quest, preference: QuestPreference): boolean {
  if (!quest.approved || requiredSafety.some((tag) => !quest.safetyTags.includes(tag))) return false
  if (quest.timeCost > preference.minutes || quest.energyLevel > preference.energy) return false
  if (!quest.environments.includes(preference.environment) || !quest.times.includes(preference.timeOfDay)) return false
  if (preference.environment === 'outdoor' && preference.timeOfDay === 'night' && quest.safetyTags.includes('daylight-only')) return false
  if (quest.locationCondition !== 'any-safe-place' && quest.locationCondition !== preference.location) return false
  if (preference.social === 'none' && quest.socialLevel !== 'solo') return false
  if (preference.spend === 'none' && quest.maxCost > 0) return false
  if (preference.excludedConditions.some((condition) => quest.inapplicableConditions.includes(condition))) return false
  return true
}

function scoreQuest(quest: Quest, preference: QuestPreference, context: MatchContext, recent: Set<string>, abandoned: Set<string>, cooling: Set<string>): number {
  let score = 0
  if (quest.goalIds.includes(preference.goalId)) score += 40
  if (quest.energyLevel === preference.energy) score += 20
  if (quest.timeCost === preference.minutes) score += 10
  if (!recent.has(quest.questId)) score += 30
  if (abandoned.has(quest.questId)) score -= 25
  if (cooling.has(quest.questId)) score -= 35
  if (context.previousCategoryIds.at(-1) === quest.category) score -= 10
  return score
}

function positiveReasons(quest: Quest, preference: QuestPreference): string[] {
  const reasons = [`可在${quest.timeCost}分钟内完成`, quest.socialLevel === 'solo' ? '无需他人配合' : '只与熟悉的人自愿互动']
  if (quest.goalIds.includes(preference.goalId)) reasons.unshift('符合你现在想做的事')
  return reasons
}

function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function noMatch(): NoMatch {
  return { kind: 'no-match', reasons: ['没有任务能同时满足当前全部硬条件。'], neverRelaxed: ['安全', '时间', '地点', '预算', '社交意愿'] }
}
