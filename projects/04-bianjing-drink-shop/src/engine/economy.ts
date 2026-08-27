import type { BalanceDefinition, ShopContent, WeatherDefinition } from '../content/schema'
import type { DailyDecision, DayContext, DayForecast, DemandResolution, GameState, LedgerLine, MenuDecision, Product, ProductSale } from '../domain/types'
import type { RngState } from '../domain/rng'
import { ceilEnergy, floorMoney, roundVisitors } from '../domain/numbers'
import { allocateProductDemand } from './demand'
import { modifierAdd, modifierFactor } from './modifiers'
import { resolveOperatingMode } from './operating-mode'
import { estimateProductDemandBands } from './demand'

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
  const modified = (base * multiplier + modifierAdd(state, 'visitor-count', context.day))
    * modifierFactor(state, 'visitor-count', context.day)
  return roundVisitors(modified)
}

export function allocateDemand(
  visitors: number,
  menu: MenuDecision[],
  products: Product[],
  state: GameState,
  context: DayContext,
  balance: BalanceDefinition,
): Record<string, number> {
  return allocateProductDemand(visitors, menu, products, state, context, balance)
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
  energyDelta: number
  rngState: RngState
}

export interface OpeningBudgetEstimate {
  stockCost: number
  rentCost: number
  operatingCost: number
  cashAfterOpening: number
  projectedMinimum: number
  projectedMaximum: number
  risk: 'safe' | 'possible-debt' | 'certain-debt'
}

function calculateFixedCosts(state: GameState, context: DayContext, decision: DailyDecision, content: ShopContent) {
  const mode = content.balance.operatingModes[resolveOperatingMode(decision)]
  const operatingCost = Math.max(0, floorMoney(
    (mode.operatingCost + modifierAdd(state, 'fixed-cost', context.day))
    * modifierFactor(state, 'fixed-cost', context.day),
  ))
  return { rentCost: mode.rentCost, operatingCost }
}

function demandSales(decision: DailyDecision, demand: DemandResolution): ProductSale[] {
  return decision.menu.map((entry) => {
    const outcome = demand.products.find((item) => item.productId === entry.productId)
    const directSold = outcome?.directSold ?? 0
    const substituteSold = outcome?.substituteSold ?? 0
    const prepared = outcome?.prepared ?? Math.max(0, Math.floor(entry.prepare))
    return {
      productId: entry.productId,
      prepared,
      demand: (outcome?.directDemand ?? 0) + substituteSold,
      directSold,
      substituteSold,
      sold: directSold + substituteSold,
      stockoutLost: outcome?.stockoutLost ?? 0,
      unsold: outcome?.unsold ?? prepared - directSold - substituteSold,
      price: entry.price,
    }
  })
}

function legacyDemandResolution(decision: DailyDecision, demand: Record<string, number>): DemandResolution {
  const sales = settleSales(decision.menu, demand)
  const servedCustomers = sales.reduce((sum, sale) => sum + sale.sold, 0)
  const stockout = sales.reduce((sum, sale) => sum + Math.max(0, sale.demand - sale.sold), 0)
  return {
    potentialBuyers: servedCustomers + stockout,
    servedCustomers,
    losses: { stockout, menuMismatch: 0, price: 0, service: 0 },
    products: sales.map((sale) => ({
      productId: sale.productId,
      directDemand: sale.demand,
      directSold: sale.sold,
      substituteSold: 0,
      prepared: sale.prepared,
      unsold: sale.unsold,
      stockoutLost: Math.max(0, sale.demand - sale.sold),
    })),
  }
}

function isDemandResolution(value: DemandResolution | RngState): value is DemandResolution {
  return 'products' in value && 'losses' in value
}

