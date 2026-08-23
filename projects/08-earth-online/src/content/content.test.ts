import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import type { EarthOnlineContent, Quest, QuestPreference } from './schema'
import { validateContent } from './validate'

const content = rawContent as unknown as EarthOnlineContent

describe('production quest content', () => {
  it('contains exactly 100 valid, unique quests', () => {
    const result = validateContent(content, 'production')
    expect(result.issues).toEqual([])
    expect(content.content.tasks).toHaveLength(100)
    expect(new Set(content.content.tasks.map((quest) => quest.questId)).size).toBe(100)
  })

  it('contains ten meaningful categories with ten quests each', () => {
    const counts = Object.fromEntries(content.content.categories.map(({ id }) => [id, 0]))
    for (const quest of content.content.tasks) counts[quest.category] += 1
    expect(counts).toEqual({ rest: 10, tidy: 10, observe: 10, move: 10, create: 10, learn: 10, connect: 10, kind: 10, digital: 10, adventure: 10 })
  })

  it('keeps all launch quests free and applies specialist safety tags', () => {
    expect(content.content.tasks.every((quest) => quest.costRequired === false && quest.maxCost === 0)).toBe(true)
    for (const quest of content.content.tasks) {
      expect(quest.safetyTags).toEqual(expect.arrayContaining(['no-purchase', 'no-photo-required', 'no-personal-data']))
      if (quest.environments.includes('outdoor')) expect(quest.safetyTags).toEqual(expect.arrayContaining(['daylight-only', 'familiar-area-only', 'public-area-only']))
      if (quest.category === 'move') expect(quest.safetyTags).toEqual(expect.arrayContaining(['comfort-range', 'skip-if-unsuitable']))
    }
  })

  it('has candidates for twelve golden user conditions before recency exclusions', () => {
    const golden: QuestPreference[] = [
      preference(5, 1, 'indoor', 'none', 'night', 'relax'), preference(10, 1, 'indoor', 'none', 'day', 'organize'),
      preference(15, 2, 'outdoor', 'none', 'day', 'explore'), preference(5, 1, 'outdoor', 'none', 'day', 'relax'),
      preference(10, 2, 'indoor', 'optional', 'day', 'connect'), preference(15, 2, 'indoor', 'none', 'night', 'create'),
      preference(10, 1, 'indoor', 'none', 'day', 'learn'), preference(10, 1, 'outdoor', 'optional', 'day', 'connect'),
      preference(20, 3, 'indoor', 'none', 'night', 'move'), preference(15, 2, 'outdoor', 'none', 'day', 'observe'),
      preference(5, 1, 'indoor', 'optional', 'night', 'kind'), preference(20, 3, 'outdoor', 'optional', 'day', 'explore'),
    ]
    for (const condition of golden) expect(content.content.tasks.some((quest) => satisfiesHardConditions(quest, condition))).toBe(true)
  })
})

function preference(minutes: QuestPreference['minutes'], energy: QuestPreference['energy'], environment: QuestPreference['environment'], social: QuestPreference['social'], timeOfDay: QuestPreference['timeOfDay'], goalId: string): QuestPreference {
  return { minutes, energy, environment, social, spend: 'none', timeOfDay, location: environment === 'indoor' ? 'familiar-indoor' : 'familiar-public-area', goalId, excludedConditions: [] }
}

function satisfiesHardConditions(quest: Quest, preferenceValue: QuestPreference): boolean {
  return quest.timeCost <= preferenceValue.minutes && quest.energyLevel <= preferenceValue.energy && quest.environments.includes(preferenceValue.environment) && quest.times.includes(preferenceValue.timeOfDay) && (preferenceValue.social === 'optional' || quest.socialLevel === 'solo') && quest.maxCost === 0
}
