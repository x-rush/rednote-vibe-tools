import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { EarthOnlineContent } from '../content/schema'
import { createGuildState } from '../domain/quests'
import type { PageState } from './state'
import { createPageViewModel } from './view-model'

const content = rawContent as unknown as EarthOnlineContent
const preference = { minutes: 10 as const, energy: 1 as const, environment: 'indoor' as const, social: 'none' as const, spend: 'none' as const, timeOfDay: 'day' as const, location: 'familiar-indoor' as const, goalId: 'relax', excludedConditions: [] }
const pages: PageState[] = ['guildHall', 'preferenceSelect', 'questOffer', 'questAccepted', 'questComplete', 'questAbandoned', 'adventurerProfile', 'questHistory', 'badgeList', 'error']

describe('page view models', () => {
  it('provides readable structure and navigation for every page state', () => {
    for (const page of pages) {
      const model = createPageViewModel({ page, guild: createGuildState(preference, 1), lastAwardedXp: 0, newlyUnlockedBadgeIds: [], error: page === 'error' ? { message: '可恢复错误', recoverable: true } : undefined }, content)
      expect(model.title.length).toBeGreaterThan(0)
      expect(model.description.length).toBeGreaterThan(0)
      expect(model.navigation).toEqual(['guildHall', 'adventurerProfile', 'questHistory', 'badgeList'])
    }
  })

  it('reads offered quest copy from content rather than duplicating it', () => {
    const quest = content.content.tasks[0]
    const guild = { ...createGuildState(preference, 1), offeredQuestId: quest.questId }
    const model = createPageViewModel({ page: 'questOffer', guild, lastAwardedXp: 0, newlyUnlockedBadgeIds: [] }, content)
    expect(model.quest?.title).toBe(quest.title)
    expect(model.quest?.description).toBe(quest.description)
  })
})
