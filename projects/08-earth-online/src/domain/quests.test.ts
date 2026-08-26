import { afterEach, describe, expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import type { EarthOnlineContent, QuestMatch } from '../content/schema'
import { acceptQuest, abandonQuest, completeQuest, createGuildState, offerQuest, setGuideSeen, setSoftAvoidCategory, summarizeHistory, swapQuest, undoSoftAvoidCategory } from './quests'

const content = rawContent as unknown as EarthOnlineContent
const quest = content.content.tasks[0]
const otherQuest = content.content.tasks[10]
const preference = { minutes: 10 as const, energy: 1 as const, environment: 'indoor' as const, social: 'none' as const, spend: 'none' as const, timeOfDay: 'day' as const, location: 'familiar-indoor' as const, goalId: 'relax', excludedConditions: [] }
const match = (selected = quest): QuestMatch => ({ kind: 'match', quest: selected, score: 100, stage: 'exact', reasons: ['正合适'], relaxed: [], nextSeed: 42 })

describe('quest lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts a fresh guild with browser-provided entropy', () => {
    vi.stubGlobal('crypto', {
      getRandomValues(values: Uint32Array) {
        values[0] = 0xa1b2c3d4
        return values
      },
    })

    expect(createGuildState(preference).rngState).toBe(0xa1b2c3d4)
  })

  it('offers and accepts a quest without awarding XP', () => {
    const offered = offerQuest(createGuildState(preference, 1), match(), '2026-08-24T08:00:00.000Z')
    expect(offered.xp).toBe(0)
    expect(offered.offeredQuestId).toBe(quest.questId)
    const accepted = acceptQuest(offered, '2026-08-24T08:01:00.000Z')
    expect(accepted.activeQuest?.questId).toBe(quest.questId)
    expect(acceptQuest(accepted, '2026-08-24T08:02:00.000Z')).toEqual(accepted)
  })

  it('records swaps and abandonment without penalties', () => {
    const offered = offerQuest(createGuildState(preference, 1), match(), '2026-08-24T08:00:00.000Z')
    const swapped = swapQuest(offered, match(otherQuest), '2026-08-24T08:01:00.000Z')
    expect(swapped.history[0]).toMatchObject({ questId: quest.questId, status: 'swapped', xpAwarded: 0 })
    const abandoned = abandonQuest(acceptQuest(swapped, '2026-08-24T08:02:00.000Z'), '2026-08-24T08:03:00.000Z')
    expect(abandoned.xp).toBe(0)
    expect(abandoned.streak.current).toBe(0)
    expect(abandoned.history.at(-1)).toMatchObject({ questId: otherQuest.questId, status: 'abandoned' })
  })

  it('awards completion XP exactly once per acceptance', () => {
    const active = acceptQuest(offerQuest(createGuildState(preference, 1), match(), '2026-08-24T08:00:00.000Z'), '2026-08-24T08:01:00.000Z')
    const first = completeQuest(active, quest, content.content.badges, '2026-08-24T08:06:00.000Z', '2026-08-24')
    expect(first.awardedXp).toBe(quest.xp)
    expect(first.state.xp).toBe(quest.xp)
    expect(first.state.history.filter(({ status }) => status === 'completed')).toHaveLength(1)
    const repeated = completeQuest(first.state, quest, content.content.badges, '2026-08-24T08:07:00.000Z', '2026-08-24')
    expect(repeated.awardedXp).toBe(0)
    expect(repeated.state.xp).toBe(quest.xp)
    expect(repeated.state.history.filter(({ status }) => status === 'completed')).toHaveLength(1)
  })

  it('builds a finite history summary while tolerating removed content IDs', () => {
    const summary = summarizeHistory([
      { acceptanceId: 'one', questId: quest.questId, status: 'completed', occurredAt: '2026-08-24T08:00:00.000Z', completionDate: '2026-08-24', xpAwarded: 20 },
      { acceptanceId: 'two', questId: 'quest-retired', status: 'abandoned', occurredAt: '2026-08-23T08:00:00.000Z', xpAwarded: 0 },
    ], new Map([[quest.questId, quest]]), content.content.ui.archive.removedQuest)
    expect(summary).toMatchObject({ total: 2, completed: 1, abandoned: 1, earnedXp: 20 })
    expect(summary.entries[1].title).toBe('已下线任务')
  })

  it('stores guide completion and reversible category avoidance as structured settings', () => {
    const initial = createGuildState(preference, 1)
    const guided = setGuideSeen(initial)
    expect(guided.settings.hasSeenGuide).toBe(true)
    const avoided = setSoftAvoidCategory(guided, 'move')
    expect(avoided.settings.softAvoidCategoryIds).toEqual(['move'])
    expect(setSoftAvoidCategory(avoided, 'move')).toEqual(avoided)
    expect(undoSoftAvoidCategory(avoided, 'move').settings.softAvoidCategoryIds).toEqual([])
  })
})
