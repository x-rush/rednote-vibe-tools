import type { BalanceDefinition, DemandSegmentDefinition, ShopContent } from '../content/schema'
import type { DailyDecision, DayContext, DayForecast, DemandBand, DemandFunnel, DemandResolution, GameState, MenuDecision, Product, ProductDemandOutcome } from '../domain/types'
import { clamp, roundVisitors } from '../domain/numbers'
import { modifierAdd, modifierFactor } from './modifiers'

function listedProducts(menu: MenuDecision[], products: Product[]) {
  return menu.flatMap((entry) => {
    const product = products.find((candidate) => candidate.productId === entry.productId)
    return product ? [{ entry, product }] : []
  })
}

function matchesContext(product: Product, context: DayContext) {
  return product.preferenceTags.some((tag) => tag === context.weatherId || tag === context.seasonId || context.activeTags.includes(tag))
}

function conversionRate(
  menu: MenuDecision[],
  products: Product[],
  state: GameState,
  context: DayContext,
  balance: BalanceDefinition,
) {
  const listed = listedProducts(menu, products)
  if (listed.length === 0) return 0
  const averagePriceRatio = listed.reduce((sum, item) => sum + item.entry.price / item.product.basePrice, 0) / listed.length
  const priceEffect = averagePriceRatio > 1
    ? -Math.min(1, (averagePriceRatio - 1) / Math.max(0.01, balance.price.maximumRatio - 1)) * balance.conversion.highPricePenalty
    : Math.min(1, (1 - averagePriceRatio) / Math.max(0.01, 1 - balance.price.minimumRatio)) * balance.conversion.lowPriceBonus
  const matchRate = listed.filter((item) => matchesContext(item.product, context)).length / listed.length
  const preferenceEffect = (matchRate * 2 - 1) * balance.conversion.preferenceBonus
  const reputationEffect = clamp(state.reputation / 100, 0, 1) * balance.conversion.reputationBonus
  const energyPenalty = (1 - clamp(state.energy / 100, 0, 1)) * balance.conversion.lowEnergyPenalty
  const varietyEffect = clamp((new Set(listed.map((item) => item.product.productId)).size - 3) / 2, 0, 1) * balance.conversion.varietyBonus
  return clamp(
    balance.conversion.baseRate + priceEffect + preferenceEffect + reputationEffect + varietyEffect - energyPenalty,
    balance.conversion.minimumRate,
    balance.conversion.maximumRate,
  )
}

function purchaseScore(menuItem: MenuDecision, product: Product, state: GameState, context: DayContext, balance: BalanceDefinition) {
  const ratioDistance = Math.abs(menuItem.price / product.basePrice - 1)
  const priceFit = clamp(1 - ratioDistance / 0.4, 0, 1)
  const preference = matchesContext(product, context) ? 1 : 0.5
  const reputation = state.reputation / 100
  const serviceCapacity = state.energy / 100 / product.complexity
  return priceFit * balance.price.weight + preference * balance.preferenceWeight + reputation * balance.reputationWeight + serviceCapacity * balance.serviceWeight
}

