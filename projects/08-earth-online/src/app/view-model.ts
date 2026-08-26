import type { EarthOnlineContent, Quest } from '../content/schema'
import { createProfileViewModel } from '../domain/progression'
import { summarizeHistory } from '../domain/quests'
import type { AppState } from './state'

export type PageViewModel = {
  eyebrow: string
  title: string
  description: string
  navigation: readonly ['guildHall', 'adventurerProfile', 'questHistory', 'badgeList']
  quest?: Quest
  profile?: ReturnType<typeof createProfileViewModel>
  history?: ReturnType<typeof summarizeHistory>
  offerExplanation?: AppState['offerExplanation']
}

export function createPageViewModel(state: AppState, content: EarthOnlineContent): PageViewModel {
  const questsById = new Map(content.content.tasks.map((quest) => [quest.questId, quest]))
  const questId = state.guild.activeQuest?.questId ?? state.guild.offeredQuestId
  return {
    ...content.content.ui.pages[state.page],
    navigation: ['guildHall', 'adventurerProfile', 'questHistory', 'badgeList'],
    quest: questId ? questsById.get(questId) : undefined,
    profile: createProfileViewModel({ xp: state.guild.xp, streak: state.guild.streak, unlockedBadgeIds: state.guild.unlockedBadgeIds }, content.content.badges, state.guild.history),
    history: summarizeHistory(state.guild.history, questsById, content.content.ui.archive.removedQuest),
    offerExplanation: state.offerExplanation,
  }
}
