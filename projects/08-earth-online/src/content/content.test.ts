import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import type { EarthOnlineContent, Quest, QuestPreference } from './schema'
import { validateContent } from './validate'
import { matchQuest } from '../domain/matcher'

const content = rawContent as unknown as EarthOnlineContent
const v1RetiredIds = ['quest-rest-silent-minute', 'quest-rest-hands', 'quest-tidy-expired-note', 'quest-tidy-downloads', 'quest-observe-shadow', 'quest-observe-reflection', 'quest-observe-room-route', 'quest-move-carry-light', 'quest-move-posture-change', 'quest-move-reset-break', 'quest-learn-one-page', 'quest-learn-label', 'quest-learn-question', 'quest-connect-thanks', 'quest-connect-memory', 'quest-connect-question', 'quest-kind-clear-path', 'quest-digital-name-file', 'quest-adventure-door-count', 'quest-adventure-bench-pause']
const v2RetiredIds = ['quest-rest-breath-space', 'quest-rest-close-eyes', 'quest-rest-water-pause', 'quest-tidy-bag', 'quest-tidy-palm-surface', 'quest-tidy-tomorrow-item', 'quest-digital-home-screen', 'quest-digital-one-notification', 'quest-digital-password-plan', 'quest-kind-clean-small', 'quest-kind-leave-better', 'quest-kind-refill', 'quest-kind-reset', 'quest-move-room-lap', 'quest-move-stairs-optional', 'quest-move-three-stretches', 'quest-connect-acknowledge', 'quest-connect-recommend', 'quest-connect-voice-note', 'quest-observe-weather-without-app']
const v3ReplacementIds = ['quest-rest-furniture-shift', 'quest-rest-impossible-tasting', 'quest-rest-no-output', 'quest-tidy-lost-object-court', 'quest-tidy-bag-loadout', 'quest-tidy-launch-rehearsal', 'quest-digital-home-screen-speedrun', 'quest-digital-notification-trial', 'quest-digital-account-escape-map', 'quest-kind-two-minute-bounty', 'quest-kind-friction-report', 'quest-kind-next-player-start', 'quest-kind-permission-fix', 'quest-move-reverse-code', 'quest-move-slow-boss', 'quest-move-mirror-clone', 'quest-connect-pointless-debate', 'quest-connect-one-line-relay', 'quest-connect-object-rpg', 'quest-observe-reality-bug-report']
const proactiveSocialIds = ['quest-kind-two-minute-bounty', 'quest-kind-permission-fix', 'quest-connect-pointless-debate', 'quest-connect-one-line-relay', 'quest-connect-object-rpg']
const nightQuestIds = ['quest-night-lamppost-shadow-boss', 'quest-night-three-color-sample', 'quest-night-sign-cipher', 'quest-night-sound-radar', 'quest-night-window-constellation', 'quest-night-pocket-museum', 'quest-night-route-patch-notes', 'quest-night-kind-signal', 'quest-night-moon-mission-log', 'quest-night-light-poll', 'quest-night-silhouette-cast', 'quest-night-fifteen-minute-expedition']
const oldTemplatePhrases = ['认真演完这段荒唐，普通日常就会短暂获得剧情。', '只挑战一次已经算赢，任何不舒服都可以立刻撤退。', '不求感谢、不留证明，让善意自然发生后就离场。', '把范围锁小，完成后允许这点进步正式算数。', '用一句话确认刚才发生了什么，不追加更大的目标。', '完成后给这段行动起一个荒唐但正式的任务名，然后立刻收工。']

