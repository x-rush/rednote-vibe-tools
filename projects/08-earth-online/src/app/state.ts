import type { StoragePayload } from '../content/schema'
import type { CompletionResult, GuildDomainState } from '../domain/quests'
import type { OfferExplanation } from '../ui/state'

export type PageState = 'guildHall' | 'preferenceSelect' | 'questOffer' | 'questAccepted' | 'questComplete' | 'questAbandoned' | 'adventurerProfile' | 'questHistory' | 'badgeList' | 'error'
export type AppError = { code?: 'storage-recovery' | 'storage-write' | 'no-match' | 'content' | 'transition' | 'generic'; message: string; recoverable: boolean; reasons?: string[] }
export type AppState = { page: PageState; guild: GuildDomainState; error?: AppError; offerExplanation?: OfferExplanation; lastAwardedXp: number; newlyUnlockedBadgeIds: string[] }
export type AppAction =
  | { type: 'OPEN_PREFERENCES' }
  | { type: 'RESUME_ACTIVE' }
  | { type: 'GUILD_UPDATED'; state: GuildDomainState }
  | { type: 'OFFER_CREATED'; state: GuildDomainState; explanation: OfferExplanation }
  | { type: 'QUEST_ACCEPTED'; state: GuildDomainState }
  | { type: 'QUEST_SWAPPED'; state: GuildDomainState; explanation: OfferExplanation }
  | { type: 'QUEST_COMPLETED'; result: CompletionResult }
  | { type: 'QUEST_ABANDONED'; state: GuildDomainState }
  | { type: 'NAVIGATE'; page: 'guildHall' | 'adventurerProfile' | 'questHistory' | 'badgeList' }
  | { type: 'RESTORE'; payload: StoragePayload }
  | { type: 'NO_MATCH'; message: string; reasons: string[] }
  | { type: 'FAIL'; code?: AppError['code']; message: string; recoverable: boolean }
  | { type: 'RESET'; state: GuildDomainState }

export function createInitialAppState(guild: GuildDomainState): AppState {
  return { page: guild.activeQuest ? 'questAccepted' : guild.offeredQuestId ? 'questOffer' : 'guildHall', guild, lastAwardedXp: 0, newlyUnlockedBadgeIds: [] }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'OPEN_PREFERENCES': return { ...state, page: 'preferenceSelect', error: undefined }
    case 'RESUME_ACTIVE': return state.guild.activeQuest
      ? { ...state, page: 'questAccepted', error: undefined }
      : invalidTransition(state, '当前没有进行中的任务。')
    case 'GUILD_UPDATED': return { ...state, guild: action.state }
    case 'OFFER_CREATED': return { ...state, guild: action.state, page: 'questOffer', offerExplanation: action.explanation, error: undefined }
    case 'QUEST_ACCEPTED': return action.state.activeQuest ? { ...state, guild: action.state, page: 'questAccepted', offerExplanation: undefined, error: undefined } : invalidTransition(state, '任务尚未成功接取。')
    case 'QUEST_SWAPPED': return { ...state, guild: action.state, page: 'questOffer', offerExplanation: action.explanation, error: undefined }
    case 'QUEST_COMPLETED': return { ...state, guild: action.result.state, page: 'questComplete', offerExplanation: undefined, lastAwardedXp: action.result.awardedXp, newlyUnlockedBadgeIds: action.result.newlyUnlockedBadgeIds, error: undefined }
    case 'QUEST_ABANDONED': return { ...state, guild: action.state, page: 'questAbandoned', offerExplanation: undefined, error: undefined }
    case 'NAVIGATE': return { ...state, page: action.page, error: undefined }
    case 'RESTORE': {
      const guild = guildFromPayload(action.payload)
      return { ...state, guild, page: restorePage(action.payload), offerExplanation: undefined, error: undefined }
    }
    case 'NO_MATCH': return { ...state, page: 'error', error: { code: 'no-match', message: action.message, recoverable: true, reasons: action.reasons } }
    case 'FAIL': return { ...state, page: 'error', error: { code: action.code ?? 'generic', message: action.message, recoverable: action.recoverable } }
    case 'RESET': return createInitialAppState(action.state)
  }
}

export function restorePage(payload: StoragePayload): PageState {
  if (payload.activeQuest) return 'questAccepted'
  if (payload.offeredQuestId) return 'questOffer'
  return 'guildHall'
}

export function shouldPersistAppState(state: AppState): boolean { return state.error?.code !== 'storage-recovery' && state.error?.code !== 'storage-write' && state.error?.code !== 'content' }

function guildFromPayload(payload: StoragePayload): GuildDomainState {
  const categoryCompletionCounts: GuildDomainState['categoryCompletionCounts'] = {}
  for (const entry of payload.history) if (entry.status === 'completed') categoryCompletionCounts[entry.questCategory] = (categoryCompletionCounts[entry.questCategory] ?? 0) + 1
  return { ...payload, categoryCompletionCounts }
}

function invalidTransition(state: AppState, message: string): AppState { return { ...state, page: 'error', error: { code: 'transition', message, recoverable: true } } }
