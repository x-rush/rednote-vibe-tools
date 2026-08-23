import type { EarthOnlineContent, Quest } from '../content/schema'
import { createProfileViewModel } from '../domain/progression'
import { summarizeHistory } from '../domain/quests'
import type { AppState, PageState } from './state'

export type PageViewModel = {
  title: string
  description: string
  navigation: readonly ['guildHall', 'adventurerProfile', 'questHistory', 'badgeList']
  quest?: Quest
  profile?: ReturnType<typeof createProfileViewModel>
  history?: ReturnType<typeof summarizeHistory>
}

const copy: Record<PageState, { title: string; description: string }> = {
  guildHall: { title: '冒险者公会大厅', description: '现实世界很大，今天完成一件小事就够了。' },
  preferenceSelect: { title: '登记今天的状态', description: '告诉任务板你现在有多少时间和精力，所有选择只保存在本机。' },
  questOffer: { title: '任务告示', description: '这是当前条件下最合适的一项支线，可以接取，也可以换一个。' },
  questAccepted: { title: '进行中任务', description: '不用提交照片或证明；做到任务卡写的那一步就算完成。' },
  questComplete: { title: '任务结算', description: '这一小步已经算数，经验与新徽章只结算一次。' },
  questAbandoned: { title: '任务已放回', description: '放弃不扣分，也不打断连续记录。换一件更适合今天的就好。' },
  adventurerProfile: { title: '冒险者档案', description: '等级只代表累计完成的小任务，不评价能力或价值。' },
  questHistory: { title: '冒险日志', description: '这里只保存有限的结构化任务记录，不保存图片或完成证明。' },
  badgeList: { title: '徽章列表', description: '当前使用文字占位，正式徽章美术留待后续制作。' },
  error: { title: '公会暂时无法发放任务', description: '安全条件不会为了凑出结果而被放宽。可以返回修改今天的状态。' },
}

export function createPageViewModel(state: AppState, content: EarthOnlineContent): PageViewModel {
  const questsById = new Map(content.content.tasks.map((quest) => [quest.questId, quest]))
  const questId = state.guild.activeQuest?.questId ?? state.guild.offeredQuestId
  return {
    ...copy[state.page],
    navigation: ['guildHall', 'adventurerProfile', 'questHistory', 'badgeList'],
    quest: questId ? questsById.get(questId) : undefined,
    profile: createProfileViewModel({ xp: state.guild.xp, streak: state.guild.streak, unlockedBadgeIds: state.guild.unlockedBadgeIds }, content.content.badges, state.guild.history),
    history: summarizeHistory(state.guild.history, questsById),
  }
}
