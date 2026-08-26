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

  it('ships four substantial RPG quest tones with a bespoke guild briefing', () => {
    const allowedTones = ['absurd', 'courage', 'kindness', 'growth']
    const toneCounts = Object.fromEntries(allowedTones.map((tone) => [tone, 0]))
    for (const quest of content.content.tasks) {
      const rpgQuest = quest as Quest & { tone?: string; guildBrief?: string }
      expect(allowedTones).toContain(rpgQuest.tone)
      expect(rpgQuest.guildBrief?.trim().length).toBeGreaterThanOrEqual(8)
      expect(rpgQuest.guildBrief?.trim().length).toBeLessThanOrEqual(64)
      toneCounts[rpgQuest.tone as string] += 1
    }
    expect(toneCounts).toEqual({ absurd: 25, courage: 25, kindness: 25, growth: 25 })
  })

  it('uses authored descriptions and steps instead of the previous universal template', () => {
    for (const quest of content.content.tasks) {
      expect(quest.description).not.toContain('今天只完成这一件小事')
      expect(quest.steps.join('')).not.toContain('做到标题所述的这一小步')
      expect(quest.steps.length).toBeGreaterThanOrEqual(2)
      expect(quest.steps.length).toBeLessThanOrEqual(3)
    }
  })

  it('keeps stranger side quests brief, optional, and easy to exit', () => {
    const strangerQuests = content.content.tasks.filter((quest) => quest.safetyTags.includes('stranger-interaction'))
    expect(strangerQuests.length).toBeGreaterThanOrEqual(8)
    for (const quest of strangerQuests) {
      expect(quest.socialLevel).toBe('optional')
      expect(`${quest.description}${quest.steps.join('')}${quest.abandonRule}`).toMatch(/一次|一句|一声/)
      expect(`${quest.description}${quest.steps.join('')}${quest.abandonRule}`).toMatch(/不回应|不方便|离开|结束|跳过/)
    }
  })

  it('contains complete typed UI copy for the guild experience', () => {
    const ui = content.content.ui
    expect(ui.intro.lines).toHaveLength(3)
    expect(ui.navigation.map(({ id }) => id)).toEqual(['guildHall', 'questHistory', 'badgeList', 'adventurerProfile'])
    expect(Object.keys(ui.pages)).toEqual(expect.arrayContaining(['guildHall', 'preferenceSelect', 'matching', 'questOffer', 'questAccepted', 'questComplete', 'questAbandoned', 'adventurerProfile', 'questHistory', 'badgeList', 'error']))
    expect(ui.actions.accept).toBeTruthy()
    const hud = (ui as typeof ui & { hud?: Record<string, string> }).hud
    expect(Object.keys(hud ?? {})).toEqual(['adventurerLabel', 'guideLabel', 'talkLabel'])
    expect(Object.values(hud ?? {}).every((value) => value.trim().length > 0)).toBe(true)
    expect(ui.help).toHaveLength(5)
    const helpDialogue = (ui as typeof ui & { helpDialogue?: Record<string, string> }).helpDialogue
    expect(Object.keys(helpDialogue ?? {})).toEqual(['prompt', 'answerEyebrow', 'closeLabel'])
    expect(Object.values(helpDialogue ?? {}).every((value) => value.trim().length > 0)).toBe(true)
    expect(Object.keys(ui.reasons)).toEqual(['too-tiring', 'environment', 'no-time', 'changed-mind', 'unsafe-now'])
    expect(Object.keys(ui.checkIn.legends)).toEqual(['time', 'energy', 'environment', 'social', 'goal', 'dayPart'])
    expect(ui.checkIn.energyLabels).toHaveLength(3)
    expect(ui.checkIn.socialLabels.optional).toContain('轻互动')
    expect(ui.checkIn.socialLabels.optional).not.toContain('熟人')
    expect(Object.keys(ui.quest.labels)).toEqual(['rank', 'time', 'energy', 'environment', 'social', 'budget', 'why', 'relaxed', 'kept', 'steps', 'exit'])
    expect(ui.quest.neverRelaxed).toHaveLength(5)
    expect(Object.keys(ui.matching.stages)).toEqual(['exact', 'goal-relaxed', 'energy-relaxed', 'recent-relaxed', 'safe-fallback'])
    expect(ui.matching.positive.time).toContain('{minutes}')
    expect(ui.matching.noMatch.neverRelaxed).toHaveLength(5)
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
