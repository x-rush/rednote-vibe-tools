import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { EarthOnlineContent, Quest, QuestPreference } from '../content/schema'
import { matchQuest } from './matcher'

const content = rawContent as unknown as EarthOnlineContent
const quests = content.content.tasks
const matchingCopy = content.content.ui.matching
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
    const results = Array.from({ length: 200 }, (_, seed) => matchQuest([exactTop, nearby], basePreference, { ...emptyContext, seed }))

    expect(results.some((result) => result.kind === 'match' && result.quest.questId === 'quest-z-nearby')).toBe(true)
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

  it('does not repeat across eight consecutive draws while fresh matches remain', () => {
    const pool = quests.slice(0, 9).map((quest, index) => matchingQuest(quest, {
      questId: `quest-diversity-${index}`,
      category: index % 2 === 0 ? 'rest' : 'observe',
    }))
    const recentQuestIds: string[] = []

    for (let draw = 0; draw < 8; draw += 1) {
      const result = matchQuest(pool, basePreference, { ...emptyContext, seed: draw, recentQuestIds })
      expect(result.kind).toBe('match')
      if (result.kind !== 'match') return
      expect(recentQuestIds).not.toContain(result.quest.questId)
      recentQuestIds.push(result.quest.questId)
    }

    expect(new Set(recentQuestIds)).toHaveLength(8)
  })

  it('keeps an offer from four draws ago inside the recent exclusion window', () => {
    const old = matchingQuest(quests[0], { questId: 'quest-a-four-draws-ago' })
    const fresh = matchingQuest(quests[1], { questId: 'quest-z-never-seen' })
    const recentQuestIds = [old.questId, 'dummy-1', 'dummy-2', 'dummy-3']

    for (let seed = 0; seed < 32; seed += 1) {
      const result = matchQuest([old, fresh], basePreference, { ...emptyContext, seed, recentQuestIds })
      expect(result.kind === 'match' && result.quest.questId).toBe(fresh.questId)
    }
  })

  it('prefers the oldest offer when recency must be relaxed', () => {
    const pool = quests.slice(0, 4).map((quest, index) => matchingQuest(quest, { questId: `quest-age-${index}` }))
    const recentQuestIds = pool.map(({ questId }) => questId)
    const result = matchQuest(pool, basePreference, { ...emptyContext, seed: 'age-test', recentQuestIds })

    expect(result.kind).toBe('match')
    if (result.kind === 'match') expect(result.quest.questId).toBe(recentQuestIds[0])
  })

  it('uses the latest position when the same quest appears twice in recent history', () => {
    const repeated = matchingQuest(quests[0], { questId: 'quest-repeated-latest' })
    const older = matchingQuest(quests[1], { questId: 'quest-actually-older' })
    const result = matchQuest([repeated, older], basePreference, {
      ...emptyContext,
      seed: 'duplicate-recency',
      recentQuestIds: [repeated.questId, 'dummy-1', older.questId, 'dummy-2', repeated.questId],
    })

    expect(result.kind).toBe('match')
    if (result.kind === 'match') expect(result.quest.questId).toBe(older.questId)
  })

  it('uses recent category fatigue to vary the kind of adventure', () => {
    const recent = quests.slice(0, 4).map((quest, index) => matchingQuest(quest, { questId: `quest-rest-${index}`, category: 'rest' }))
    const sameCategory = matchingQuest(quests[4], { questId: 'quest-same-category', category: 'rest' })
    const variedCategory = matchingQuest(quests[5], { questId: 'quest-varied-category', category: 'observe' })
    const result = matchQuest([...recent, sameCategory, variedCategory], basePreference, {
      ...emptyContext,
      seed: 'category-fatigue',
      recentQuestIds: recent.map(({ questId }) => questId),
    })

    expect(result.kind).toBe('match')
    if (result.kind === 'match') expect(result.quest.questId).toBe(variedCategory.questId)
  })

  it('explains when a recommendation is fresh and varies the recent category', () => {
    const recent = matchingQuest(quests[0], { questId: 'quest-recent-rest', category: 'rest' })
    const fresh = matchingQuest(quests[1], { questId: 'quest-fresh-observe', category: 'observe' })
    const result = matchQuest([recent, fresh], basePreference, {
      ...emptyContext,
      recentQuestIds: [recent.questId],
    })

    expect(result.kind).toBe('match')
    if (result.kind !== 'match') return
    expect(result.reasons).toContain('这项支线近期没有出现过')
    expect(result.reasons).toContain('这次换了一类冒险体验')
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

  it('matches a 20-minute E3 indoor exploration quest without relaxing energy', () => {
    const preference: QuestPreference = { ...basePreference, minutes: 20, energy: 3, goalId: 'explore' }
    const result = matchQuest(quests, preference, emptyContext)
    expect(result.kind).toBe('match')
    if (result.kind !== 'match') return
    expect(result.stage).toBe('exact')
    expect(result.quest.timeCost).toBe(20)
    expect(result.quest.energyLevel).toBe(3)
    expect(result.quest.goalIds).toContain('explore')
  })

  it('never recommends anything from the retired catalog', () => {
    const retiredIds = new Set(content.content.retiredTasks.map(({ questId }) => questId))
    for (let seed = 0; seed < 100; seed += 1) {
      const result = matchQuest(quests, basePreference, { ...emptyContext, seed })
      if (result.kind === 'match') expect(retiredIds.has(result.quest.questId)).toBe(false)
    }
  })
})

function withQuest(quest: Quest, patch: Partial<Quest>): Quest { return { ...quest, ...patch } }

function matchingQuest(quest: Quest, patch: Partial<Quest>): Quest {
  return withQuest(quest, {
    timeCost: 10,
    energyLevel: 1,
    locationCondition: 'familiar-indoor',
    environments: ['indoor'],
    socialLevel: 'solo',
    costRequired: false,
    maxCost: 0,
    goalIds: ['relax'],
    times: ['day'],
    ...patch,
  })
}
