import type { QuestCategory } from '../content/schema'

const assetRoot = './assets/earth-online'

export const assets = {
  brand: {
    mark: `${assetRoot}/brand/logo-mark.svg`,
  },
  mira: {
    master: `${assetRoot}/guide/mira-master-v3.png`,
    avatar: `${assetRoot}/guide/mira-avatar-v3.webp`,
    placeholder: `${assetRoot}/guide/mira-placeholder-v3.webp`,
  },
  scenes: {
    guildNoticeBoard: `${assetRoot}/scenes/guild-notice-board-v1.webp`,
  },
  category: (id: QuestCategory) => `${assetRoot}/categories/category-${id}.svg`,
  rank: (rank: 'e' | 'd' | 'c') => `${assetRoot}/ranks/rank-${rank}.svg`,
  status: (id: 'active' | 'completed' | 'abandoned' | 'unsuitable' | 'temporary') => `${assetRoot}/status/status-${id}.svg`,
  badge: (id: string) => `${assetRoot}/badges/${id}.svg`,
  prop: (id: 'ticket-stub' | 'route-slip' | 'backpack-tag' | 'notice-pin' | 'paperclip' | 'guild-brooch') => `${assetRoot}/props/${id}.svg`,
  completionSeal: `${assetRoot}/status/completion-seal.svg`,
} as const
