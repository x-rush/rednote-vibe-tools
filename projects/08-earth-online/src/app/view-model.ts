import type { EarthOnlineContent, Quest } from '../content/schema'
import { createQuestCatalog, type QuestCatalog } from '../content/catalog'
import { createProfileViewModel } from '../domain/progression'
import { summarizeHistory } from '../domain/quests'
import type { AppState } from './state'

export type PageViewModel = {
  eyebrow: string
  title: string
  description: string
  navigation: readonly ['guildHall', 'adventurerProfile', 'questHistory', 'badgeList']
  quest?: Quest
  questIsRetired?: boolean
  profile?: ReturnType<typeof createProfileViewModel>
  history?: ReturnType<typeof summarizeHistory>
  offerExplanation?: AppState['offerExplanation']
}

export function createPageViewModel(state: AppState, content: EarthOnlineContent, catalog: QuestCatalog = createQuestCatalog(content)): PageViewModel {
  const questId = state.guild.activeQuest?.questId ?? state.guild.offeredQuestId
  const questVersion = state.guild.activeQuest?.questContentVersion
  return {
    ...content.content.ui.pages[state.page],
    navigation: ['guildHall', 'adventurerProfile', 'questHistory', 'badgeList'],
    quest: questId ? catalog.resolve(questId, questVersion) : undefined,
    questIsRetired: questId && questVersion ? catalog.isClassic(questId, questVersion) : false,
    profile: createProfileViewModel({ xp: state.guild.xp, streak: state.guild.streak, unlockedBadgeIds: state.guild.unlockedBadgeIds }, content.content.badges, state.guild.history),
    history: summarizeHistory(state.guild.history),
    offerExplanation: state.offerExplanation,
  }
}
