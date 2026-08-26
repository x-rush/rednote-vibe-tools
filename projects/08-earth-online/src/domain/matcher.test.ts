import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { EarthOnlineContent, Quest, QuestPreference } from '../content/schema'
import { matchQuest } from './matcher'

const quests = (rawContent as unknown as EarthOnlineContent).content.tasks
const matchingCopy = (rawContent as unknown as EarthOnlineContent).content.ui.matching
const basePreference: QuestPreference = { minutes: 10, energy: 1, environment: 'indoor', social: 'none', spend: 'none', timeOfDay: 'day', location: 'familiar-indoor', goalId: 'relax', excludedConditions: [] }
const emptyContext = { seed: 'golden-seed', nowDate: '2026-08-24', recentQuestIds: [], completed: [], abandoned: [], previousCategoryIds: [], softAvoidCategoryIds: [], copy: matchingCopy }

describe('quest matcher', () => {
  it('is reproducible for the same seed and inputs', () => {
    const first = matchQuest(quests, basePreference, emptyContext)
    const second = matchQuest([...quests].reverse(), basePreference, emptyContext)
    expect(first.kind).toBe('match')
    expect(second).toEqual(first)
  })

  it('can select a nearby-score candidate instead of locking to exact top-score ties', () => {
    const exactTop = withQuest(quests[0], { questId: 'quest-a-exact-top', timeCost: 10, energyLevel: 1, goalIds: ['relax'] })
    const nearby = withQuest(quests[1], { questId: 'quest-z-nearby', timeCost: 5, energyLevel: 1, goalIds: ['relax'] })
    const result = matchQuest([exactTop, nearby], basePreference, { ...emptyContext, seed: 0x12345678 })

    expect(result.kind === 'match' && result.quest.questId).toBe('quest-z-nearby')
  })

  it('never breaks time, energy, environment, social, cost, time-of-day, or safety conditions', () => {
    const preference: QuestPreference = { ...basePreference, minutes: 5, environment: 'outdoor', location: 'familiar-public-area', social: 'none', timeOfDay: 'day' }
    const result = matchQuest(quests, preference, emptyContext)
    expect(result.kind).toBe('match')
    if (result.kind !== 'match') return
    expect(result.quest.timeCost).toBeLessThanOrEqual(5)
    expect(result.quest.energyLevel).toBeLessThanOrEqual(1)
    expect(result.quest.environments).toContain('outdoor')
    expect(result.quest.socialLevel).toBe('solo')
    expect(result.quest.maxCost).toBe(0)
    expect(result.quest.times).toContain('day')
    expect(result.quest.approved).toBe(true)
  })

  it('returns no match instead of relaxing safety', () => {
    const dangerous = { ...quests[0], questId: 'quest-unsafe-test', safetyTags: [], approved: false }
    const result = matchQuest([dangerous], basePreference, emptyContext)
    expect(result).toEqual({ kind: 'no-match', reasons: ['没有任务能同时满足当前全部硬条件。'], neverRelaxed: ['安全', '时间', '地点', '预算', '社交意愿'] })
  })

  it('excludes recently offered quests while clean candidates exist', () => {
    const pool = quests.filter((quest) => quest.category === 'rest').slice(0, 2)
    const first = matchQuest(pool, basePreference, { ...emptyContext, seed: 1 })
    expect(first.kind).toBe('match')
    if (first.kind !== 'match') return
    const next = matchQuest(pool, basePreference, { ...emptyContext, seed: 1, recentQuestIds: [first.quest.questId] })
    expect(next.kind).toBe('match')
    if (next.kind === 'match') expect(next.quest.questId).not.toBe(first.quest.questId)
  })

  it('relaxes goal, then energy closeness, then recency with explanations', () => {
    const goalRelaxed = matchQuest([withQuest(quests[10], { energyLevel: 1, goalIds: ['organize'] })], basePreference, emptyContext)
    expect(goalRelaxed.kind === 'match' && goalRelaxed.stage).toBe('goal-relaxed')
    expect(goalRelaxed.kind === 'match' && goalRelaxed.relaxed).toContain('目标类型')

    const energyPreference = { ...basePreference, energy: 2 as const }
    const energyRelaxed = matchQuest([withQuest(quests[0], { energyLevel: 1, goalIds: ['relax'] })], energyPreference, emptyContext)
    expect(energyRelaxed.kind === 'match' && energyRelaxed.stage).toBe('energy-relaxed')

    const recentQuest = withQuest(quests[0], { energyLevel: 1, goalIds: ['relax'] })
    const recentRelaxed = matchQuest([recentQuest], basePreference, { ...emptyContext, recentQuestIds: [recentQuest.questId] })
    expect(recentRelaxed.kind === 'match' && recentRelaxed.stage).toBe('recent-relaxed')
    expect(recentRelaxed.kind === 'match' && recentRelaxed.reasons.join('')).toContain('近期')
  })

  it('uses safe fallback only after completed cooldown exhausts earlier stages', () => {
    const only = withQuest(quests[0], { energyLevel: 1, goalIds: ['relax'], cooldownDays: 7 })
    const result = matchQuest([only], basePreference, { ...emptyContext, completed: [{ acceptanceId: 'accept-1', questId: only.questId, acceptedAt: '2026-08-23T00:00:00.000Z', completedAt: '2026-08-23T00:05:00.000Z', completionDate: '2026-08-23', xpAwarded: 20 }] })
    expect(result.kind === 'match' && result.stage).toBe('safe-fallback')
    expect(result.kind === 'match' && result.relaxed).toContain('完成冷却')
  })

  it('lowers a reversible category preference without removing its only safe quest', () => {
    const avoided = withQuest(quests[0], { questId: 'quest-a-avoided', category: 'rest', goalIds: ['relax'] })
    const preferred = withQuest(quests[10], { questId: 'quest-z-preferred', category: 'tidy', goalIds: ['relax'], timeCost: avoided.timeCost, energyLevel: avoided.energyLevel })
    const withChoice = matchQuest([avoided, preferred], basePreference, { ...emptyContext, seed: 'soft-test', softAvoidCategoryIds: ['rest'] })
    expect(withChoice.kind === 'match' && withChoice.quest.questId).toBe('quest-z-preferred')
    const onlyAvoided = matchQuest([avoided], basePreference, { ...emptyContext, softAvoidCategoryIds: ['rest'] })
    expect(onlyAvoided.kind === 'match' && onlyAvoided.quest.questId).toBe('quest-a-avoided')
  })
})

function withQuest(quest: Quest, patch: Partial<Quest>): Quest { return { ...quest, ...patch } }