describe('production quest content', () => {
  it('contains 112 valid, unique quests after the nighttime expansion', () => {
    const result = validateContent(content, 'production')
    expect(result.issues).toEqual([])
    expect(content.content.tasks).toHaveLength(112)
    expect(new Set(content.content.tasks.map((quest) => quest.questId)).size).toBe(112)
  })

  it('keeps every category above the original ten-quest floor', () => {
    const counts = Object.fromEntries(content.content.categories.map(({ id }) => [id, 0]))
    for (const quest of content.content.tasks) counts[quest.category] += 1
    expect(counts).toEqual({ rest: 11, tidy: 11, observe: 12, move: 11, create: 11, learn: 11, connect: 11, kind: 11, digital: 11, adventure: 12 })
    expect(content.content.cooldown.recentOfferLimit).toBe(8)
  })

  it('adds twelve playful nighttime outdoor quests with strict visibility boundaries', () => {
    const nightQuests = nightQuestIds.map((questId) => content.content.tasks.find((quest) => quest.questId === questId))
    expect(nightQuests.every(Boolean)).toBe(true)
    for (const quest of nightQuests) {
      if (!quest) continue
      expect(quest.environments).toEqual(['outdoor'])
      expect(quest.times).toEqual(['night'])
      expect(quest.locationCondition).toBe('familiar-public-area')
      expect(quest.safetyTags).toEqual(expect.arrayContaining(['night-safe', 'well-lit-only', 'familiar-area-only', 'public-area-only', 'no-road-crossing', 'skip-if-unsuitable']))
      expect(quest.safetyTags).not.toContain('daylight-only')
      expect(`${quest.title}${quest.description}${quest.steps.join('')}`).toMatch(/Boss|采样|密语|雷达|星座|博物馆|补丁|信号|任务日志|投票|剧组|远征/)
      expect(quest.abandonRule).toMatch(/照明|视线|天气|不安|返回/)
    }
  })

  it('ships v3 with twenty new active IDs and complete v1/v2 compatibility archives', () => {
    const activeIds = new Set(content.content.tasks.map(({ questId }) => questId))
    const archivedIds = new Set(content.content.retiredTasks.map(({ questId }) => questId))
    expect(content.contentVersion).toBe('3.0.0')
    expect(content.content.tasks.every(({ contentVersion }) => contentVersion === '3.0.0')).toBe(true)
    expect(content.content.retiredTasks).toHaveLength(40)
    expect([...activeIds].some((id) => archivedIds.has(id))).toBe(false)
    expect([...v1RetiredIds, ...v2RetiredIds].every((id) => archivedIds.has(id))).toBe(true)
    expect(v2RetiredIds.every((id) => !activeIds.has(id))).toBe(true)
    expect(v3ReplacementIds.every((id) => activeIds.has(id))).toBe(true)
    expect(content.content.legacyTasks).toHaveLength(160)
    expect(content.content.legacyTasks.filter(({ contentVersion }) => contentVersion === '1.0.0')).toHaveLength(80)
    expect(content.content.legacyTasks.filter(({ contentVersion }) => contentVersion === '2.0.0')).toHaveLength(80)
    expect(content.content.legacyTasks.every(({ questId }) => activeIds.has(questId) || archivedIds.has(questId))).toBe(true)
    const completeV2Ids = new Set([
      ...content.content.retiredTasks.filter(({ contentVersion }) => contentVersion === '2.0.0').map(({ questId }) => questId),
      ...content.content.legacyTasks.filter(({ contentVersion }) => contentVersion === '2.0.0').map(({ questId }) => questId),
    ])
    expect(completeV2Ids.size).toBe(100)
  })

  it('makes the twenty replacements gameful instead of cosmetic rewrites', () => {
    const replacements = content.content.tasks.filter(({ questId }) => v3ReplacementIds.includes(questId))
    const authored = replacements.map((quest) => `${quest.title}${quest.description}${quest.steps.join('')}`).join('\n')
    expect(replacements).toHaveLength(20)
    expect(new Set(replacements.map(({ completionMethod }) => completionMethod)).size).toBe(20)
    expect(authored.match(/家具|品鉴|不解决|法庭|编队|速通|逃生|Boss|分身|无意义|荒诞|RPG|Bug/g)?.length ?? 0).toBeGreaterThanOrEqual(12)
    expect(replacements.filter((quest) => quest.steps.some((step) => /倒序|倒放|计时|彩排|排序|三轮|四段|三条/.test(step))).length).toBeGreaterThanOrEqual(10)
  })

  it('adds proactive familiar-person quests without requiring a reply', () => {
    const proactive = proactiveSocialIds.map((questId) => content.content.tasks.find((quest) => quest.questId === questId))
    expect(proactive.every(Boolean)).toBe(true)
    for (const quest of proactive) {
      if (!quest) continue
      const authored = `${quest.description}${quest.steps.join('')}${quest.abandonRule}`
      expect(quest.socialLevel).toBe('optional')
      expect(quest.safetyTags).not.toContain('stranger-interaction')
      expect(authored).toMatch(/可信|熟悉/)
      expect(authored).toMatch(/不回复|拒绝|不参与|发送.*完成/)
    }
  })

  it('uses every supported challenge tier with the approved distribution', () => {
    expect(countBy(content.content.tasks, 'timeCost')).toEqual({ 5: 38, 10: 37, 15: 27, 20: 10 })
    expect(countBy(content.content.tasks, 'energyLevel')).toEqual({ 1: 53, 2: 44, 3: 15 })
    expect(countBy(content.content.tasks, 'difficulty')).toEqual({ tiny: 43, light: 42, standard: 22, brave: 5 })
    for (const quest of content.content.tasks) expect(quest.xp).toBe({ tiny: 20, light: 35, standard: 55, brave: 80 }[quest.difficulty])
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
    expect(toneCounts).toEqual({ absurd: 28, courage: 28, kindness: 28, growth: 28 })
  })

  it('uses authored descriptions and steps instead of the previous universal template', () => {
    for (const quest of content.content.tasks) {
      expect(quest.description).not.toContain('今天只完成这一件小事')
      expect(quest.steps.join('')).not.toContain('做到标题所述的这一小步')
      expect(quest.steps.length).toBeGreaterThanOrEqual(2)
      expect(quest.steps.length).toBeLessThanOrEqual(3)
      const authored = `${quest.description}\n${quest.steps.join('\n')}`
      for (const phrase of oldTemplatePhrases) expect(authored).not.toContain(phrase)
      expect(new Set(quest.steps).size).toBe(quest.steps.length)
    }
  })

  it('uses task-specific exit rules and time-accurate challenge titles', () => {
    expect(new Set(content.content.tasks.map(({ abandonRule }) => abandonRule)).size).toBe(112)
    expect(new Set(content.content.tasks.map(({ abandonText }) => abandonText)).size).toBe(112)
    expect(new Set(content.content.tasks.map((quest) => quest.abandonRule.replace(quest.title, '{title}'))).size).toBe(112)
    expect(new Set(content.content.tasks.map((quest) => quest.abandonText.replace(quest.title, '{title}'))).size).toBe(112)
    for (const quest of content.content.tasks) {
      expect(quest.abandonRule).toContain(quest.steps[0])
      expect(quest.abandonText).toContain(quest.completionMethod)
    }
    const motionBingo = content.content.tasks.find(({ questId }) => questId === 'quest-move-motion-bingo')
    const frictionFix = content.content.tasks.find(({ questId }) => questId === 'quest-kind-friction-fix')
    expect(motionBingo?.title).toContain('十五分钟')
    expect(motionBingo?.shareText).toContain('十五分钟')
    expect(frictionFix?.title).toContain('十分钟')
    expect(frictionFix?.shareText).toContain('十分钟')
  })

  it('keeps stranger side quests brief, optional, and easy to exit', () => {
    const strangerQuests = content.content.tasks.filter((quest) => quest.safetyTags.includes('stranger-interaction'))
    expect(strangerQuests.length).toBeLessThanOrEqual(6)
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
    expect(Object.keys(ui.quest.labels)).toEqual(['rank', 'time', 'energy', 'environment', 'social', 'budget', 'xp', 'why', 'relaxed', 'kept', 'steps', 'exit', 'classic'])
    expect(ui.quest.neverRelaxed).toHaveLength(5)
    expect(Object.keys(ui.matching.stages)).toEqual(['exact', 'goal-relaxed', 'energy-relaxed', 'recent-relaxed', 'safe-fallback'])
    expect(Object.keys(ui.matching.positive)).toEqual(['goal', 'time', 'solo', 'optional', 'fresh', 'variety'])
    expect(ui.matching.positive.time).toContain('{minutes}')
    expect(ui.matching.noMatch.neverRelaxed).toHaveLength(5)
  })

  it('keeps all launch quests free and applies specialist safety tags', () => {
    expect(content.content.tasks.every((quest) => quest.costRequired === false && quest.maxCost === 0)).toBe(true)
    for (const quest of content.content.tasks) {
      expect(quest.safetyTags).toEqual(expect.arrayContaining(['no-purchase', 'no-photo-required', 'no-personal-data']))
      if (quest.environments.includes('outdoor')) {
        expect(quest.safetyTags).toEqual(expect.arrayContaining(['familiar-area-only', 'public-area-only']))
        if (quest.safetyTags.includes('night-safe')) expect(quest.safetyTags).toEqual(expect.arrayContaining(['well-lit-only', 'no-road-crossing', 'skip-if-unsuitable']))
        else expect(quest.safetyTags).toContain('daylight-only')
      }
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
    for (const [index, condition] of golden.entries()) {
      const result = matchQuest(content.content.tasks, condition, { seed: `golden-${index}`, nowDate: '2026-08-29', recentQuestIds: [], completed: [], abandoned: [], previousCategoryIds: [], softAvoidCategoryIds: [], copy: content.content.ui.matching })
      expect(result.kind).toBe('match')
    }
  })

  it('finds a safe quest for every condition the check-in UI can produce', () => {
    let combinations = 0
    for (const minutes of [5, 10, 15, 20] as const) for (const energy of [1, 2, 3] as const) for (const environment of ['indoor', 'outdoor'] as const) for (const social of ['none', 'optional'] as const) for (const timeOfDay of ['day', 'night'] as const) for (const { id: goalId } of content.content.goals) {
      combinations += 1
      const result = matchQuest(content.content.tasks, preference(minutes, energy, environment, social, timeOfDay, goalId), { seed: `coverage-${combinations}`, nowDate: '2026-08-29', recentQuestIds: [], completed: [], abandoned: [], previousCategoryIds: [], softAvoidCategoryIds: [], copy: content.content.ui.matching })
      expect(result.kind, `${minutes}/${energy}/${environment}/${social}/${timeOfDay}/${goalId}`).toBe('match')
    }
    expect(combinations).toBe(768)
  })
})

function preference(minutes: QuestPreference['minutes'], energy: QuestPreference['energy'], environment: QuestPreference['environment'], social: QuestPreference['social'], timeOfDay: QuestPreference['timeOfDay'], goalId: string): QuestPreference {
  return { minutes, energy, environment, social, spend: 'none', timeOfDay, location: environment === 'indoor' ? 'familiar-indoor' : 'familiar-public-area', goalId, excludedConditions: [] }
}

function countBy<K extends 'timeCost' | 'energyLevel' | 'difficulty'>(quests: Quest[], key: K): Record<string, number> {
  return quests.reduce<Record<string, number>>((counts, quest) => {
    const value = String(quest[key])
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}