export function estimateOpeningBudget(
  state: GameState,
  decision: DailyDecision,
  forecast: DayForecast,
  content: ShopContent,
): OpeningBudgetEstimate {
  const context: DayContext = {
    day: forecast.day,
    operatingDay: forecast.operatingDay,
    weatherId: forecast.weatherId,
    seasonId: forecast.seasonId,
    eventVisitorDelta: content.marketSignals.find((item) => item.signalId === forecast.marketSignalId)?.visitorDelta ?? 0,
    activeTags: forecast.activeTags,
  }
  const fixed = calculateFixedCosts(state, context, decision, content)
  const stockCost = decision.menu.reduce((sum, entry) => {
    const product = content.drinks.find((item) => item.productId === entry.productId)
    return sum + (product ? Math.max(0, Math.floor(entry.prepare)) * product.unitCost : 0)
  }, 0)
  const cashAfterOpening = state.money - stockCost - fixed.rentCost - fixed.operatingCost
  const bands = estimateProductDemandBands(state, forecast, decision, content)
  const project = (endpoint: 'minimum' | 'maximum') => decision.menu.reduce((cash, entry) => {
    const product = content.drinks.find((item) => item.productId === entry.productId)
    if (!product) return cash
    const sold = Math.min(Math.max(0, Math.floor(entry.prepare)), bands[entry.productId]?.[endpoint] ?? 0)
    const income = floorMoney(
      (sold * entry.price + modifierAdd(state, 'sales-income', context.day, entry.productId))
      * modifierFactor(state, 'sales-income', context.day, entry.productId),
    )
    const unsold = Math.max(0, Math.floor(entry.prepare) - sold)
    const returned = floorMoney(
      (unsold * product.unitCost * content.balance.shelfReturnRates[product.shelfClass]
        + modifierAdd(state, 'waste-return', context.day, entry.productId))
      * modifierFactor(state, 'waste-return', context.day, entry.productId),
    )
    return cash + income + returned
  }, cashAfterOpening)
  const projectedMinimum = project('minimum')
  const projectedMaximum = project('maximum')
  const risk: OpeningBudgetEstimate['risk'] = projectedMaximum < 0
    ? 'certain-debt'
    : projectedMinimum < 0
      ? 'possible-debt'
      : 'safe'
  return { stockCost, ...fixed, cashAfterOpening, projectedMinimum, projectedMaximum, risk }
}

export function calculateTrading(
  state: GameState,
  context: DayContext,
  decision: DailyDecision,
  content: ShopContent,
  demand: DemandResolution,
): TradingResult
export function calculateTrading(
  state: GameState,
  context: DayContext,
  decision: DailyDecision,
  content: ShopContent,
  rngState: RngState,
  demand: Record<string, number>,
): TradingResult
export function calculateTrading(
  state: GameState,
  context: DayContext,
  decision: DailyDecision,
  content: ShopContent,
  demandOrRngState: DemandResolution | RngState,
  legacyDemand?: Record<string, number>,
): TradingResult {
  const demand = isDemandResolution(demandOrRngState)
    ? demandOrRngState
    : legacyDemandResolution(decision, legacyDemand ?? {})
  const rngState = isDemandResolution(demandOrRngState) ? state.rngState : demandOrRngState
  const sales = demandSales(decision, demand)
  const ledger: LedgerLine[] = []
  let drinkEnergy = 0
  for (const sale of sales) {
    const product = content.drinks.find((item) => item.productId === sale.productId)
    if (!product) continue
    ledger.push({ kind: 'stock-cost', labelId: 'stock-cost', amount: -(sale.prepared * product.unitCost), entityId: sale.productId })
    const income = floorMoney(
      (sale.sold * sale.price + modifierAdd(state, 'sales-income', context.day, sale.productId))
      * modifierFactor(state, 'sales-income', context.day, sale.productId),
    )
    ledger.push({ kind: 'income', labelId: 'sales-income', amount: income, entityId: sale.productId })
    const wasteReturn = floorMoney(
      (sale.unsold * product.unitCost * content.balance.shelfReturnRates[product.shelfClass] + modifierAdd(state, 'waste-return', context.day, sale.productId))
      * modifierFactor(state, 'waste-return', context.day, sale.productId),
    )
    if (wasteReturn !== 0) ledger.push({ kind: 'waste-return', labelId: 'waste-return', amount: wasteReturn, entityId: sale.productId })
    drinkEnergy += sale.sold * complexityEnergy[product.complexity]
  }
  const fixed = calculateFixedCosts(state, context, decision, content)
  ledger.push({ kind: 'fixed-cost', labelId: 'daily-rent', amount: -fixed.rentCost })
  if (fixed.operatingCost !== 0) ledger.push({ kind: 'fixed-cost', labelId: 'daily-operating-cost', amount: -fixed.operatingCost })
  const moneyDelta = ledger.reduce((sum, line) => sum + line.amount, 0)
  const baseEnergyCost = content.balance.operatingModes[resolveOperatingMode(decision)].baseEnergyCost
  const energyCost = Math.max(0, ceilEnergy(
    (baseEnergyCost + drinkEnergy + modifierAdd(state, 'energy-cost', context.day))
    * modifierFactor(state, 'energy-cost', context.day),
  ))
  return { sales, ledger, moneyDelta, energyCost, energyDelta: -energyCost, rngState }
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
