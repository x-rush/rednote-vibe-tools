import type { BalanceDefinition, ShopContent, WeatherDefinition } from '../content/schema'
import type { DailyDecision, DayContext, GameState, LedgerLine, MenuDecision, Product, ProductSale } from '../domain/types'
import type { RngState } from '../domain/rng'
import { ceilEnergy, clamp, floorMoney, roundVisitors } from '../domain/numbers'

const complexityEnergy: Record<Product['complexity'], number> = { 1: 0.5, 2: 0.8, 3: 1.1 }

export function calculateVisitors(
  state: GameState,
  context: DayContext,
  balance: BalanceDefinition,
  weather: WeatherDefinition[],
): number {
  const stage = balance.stageBaseVisitors.find((item) => context.day >= item.dayRange[0] && context.day <= item.dayRange[1])
  const rule = balance.reputation
  const linearReputation = Math.min(state.reputation, rule.linearUntil) / rule.pointsPerVisitor
  const diminishing = Math.max(0, state.reputation - rule.linearUntil) / rule.afterThresholdDivisor
  const base = (stage?.visitors ?? 0) + linearReputation + diminishing + context.eventVisitorDelta
  const multiplier = weather.find((item) => item.weatherId === context.weatherId)?.visitorMultiplier ?? 1
  return roundVisitors(base * multiplier)
}

function purchaseScore(menuItem: MenuDecision, product: Product, state: GameState, context: DayContext, balance: BalanceDefinition) {
  const ratioDistance = Math.abs(menuItem.price / product.basePrice - 1)
  const priceFit = clamp(1 - ratioDistance / 0.4, 0, 1)
  const preference = product.preferenceTags.some((tag) =>
    tag === context.weatherId || tag === context.seasonId || context.activeTags.includes(tag)) ? 1 : 0.5
  const reputation = state.reputation / 100
  const serviceCapacity = state.energy / 100 / product.complexity
  return priceFit * balance.price.weight + preference * balance.preferenceWeight + reputation * balance.reputationWeight + serviceCapacity * balance.serviceWeight
}

export function allocateDemand(
  visitors: number,
  menu: MenuDecision[],
  products: Product[],
  state: GameState,
  context: DayContext,
  balance: BalanceDefinition,
): Record<string, number> {
  const scored = menu.map((item) => {
    const product = products.find((candidate) => candidate.productId === item.productId)
    return { productId: item.productId, score: product ? Math.max(0, purchaseScore(item, product, state, context, balance)) : 0 }
  })
  const total = scored.reduce((sum, item) => sum + item.score, 0)
  if (total <= 0) return Object.fromEntries(scored.map((item) => [item.productId, 0]))
  const shares = scored.map((item) => {
    const exact = visitors * item.score / total
    return { ...item, quantity: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = visitors - shares.reduce((sum, item) => sum + item.quantity, 0)
  const remainderOrder = [...shares].sort((left, right) => right.remainder - left.remainder || left.productId.localeCompare(right.productId))
  for (let index = 0; remaining > 0; index = (index + 1) % remainderOrder.length) {
    remainderOrder[index].quantity += 1
    remaining -= 1
  }
  return Object.fromEntries(shares.map((item) => [item.productId, item.quantity]))
}

export function settleSales(menu: MenuDecision[], demand: Record<string, number>): ProductSale[] {
  return menu.map((item) => {
    const wanted = Math.max(0, Math.floor(demand[item.productId] ?? 0))
    const prepared = Math.max(0, Math.floor(item.prepare))
    const sold = Math.min(wanted, prepared)
    return { productId: item.productId, prepared, demand: wanted, sold, unsold: prepared - sold, price: item.price }
  })
}

export interface TradingResult {
  sales: ProductSale[]
  ledger: LedgerLine[]
  moneyDelta: number
  energyCost: number
  rngState: RngState
}

export function calculateTrading(
  state: GameState,
  context: DayContext,
  decision: DailyDecision,
  content: ShopContent,
  rngState: RngState,
  demand: Record<string, number>,
): TradingResult {
  const sales = settleSales(decision.menu, demand)
  const ledger: LedgerLine[] = []
  let drinkEnergy = 0
  for (const sale of sales) {
    const product = content.drinks.find((item) => item.productId === sale.productId)
    if (!product) continue
    ledger.push({ kind: 'stock-cost', labelId: 'stock-cost', amount: -(sale.prepared * product.unitCost), entityId: sale.productId })
    ledger.push({ kind: 'income', labelId: 'sales-income', amount: sale.sold * sale.price, entityId: sale.productId })
    const wasteReturn = floorMoney(sale.unsold * product.unitCost * product.keepRate)
    if (wasteReturn !== 0) ledger.push({ kind: 'waste-return', labelId: 'waste-return', amount: wasteReturn, entityId: sale.productId })
    drinkEnergy += sale.sold * complexityEnergy[product.complexity]
  }
  const activeModifiers = state.modifiers.filter((item) => item.expiresDay >= context.day)
  for (const modifier of activeModifiers.filter((item) => ['stage-money', 'apprentice-wage', 'profit-margin'].includes(item.modifierId))) {
    ledger.push({ kind: 'event', labelId: `modifier-${modifier.modifierId}`, amount: modifier.value, entityId: modifier.modifierId })
  }
  ledger.push({ kind: 'fixed-cost', labelId: 'daily-fixed-cost', amount: -content.balance.dailyFixedCost })
  const moneyDelta = ledger.reduce((sum, line) => sum + line.amount, 0)
  const restProtection = decision.closeEarly ? content.balance.earlyCloseEnergyProtection : 0
  const energyModifier = activeModifiers.filter((item) => item.modifierId.includes('energy')).reduce((sum, item) => sum + item.value, 0)
  const energyCost = Math.max(0, ceilEnergy(content.balance.baseOpenEnergy + drinkEnergy - restProtection - energyModifier))
  return { sales, ledger, moneyDelta, energyCost, rngState }
}

export function validateDecision(decision: DailyDecision, products: Product[]): string[] {
  const errors: string[] = []
  if (decision.menu.length < 3 || decision.menu.length > 5) errors.push('menu: 今日须上架 3–5 种饮子')
  const seen = new Set<string>()
  decision.menu.forEach((item) => {
    if (seen.has(item.productId)) errors.push(`${item.productId}: 今日菜单不能重复`)
    seen.add(item.productId)
    const product = products.find((candidate) => candidate.productId === item.productId)
    if (!product) {
      errors.push(`${item.productId}: 饮子不存在`)
      return
    }
    if (!Number.isInteger(item.prepare) || item.prepare < 0 || item.prepare > 12) errors.push(`${item.productId}.prepare: 备货量须为 0–12 的整数`)
    const minimum = Math.ceil(product.basePrice * 0.8)
    const maximum = Math.floor(product.basePrice * 1.4)
    if (!Number.isInteger(item.price) || item.price < minimum || item.price > maximum) errors.push(`${item.productId}.price: 售价须在基准价 80%–140% 的整数范围`)
  })
  return errors
}
