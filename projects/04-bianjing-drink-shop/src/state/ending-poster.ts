import type { ShopContent } from '../content/schema'
import type { GameState, OperatingMode } from '../domain/types'

export interface EndingPosterModel {
  title: string
  endingId: string
  endingTitle: string
  endingContent: string
  evaluation: string
  shareText: string
  operatingDays: number
  totalOperatingDays: number
  calendarDays: number
  totalCalendarDays: number
  totalSold: number
  profitDays: number
  lossDays: number
  breakEvenDays: number
  netMoneyChange: number
  stats: { id: string; label: string; value: number }[]
  favoriteProduct?: { productId: string; name: string; sold: number }
  modeCounts: Record<OperatingMode, number>
  completedChains: string[]
  keyChoices: { title: string; choice: string }[]
  historyComplete: boolean
}

export function buildEndingPosterModel(state: GameState, content: ShopContent): EndingPosterModel | undefined {
  const ending = state.currentEndingId ? content.endings.find((item) => item.endingId === state.currentEndingId) : undefined
  if (!ending) return undefined
  const totals = state.campaignTotals
  const favorite = Object.entries(totals?.productSold ?? {})
    .filter(([, sold]) => sold > 0)
    .sort(([leftId, leftSold], [rightId, rightSold]) => rightSold - leftSold
      || content.drinks.findIndex((item) => item.productId === leftId) - content.drinks.findIndex((item) => item.productId === rightId))[0]
  const modeCounts = state.decisionSummaries.reduce<Record<OperatingMode, number>>((counts, summary) => ({
    ...counts,
    [summary.operatingMode]: counts[summary.operatingMode] + 1,
  }), { full: 0, half: 0, rest: 0 })
  const completedChains = Object.values(state.chainProgress)
    .filter((progress) => progress.status === 'completed')
    .map((progress) => content.chains.find((chain) => chain.chainId === progress.chainId)?.title)
    .filter((title): title is string => Boolean(title))
  const keyChoices = state.eventHistory.slice(-3).flatMap((history) => {
    const event = content.events.find((item) => item.eventId === history.eventId)
    const choice = event?.choices.find((item) => item.choiceId === history.choiceId)
    return event && choice ? [{ title: event.title, choice: choice.text }] : []
  })
  const operatingDays = totals?.trackedOperatingDays ?? state.decisionSummaries.length
  const expectedTrackedDays = state.day >= content.balance.campaign.totalCalendarDays
    ? state.operatingDay
    : Math.max(0, state.operatingDay - 1)
  return {
    title: content.ui.posterGameTitle,
    endingId: ending.endingId,
    endingTitle: ending.title,
    endingContent: ending.content,
    evaluation: ending.evaluation,
    shareText: ending.shareText,
    operatingDays,
    totalOperatingDays: content.balance.campaign.operatingDays.length,
    calendarDays: state.day,
    totalCalendarDays: content.balance.campaign.totalCalendarDays,
    totalSold: totals?.totalSold ?? 0,
    profitDays: totals?.profitDays ?? 0,
    lossDays: totals?.lossDays ?? 0,
    breakEvenDays: totals?.breakEvenDays ?? 0,
    netMoneyChange: state.money - content.balance.initial.money,
    stats: [
      { id: 'money', label: content.ui.money, value: state.money },
      { id: 'reputation', label: content.ui.reputation, value: state.reputation },
      { id: 'energy', label: content.ui.energy, value: state.energy },
      { id: 'relationships', label: content.ui.relationships, value: state.relationships },
    ],
    favoriteProduct: favorite ? {
      productId: favorite[0],
      name: content.drinks.find((item) => item.productId === favorite[0])?.name ?? favorite[0],
      sold: favorite[1],
    } : undefined,
    modeCounts,
    completedChains,
    keyChoices,
    historyComplete: Boolean(totals && totals.trackedOperatingDays === expectedTrackedDays),
  }
}