export function allocateProductDemand(
  buyers: number,
  menu: MenuDecision[],
  products: Product[],
  state: GameState,
  context: DayContext,
  balance: BalanceDefinition,
): Record<string, number> {
  const scored = menu.map((item) => {
    const product = products.find((candidate) => candidate.productId === item.productId)
    const baseScore = product ? purchaseScore(item, product, state, context, balance) : 0
    const score = (baseScore + modifierAdd(state, 'product-demand', context.day, item.productId))
      * modifierFactor(state, 'product-demand', context.day, item.productId)
    return { productId: item.productId, score: Math.max(0, score) }
  })
  const total = scored.reduce((sum, item) => sum + item.score, 0)
  if (total <= 0 || buyers <= 0) return Object.fromEntries(scored.map((item) => [item.productId, 0]))
  const shares = scored.map((item) => {
    const exact = buyers * item.score / total
    return { ...item, quantity: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = buyers - shares.reduce((sum, item) => sum + item.quantity, 0)
  const remainderOrder = [...shares].sort((left, right) => right.remainder - left.remainder || left.productId.localeCompare(right.productId))
  for (let index = 0; remaining > 0; index = (index + 1) % remainderOrder.length) {
    remainderOrder[index].quantity += 1
    remaining -= 1
  }
  return Object.fromEntries(shares.map((item) => [item.productId, item.quantity]))
}

export function calculateDemandFunnel(
  footTraffic: number,
  menu: MenuDecision[],
  products: Product[],
  state: GameState,
  context: DayContext,
  balance: BalanceDefinition,
): DemandFunnel {
  const safeFootTraffic = Math.max(0, Math.floor(footTraffic))
  if (safeFootTraffic === 0 || menu.length === 0) return {
    footTraffic: safeFootTraffic,
    buyers: 0,
    unserved: 0,
    conversionRate: 0,
    productDemand: Object.fromEntries(menu.map((item) => [item.productId, 0])),
  }
  const rate = conversionRate(menu, products, state, context, balance)
  const willingBuyers = roundVisitors(safeFootTraffic * rate)
  const serviceCapacity = Math.max(0, Math.floor(balance.service.baseCapacity + state.energy * balance.service.energyCapacityFactor))
  const buyers = Math.min(willingBuyers, serviceCapacity)
  return {
    footTraffic: safeFootTraffic,
    buyers,
    unserved: willingBuyers - buyers,
    conversionRate: safeFootTraffic === 0 ? 0 : buyers / safeFootTraffic,
    productDemand: allocateProductDemand(buyers, menu, products, state, context, balance),
  }
}

function allocateIntegerTotal(total: number, groups: { id: string; quantity: number }[]) {
  const safeTotal = Math.max(0, Math.min(Math.floor(total), groups.reduce((sum, group) => sum + group.quantity, 0)))
  const available = groups.reduce((sum, group) => sum + group.quantity, 0)
  if (safeTotal === 0 || available === 0) return Object.fromEntries(groups.map((group) => [group.id, 0])) as Record<string, number>
  const shares = groups.map((group, index) => {
    const exact = safeTotal * group.quantity / available
    return { ...group, index, allocated: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = safeTotal - shares.reduce((sum, group) => sum + group.allocated, 0)
  shares
    .slice()
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach((group) => {
      if (remaining <= 0) return
      group.allocated += 1
      remaining -= 1
    })
  return Object.fromEntries(shares.map((group) => [group.id, group.allocated])) as Record<string, number>
}

function matchingTagCount(product: Product, tags: string[]) {
  return tags.reduce((count, tag) => count + (product.preferenceTags.includes(tag) ? 1 : 0), 0)
}

function rankedMenuMatches(
  segment: DemandSegmentDefinition,
  tagKind: 'primary' | 'acceptable',
  decision: DailyDecision,
  products: Product[],
  state: GameState,
  day: number,
) {
  const tags = tagKind === 'primary' ? segment.primaryTags : segment.acceptableTags
  return decision.menu.flatMap((entry, index) => {
    const product = products.find((candidate) => candidate.productId === entry.productId)
    if (!product) return []
    const matches = matchingTagCount(product, tags)
    if (matches === 0) return []
    const modifiedScore = (matches + modifierAdd(state, 'product-demand', day, product.productId))
      * modifierFactor(state, 'product-demand', day, product.productId)
    return [{ entry, product, index, score: Math.max(0, modifiedScore) }]
  }).sort((left, right) => right.score - left.score || left.index - right.index || left.product.productId.localeCompare(right.product.productId))
}

function emptyOutcomes(decision: DailyDecision): ProductDemandOutcome[] {
  return decision.menu.map((entry) => ({
    productId: entry.productId,
    directDemand: 0,
    directSold: 0,
    substituteSold: 0,
    prepared: Math.max(0, Math.floor(entry.prepare)),
    unsold: Math.max(0, Math.floor(entry.prepare)),
    stockoutLost: 0,
  }))
}

export function scaleForecastDemand(forecast: DayForecast, multiplier: number): DayForecast {
  if (multiplier === 1) return forecast
  const total = forecast.demandGroups.reduce((sum, group) => sum + group.actualCustomers, 0)
  const target = roundVisitors(total * multiplier)
  const shares = forecast.demandGroups.map((group, index) => {
    const exact = total === 0 ? 0 : target * group.actualCustomers / total
    return { group, index, actualCustomers: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = target - shares.reduce((sum, item) => sum + item.actualCustomers, 0)
  shares.slice().sort((left, right) => right.remainder - left.remainder || left.index - right.index).forEach((item) => {
    if (remaining <= 0) return
    item.actualCustomers += 1
    remaining -= 1
  })
  return { ...forecast, demandGroups: shares.map((item) => ({ ...item.group, actualCustomers: item.actualCustomers })) }
}

function acceptedSubstitutions(
  customers: number,
  substitute: ReturnType<typeof rankedMenuMatches>[number],
  state: GameState,
  content: ShopContent,
) {
  const rule = content.balance.substitution
  const priceDifference = Math.max(0, substitute.entry.price / substitute.product.basePrice - 1)
  const rate = clamp(
    rule.baseRate + state.reputation / 100 * rule.reputationBonus - priceDifference * rule.priceDifferencePenalty,
    rule.minimumRate,
    rule.maximumRate,
  )
  return roundVisitors(customers * rate)
}

export function resolveDemand(
  state: GameState,
  forecast: DayForecast,
  decision: DailyDecision,
  content: ShopContent,
): DemandResolution {
  const products = emptyOutcomes(decision)
  if (decision.operatingMode === 'rest') return {
    potentialBuyers: 0,
    servedCustomers: 0,
    losses: { stockout: 0, menuMismatch: 0, price: 0, service: 0 },
    products,
  }
  const groups = content.demandSegments
    .map((segment) => ({
      segment,
      quantity: Math.max(0, Math.floor(forecast.demandGroups.find((group) => group.segmentId === segment.segmentId)?.actualCustomers ?? 0)),
    }))
    .sort((left, right) => left.segment.segmentId.localeCompare(right.segment.segmentId))
  const potentialBuyers = groups.reduce((sum, group) => sum + group.quantity, 0)
  const serviceCapacity = Math.max(0, Math.floor(content.balance.service.baseCapacity + state.energy * content.balance.service.energyCapacityFactor))
  const readyForService = Math.min(potentialBuyers, serviceCapacity)
  const servedGroups = allocateIntegerTotal(readyForService, groups.map((group) => ({ id: group.segment.segmentId, quantity: group.quantity })))
  const losses = { stockout: 0, menuMismatch: 0, price: 0, service: potentialBuyers - readyForService }
  let servedCustomers = 0

  for (const { segment } of groups) {
    const groupCustomers = servedGroups[segment.segmentId] ?? 0
    const primary = rankedMenuMatches(segment, 'primary', decision, content.drinks, state, forecast.day)[0]
    if (!primary) {
      const substitute = rankedMenuMatches(segment, 'acceptable', decision, content.drinks, state, forecast.day)[0]
      if (!substitute) {
        losses.menuMismatch += groupCustomers
        continue
      }
      if (substitute.entry.price / substitute.product.basePrice > segment.maximumPriceRatio) {
        losses.price += groupCustomers
        continue
      }
      const substituteOutcome = products.find((item) => item.productId === substitute.product.productId)
      if (!substituteOutcome) {
        losses.menuMismatch += groupCustomers
        continue
      }
      const willingToSwitch = acceptedSubstitutions(groupCustomers, substitute, state, content)
      const available = Math.max(0, substituteOutcome.prepared - substituteOutcome.directSold - substituteOutcome.substituteSold)
      const switched = Math.min(willingToSwitch, available)
      substituteOutcome.substituteSold += switched
      substituteOutcome.stockoutLost += willingToSwitch - switched
      servedCustomers += switched
      losses.stockout += willingToSwitch - switched
      losses.menuMismatch += groupCustomers - willingToSwitch
      continue
    }
    const primaryOutcome = products.find((item) => item.productId === primary.product.productId)
    if (!primaryOutcome) {
      losses.menuMismatch += groupCustomers
      continue
    }
    const substitutes = rankedMenuMatches(segment, 'acceptable', decision, content.drinks, state, forecast.day)
      .filter((item) => item.product.productId !== primary.product.productId)
    const directCapacity = Math.max(0, primaryOutcome.prepared - primaryOutcome.directSold - primaryOutcome.substituteSold)
    const substitute = substitutes[0]
    const customersNeedingSubstitute = Math.max(0, groupCustomers - directCapacity)
    const willingToSwitch = substitute ? acceptedSubstitutions(customersNeedingSubstitute, substitute, state, content) : 0
    let substitutionAttempts = 0
    for (let customer = 0; customer < groupCustomers; customer += 1) {
      primaryOutcome.directDemand += 1
      if (primary.entry.price / primary.product.basePrice > segment.maximumPriceRatio) {
        losses.price += 1
        continue
      }
      if (primaryOutcome.directSold + primaryOutcome.substituteSold < primaryOutcome.prepared) {
        primaryOutcome.directSold += 1
        servedCustomers += 1
        continue
      }
      if (!substitute) {
        primaryOutcome.stockoutLost += 1
        losses.stockout += 1
        continue
      }
      if (substitute.entry.price / substitute.product.basePrice > segment.maximumPriceRatio) {
        losses.price += 1
        continue
      }
      substitutionAttempts += 1
      if (substitutionAttempts > willingToSwitch) {
        primaryOutcome.stockoutLost += 1
        losses.stockout += 1
        continue
      }
      const substituteOutcome = products.find((item) => item.productId === substitute.product.productId)
      if (!substituteOutcome || substituteOutcome.directSold + substituteOutcome.substituteSold >= substituteOutcome.prepared) {
        primaryOutcome.stockoutLost += 1
        losses.stockout += 1
        continue
      }
      substituteOutcome.substituteSold += 1
      servedCustomers += 1
    }
  }
  products.forEach((outcome) => {
    outcome.unsold = outcome.prepared - outcome.directSold - outcome.substituteSold
  })
  return { potentialBuyers, servedCustomers, losses, products }
}

export function estimateProductDemandBands(
  state: GameState,
  forecast: DayForecast,
  decision: DailyDecision,
  content: ShopContent,
): Record<string, DemandBand> {
  const unscaledForecast: DayForecast = {
    ...forecast,
    demandGroups: forecast.demandGroups.map((group) => ({ ...group, actualCustomers: group.expectedCustomers })),
  }
  const expectedForecast = scaleForecastDemand(
    unscaledForecast,
    content.balance.operatingModes[decision.operatingMode].visitorMultiplier,
  )
  const enoughForEveryCustomer = expectedForecast.demandGroups.reduce((sum, group) => sum + group.expectedCustomers, 0)
  const planningDecision: DailyDecision = {
    ...decision,
    menu: decision.menu.map((entry) => ({ ...entry, prepare: enoughForEveryCustomer })),
  }
  const resolution = resolveDemand(state, expectedForecast, planningDecision, content)
  const padding = Math.max(0, Math.floor(content.balance.forecast.bandPadding))
  return Object.fromEntries(decision.menu.map((entry) => {
    const outcome = resolution.products.find((item) => item.productId === entry.productId)
    const center = (outcome?.directSold ?? 0) + (outcome?.substituteSold ?? 0)
    const tendency: DemandBand['tendency'] = center === 0 || center + padding < entry.prepare
      ? 'quiet'
      : center > entry.prepare
        ? 'hot'
        : 'steady'
    return [entry.productId, {
      minimum: Math.max(0, center - padding),
      maximum: center + padding,
      tendency,
    }]
  }))
}
