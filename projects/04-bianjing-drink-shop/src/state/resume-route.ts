import type { ShopContent } from '../content/schema'
import type { EventTiming, GameState, PageState } from '../domain/types'
import { requiredFinancialPage } from '../engine/financial-health'

export type ResumeDisplayPage = PageState | 'business'

export interface ResumeRoute {
  displayPage: ResumeDisplayPage
  eventTiming?: EventTiming
}

const nonPlayablePages = new Set<PageState>(['landing', 'newGame', 'tutorial', 'continueGame', 'error'])

export function pendingEventTiming(state: GameState, content: ShopContent): EventTiming | undefined {
  const opening = state.pendingOpening
  if (!opening || opening.selectionKind === 'none') return undefined
  if (opening.selectionKind === 'event') {
    return content.events.find((event) => event.eventId === opening.eventId)?.scene.timing ?? 'closing'
  }
  return content.chains
    .find((chain) => chain.chainId === opening.chainId)
    ?.nodes.find((node) => node.nodeId === opening.nodeId)?.scene.timing ?? 'closing'
}

export function resolveResumeRoute(state: GameState, content: ShopContent): ResumeRoute {
  if (state.page === 'financialCrisis' || requiredFinancialPage(state, content)) return { displayPage: 'financialCrisis' }
  const eventTiming = pendingEventTiming(state, content)
  if (!eventTiming) {
    return { displayPage: nonPlayablePages.has(state.page) ? 'morning' : state.page }
  }
  return {
    displayPage: eventTiming === 'business' ? 'business' : 'event',
    eventTiming,
  }
}
