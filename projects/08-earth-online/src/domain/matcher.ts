import type { CompletedQuest, MatchStage, NoMatch, Quest, QuestHistoryEntry, QuestMatch, QuestPreference, UiContent } from '../content/schema'
import { hashSeed, nextRandom } from './random'

export type MatchContext = {
  seed: string | number
  nowDate: string
  recentQuestIds: string[]
  completed: CompletedQuest[]
  abandoned: QuestHistoryEntry[]
  previousCategoryIds: Quest['category'][]
  softAvoidCategoryIds: Quest['category'][]
  copy: UiContent['matching']
}

const requiredSafety = ['no-purchase', 'no-photo-required', 'no-personal-data']
const qualityBand = 15

export function matchQuest(quests: Quest[], preference: QuestPreference, context: MatchContext): QuestMatch | NoMatch {
  const hardPool = quests.filter((quest) => passesHardConditions(quest, preference))
  if (hardPool.length === 0) return noMatch(context.copy)

  const recent = new Set(context.recentQuestIds.slice(-3))
  const abandoned = new Set(context.abandoned.filter((entry) => daysBetween(entry.occurredAt.slice(0, 10), context.nowDate) <= 7).map((entry) => entry.questId))
  const cooling = new Set(context.completed.filter((entry) => {
    const quest = quests.find(({ questId }) => questId === entry.questId)
    return quest !== undefined && daysBetween(entry.completionDate, context.nowDate) < quest.cooldownDays
  }).map((entry) => entry.questId))
  const clean = (quest: Quest) => !recent.has(quest.questId) && !abandoned.has(quest.questId) && !cooling.has(quest.questId)

  const stages: { stage: MatchStage; candidates: Quest[]; relaxed: string[]; reasons: string[] }[] = [
    stage('exact', hardPool.filter((quest) => clean(quest) && quest.energyLevel === preference.energy && quest.goalIds.includes(preference.goalId)), context.copy),
    stage('goal-relaxed', hardPool.filter((quest) => clean(quest) && quest.energyLevel === preference.energy), context.copy),
    stage('energy-relaxed', hardPool.filter(clean), context.copy),
    stage('recent-relaxed', hardPool.filter((quest) => !cooling.has(quest.questId)), context.copy),
    stage('safe-fallback', hardPool, context.copy),
  ]
  const selectedStage = stages.find(({ candidates }) => candidates.length > 0)
  if (!selectedStage) return noMatch(context.copy)

  const ranked = selectedStage.candidates.map((quest) => ({ quest, score: scoreQuest(quest, preference, context, recent, abandoned, cooling) }))
  const bestScore = Math.max(...ranked.map(({ score }) => score))
  const qualityPool = ranked.filter(({ score }) => score >= bestScore - qualityBand).sort((left, right) => left.quest.questId.localeCompare(right.quest.questId))
  const random = nextRandom(hashSeed(context.seed))
  const chosen = chooseWeighted(qualityPool, bestScore, random.value)
  return { kind: 'match', quest: chosen.quest, score: chosen.score, stage: selectedStage.stage, reasons: [...selectedStage.reasons, ...positiveReasons(chosen.quest, preference, context.copy)], relaxed: selectedStage.relaxed, nextSeed: random.state }
}

function chooseWeighted<T extends { score: number }>(candidates: T[], bestScore: number, randomValue: number): T {
  const weighted = candidates.map((candidate) => ({ candidate, weight: qualityBand + 1 - (bestScore - candidate.score) }))
  let cursor = randomValue * weighted.reduce((sum, { weight }) => sum + weight, 0)
  for (const { candidate, weight } of weighted) {
    cursor -= weight
    if (cursor < 0) return candidate
  }
  return weighted.at(-1)!.candidate
}

function stage(stageId: MatchStage, candidates: Quest[], copy: UiContent['matching']) { return { stage: stageId, candidates, relaxed: copy.stages[stageId].relaxed, reasons: [copy.stages[stageId].reason] } }

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
  if (context.softAvoidCategoryIds.includes(quest.category)) score -= 15
  return score
}

function positiveReasons(quest: Quest, preference: QuestPreference, copy: UiContent['matching']): string[] {
  const reasons = [copy.positive.time.replace('{minutes}', String(quest.timeCost)), quest.socialLevel === 'solo' ? copy.positive.solo : copy.positive.optional]
  if (quest.goalIds.includes(preference.goalId)) reasons.unshift(copy.positive.goal)
  return reasons
}

function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function noMatch(copy: UiContent['matching']): NoMatch {
  return { kind: 'no-match', reasons: [copy.noMatch.reason], neverRelaxed: copy.noMatch.neverRelaxed }
}
