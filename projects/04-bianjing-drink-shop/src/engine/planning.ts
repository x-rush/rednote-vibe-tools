import type { ShopContent } from '../content/schema'
import type { DailyDecision, DayForecast, GameState, Product } from '../domain/types'
import { estimateProductDemandBands } from './demand'
import { estimateOpeningBudget } from './economy'

const restPlan = (strategyId: string): DailyDecision => ({ menu: [], operatingMode: 'rest', strategyId })

function boundedEntry(entry: DailyDecision['menu'][number], product: Product) {
  const minimumPrice = Math.ceil(product.basePrice * 0.8)
  const maximumPrice = Math.floor(product.basePrice * 1.4)
  return {
    productId: entry.productId,
    prepare: Math.max(0, Math.min(12, Math.round(entry.prepare))),
    price: Math.max(minimumPrice, Math.min(maximumPrice, Math.round(entry.price))),
  }
}

export function reuseLastDecision(state: GameState, content: ShopContent): DailyDecision | undefined {
  const previous = state.lastDecision
  if (!previous) return undefined
  if (previous.operatingMode === 'rest') return restPlan('reuse-yesterday-rest')
  const seen = new Set<string>()
  const menu = previous.menu.flatMap((entry) => {
    if (seen.has(entry.productId) || !state.unlockedProductIds.includes(entry.productId)) return []
    const product = content.drinks.find((item) => item.productId === entry.productId)
    if (!product) return []
    seen.add(entry.productId)
    return [boundedEntry(entry, product)]
  }).slice(0, 5)
  if (menu.length < 3) return undefined
  return { menu, operatingMode: previous.operatingMode, strategyId: 'reuse-yesterday' }
}

function productForecastScore(product: Product, forecast: DayForecast, content: ShopContent) {
  const segmentScore = forecast.demandGroups.reduce((score, group) => {
    const segment = content.demandSegments.find((item) => item.segmentId === group.segmentId)
    if (!segment) return score
    const primaryMatches = segment.primaryTags.filter((tag) => product.preferenceTags.includes(tag)).length
    const acceptableMatches = segment.acceptableTags.filter((tag) => product.preferenceTags.includes(tag)).length
    return score + group.expectedCustomers * (primaryMatches * 2 + acceptableMatches * 0.5)
  }, 0)
  return segmentScore + product.preferenceTags.filter((tag) => forecast.activeTags.includes(tag)).length
}

export function recommendDecision(state: GameState, forecast: DayForecast, content: ShopContent): DailyDecision {
  if (state.energy === 0) return restPlan('ayuan-rest-energy')
  const selected = content.drinks
    .filter((product) => state.unlockedProductIds.includes(product.productId))
    .map((product) => ({ product, score: productForecastScore(product, forecast, content) }))
    .sort((left, right) => right.score - left.score
      || left.product.unitCost - right.product.unitCost
      || left.product.productId.localeCompare(right.product.productId))
    .slice(0, 3)
    .map((item) => item.product)
  if (selected.length < 3) return restPlan('ayuan-rest-menu')

  const operatingMode = state.energy < 25 ? 'half' : 'full'
  const seedDecision: DailyDecision = {
    operatingMode,
    strategyId: 'ayuan-recommendation',
    menu: selected.map((product) => ({ productId: product.productId, prepare: 1, price: product.basePrice })),
  }
  const bands = estimateProductDemandBands(state, forecast, seedDecision, content)
  const decision: DailyDecision = {
    ...seedDecision,
    menu: seedDecision.menu.map((entry) => {
      const band = bands[entry.productId]
      const midpoint = band ? Math.round((band.minimum + band.maximum) / 2) : 1
      return { ...entry, prepare: Math.max(1, Math.min(6, midpoint)) }
    }),
  }

  while (estimateOpeningBudget(state, decision, forecast, content).cashAfterOpening < 0) {
    const reducible = decision.menu
      .map((entry, index) => ({ entry, index, cost: content.drinks.find((item) => item.productId === entry.productId)?.unitCost ?? 0 }))
      .filter((item) => item.entry.prepare > 1)
      .sort((left, right) => right.cost - left.cost || left.index - right.index)[0]
    if (!reducible) return restPlan('ayuan-rest-cash')
    decision.menu[reducible.index] = { ...decision.menu[reducible.index], prepare: decision.menu[reducible.index].prepare - 1 }
  }
  return decision
}
