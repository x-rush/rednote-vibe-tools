import type { ShopContent } from '../content/schema'
import type { GameState } from '../domain/types'

export interface GameViewModel {
  title: string
  dayLabel: string
  stats: { id: string; label: string; value: number }[]
  products: { productId: string; name: string; basePrice: number; unitCost: number; complexity: number }[]
  event?: { id: string; title: string; content: string; assetId: string; choices: { choiceId: string; text: string; impactTags: string[] }[] }
}

export function buildGameViewModel(state: GameState, content: ShopContent): GameViewModel {
  const opening = state.pendingOpening
  let event: GameViewModel['event']
  if (opening?.selectionKind === 'event') {
    const definition = content.events.find((item) => item.eventId === opening.eventId)
    if (definition) event = {
      id: definition.eventId,
      title: definition.title,
      content: definition.content,
      assetId: definition.assetId,
      choices: definition.choices.map(({ choiceId, text, impactTags }) => ({ choiceId, text, impactTags })),
    }
  } else if (opening?.selectionKind === 'chain') {
    const chain = content.chains.find((item) => item.chainId === opening.chainId)
    const node = chain?.nodes.find((item) => item.nodeId === opening.nodeId)
    if (chain && node) event = {
      id: `${chain.chainId}-${node.nodeId}`,
      title: node.title,
      content: node.content,
      assetId: node.assetId,
      choices: node.choices.map(({ choiceId, text, impactTags }) => ({ choiceId, text, impactTags })),
    }
  }
  return {
    title: content.ui.landingTitle,
    dayLabel: `第 ${state.day} 日`,
    stats: [
      { id: 'money', label: content.ui.money, value: state.money },
      { id: 'reputation', label: content.ui.reputation, value: state.reputation },
      { id: 'energy', label: content.ui.energy, value: state.energy },
      { id: 'relationships', label: content.ui.relationships, value: state.relationships },
    ],
    products: content.drinks.filter((product) => state.unlockedProductIds.includes(product.productId)).map((product) => ({
      productId: product.productId,
      name: product.name,
      basePrice: product.basePrice,
      unitCost: product.unitCost,
      complexity: product.complexity,
    })),
    event,
  }
}
