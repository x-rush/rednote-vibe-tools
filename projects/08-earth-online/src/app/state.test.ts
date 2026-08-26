import { describe, expect, it } from 'vitest'
import type { CompletionResult, GuildDomainState } from '../domain/quests'
import { createGuildState } from '../domain/quests'
import { appReducer, createInitialAppState, restorePage, shouldPersistAppState } from './state'

const preference = { minutes: 10 as const, energy: 1 as const, environment: 'indoor' as const, social: 'none' as const, spend: 'none' as const, timeOfDay: 'day' as const, location: 'familiar-indoor' as const, goalId: 'relax', excludedConditions: [] }
const guild = createGuildState(preference, 1)

describe('application state machine', () => {
  it('covers the primary offer, accept, complete, and navigation flow', () => {
    let state = createInitialAppState(guild)
    state = appReducer(state, { type: 'OPEN_PREFERENCES' })
    expect(state.page).toBe('preferenceSelect')
    state = appReducer(state, { type: 'OFFER_CREATED', state: { ...guild, offeredQuestId: 'quest-rest-window-color' }, explanation: { stage: 'goal-relaxed', score: 80, reasons: ['目标类型已放宽'], relaxed: ['目标类型'] } })
    expect(state.page).toBe('questOffer')
    expect(state.offerExplanation?.stage).toBe('goal-relaxed')
    state = appReducer(state, { type: 'QUEST_ACCEPTED', state: activeGuild() })
    expect(state.page).toBe('questAccepted')
    expect(state.offerExplanation).toBeUndefined()
    const result: CompletionResult = { state: { ...guild, xp: 20 }, awardedXp: 20, newlyUnlockedBadgeIds: ['badge-first-quest'], alreadyCompleted: false }
    state = appReducer(state, { type: 'QUEST_COMPLETED', result })
    expect(state.page).toBe('questComplete')
    expect(state.lastAwardedXp).toBe(20)
    for (const page of ['adventurerProfile', 'questHistory', 'badgeList', 'guildHall'] as const) {
      state = appReducer(state, { type: 'NAVIGATE', page })
      expect(state.page).toBe(page)
    }
  })

  it('supports swapped, abandoned, no-match, and recoverable error states', () => {
    expect(appReducer(createInitialAppState(guild), { type: 'QUEST_SWAPPED', state: { ...guild, offeredQuestId: 'quest-tidy-palm-surface' }, explanation: { stage: 'exact', score: 100, reasons: ['正合适'], relaxed: [] } }).page).toBe('questOffer')
    expect(appReducer(createInitialAppState(activeGuild()), { type: 'QUEST_ABANDONED', state: guild }).page).toBe('questAbandoned')
    const noMatch = appReducer(createInitialAppState(guild), { type: 'NO_MATCH', message: '没有匹配', reasons: ['没有安全候选'] })
    expect(noMatch.page).toBe('error')
    expect(noMatch.error).toMatchObject({ recoverable: true })
    const failed = appReducer(noMatch, { type: 'FAIL', message: '存储损坏', recoverable: true })
    expect(failed.error?.message).toBe('存储损坏')
  })

  it('restores active quests before offers and otherwise returns to the hall', () => {
    const payload = { preference, recentQuestIds: [], completedQuestIds: [], history: [], xp: 0, streak: { current: 0, best: 0 }, unlockedBadgeIds: [], rngState: 1, settings: { hasSeenGuide: false, softAvoidCategoryIds: [] } }
    expect(restorePage(payload)).toBe('guildHall')
    expect(restorePage({ ...payload, offeredQuestId: 'quest-rest-window-color' })).toBe('questOffer')
    expect(restorePage({ ...payload, activeQuest: activeGuild().activeQuest })).toBe('questAccepted')
  })

  it('does not apply a replayed completion reward twice', () => {
    const result: CompletionResult = { state: { ...guild, xp: 20 }, awardedXp: 20, newlyUnlockedBadgeIds: [], alreadyCompleted: false }
    const once = appReducer(createInitialAppState(guild), { type: 'QUEST_COMPLETED', result })
    const replay: CompletionResult = { state: once.guild, awardedXp: 0, newlyUnlockedBadgeIds: [], alreadyCompleted: true }
    const twice = appReducer(once, { type: 'QUEST_COMPLETED', result: replay })
    expect(twice.guild.xp).toBe(20)
    expect(twice.lastAwardedXp).toBe(0)
  })

  it('preserves corrupted source data until the user actively recovers', () => {
    const initial = createInitialAppState(guild)
    expect(shouldPersistAppState({ ...initial, page: 'error', error: { code: 'storage-recovery', message: '存储损坏', recoverable: true } })).toBe(false)
    expect(shouldPersistAppState({ ...initial, page: 'error', error: { code: 'no-match', message: '无匹配', recoverable: true } })).toBe(true)
    expect(shouldPersistAppState({ ...initial, page: 'preferenceSelect' })).toBe(true)
  })

  it('updates durable guild settings without changing the current page', () => {
    const initial = createInitialAppState(guild)
    const updated = appReducer(initial, { type: 'GUILD_UPDATED', state: { ...guild, settings: { hasSeenGuide: true, softAvoidCategoryIds: [] } } })
    expect(updated.page).toBe('guildHall')
    expect(updated.guild.settings.hasSeenGuide).toBe(true)
  })

  it('resumes an existing active quest from the hall and rejects an empty resume', () => {
    expect(appReducer({ ...createInitialAppState(activeGuild()), page: 'guildHall' }, { type: 'RESUME_ACTIVE' }).page).toBe('questAccepted')
    expect(appReducer(createInitialAppState(guild), { type: 'RESUME_ACTIVE' }).error?.code).toBe('transition')
  })

  it('keeps a storage-write failure distinct for temporary-mode recovery', () => {
    const next = appReducer(createInitialAppState(guild), { type: 'FAIL', code: 'storage-write', message: 'temporary', recoverable: true })
    expect(next.error?.code).toBe('storage-write')
  })
})

function activeGuild(): GuildDomainState {
  return { ...guild, activeQuest: { acceptanceId: 'accept-1', questId: 'quest-rest-window-color', acceptedAt: '2026-08-24T08:00:00.000Z', preference } }
}
