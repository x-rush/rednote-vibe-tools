import type { ShopContent } from '../content/schema'
import type { DailyDecision, EventChoice, EventEffect, GameState, Product } from '../domain/types'
import type { EventSelection } from './events'
import { createNewGame, simulateGame, type ChoiceStrategy } from './simulator'

export type AuditStrategy = 'steady' | 'max-price' | 'overstock' | 'aggressive-full' | 'balanced-rest'

export interface BalanceAuditSummary {
  totalRuns: number
  routeTotals: Record<AuditStrategy, number>
  campaignSurvivorsByStrategy: Record<AuditStrategy, number>
  bankruptcyRate: number
  bankruptcyRateByStrategy: Record<AuditStrategy, number>
  turnTenMoneyMedians: Record<AuditStrategy, number>
  averageEventsByStrategy: Record<AuditStrategy, number>
  negativeDayRateByStrategy: Record<AuditStrategy, number>
  endingDistribution: Record<string, number>
  endingDistributionByStrategy: Record<AuditStrategy, Record<string, number>>
  moneyMedian: number
  zeroEnergyRate: number
  maxSingleEndingShareByStrategy: number
  deterministicReplay: boolean
  routeMedians: Record<AuditStrategy, { money: number; reputation: number; energy: number; relationships: number }>
}

const strategies: AuditStrategy[] = ['steady', 'max-price', 'overstock', 'aggressive-full', 'balanced-rest']

function availableProducts(state: GameState, content: ShopContent): Product[] {
  return content.drinks.filter((product) => state.unlockedProductIds.includes(product.productId))
}

function zeroStockDecision(strategyId: AuditStrategy): DailyDecision {
  return {
    menu: [],
    operatingMode: 'rest',
    strategyId,
  }
}

function decisionFor(strategy: AuditStrategy, state: GameState, content: ShopContent): DailyDecision {
  if (state.energy === 0) return zeroStockDecision(strategy)
  if ((strategy === 'steady' || strategy === 'max-price' || strategy === 'balanced-rest') && state.energy < 25) return zeroStockDecision(strategy)

  const products = availableProducts(state, content)
  const ordered = [...products].sort((left, right) => {
    if (strategy === 'aggressive-full') return (right.basePrice - right.unitCost) - (left.basePrice - left.unitCost) || right.complexity - left.complexity
    return left.complexity - right.complexity || (right.basePrice - right.unitCost) - (left.basePrice - left.unitCost)
  }).slice(0, strategy === 'overstock' || strategy === 'aggressive-full' ? 5 : 3)
  const prepare = strategy === 'overstock' ? 12 : strategy === 'aggressive-full' ? 8 : strategy === 'max-price' ? 1 : 3
  const operatingMode = strategy === 'balanced-rest' && state.energy < 45 ? 'half' : 'full'
  return {
    menu: ordered.map((product) => ({
      productId: product.productId,
      prepare,
      price: strategy === 'max-price'
        ? Math.floor(product.basePrice * content.balance.price.maximumRatio)
        : strategy === 'aggressive-full' ? Math.round(product.basePrice * 1.1) : product.basePrice,
    })),
    operatingMode,
    strategyId: strategy,
  }
}

function effectsValue(effects: EventEffect[], strategy: AuditStrategy): number {
  return effects.reduce((score, effect) => {
    if (effect.type === 'money-delta') return score + effect.value * (strategy === 'max-price' || strategy === 'overstock' || strategy === 'aggressive-full' ? 5 : 2)
    if (effect.type === 'stat-delta') {
      const weights = {
        reputation: strategy === 'steady' || strategy === 'balanced-rest' ? 6 : 2,
        relationships: strategy === 'steady' || strategy === 'balanced-rest' ? 6 : 2,
        energy: strategy === 'balanced-rest' ? 10 : strategy === 'steady' ? 6 : 2,
      }
      return score + effect.value * weights[effect.stat]
    }
    if (effect.type === 'schedule-effect') return score + effectsValue(effect.effects, strategy) * 0.7
    if (effect.type === 'start-chain' || effect.type === 'advance-chain' || effect.type === 'unlock-product') return score + 8
    if (effect.type === 'interrupt-chain') return score - 8
    if (effect.type === 'set-modifier') {
      const direction = effect.operation === 'multiply' ? effect.value - 1 : effect.value
      const targetBenefitsProfit = ['visitor-count', 'sales-income', 'waste-return', 'product-demand'].includes(effect.target)
      const targetIsCost = ['fixed-cost', 'energy-cost'].includes(effect.target)
      return score + direction * effect.durationDays * (targetIsCost ? -4 : targetBenefitsProfit ? 4 : 1)
    }
    return score
  }, 0)
}

function selectionChoices(selection: EventSelection): EventChoice[] {
  if (selection.kind === 'event') return selection.event.choices
  if (selection.kind === 'chain') return selection.node.choices
  return []
}

function chooserFor(strategy: AuditStrategy): ChoiceStrategy {
  return (_state, selection) => [...selectionChoices(selection)]
    .sort((left, right) => effectsValue(right.effects, strategy) - effectsValue(left.effects, strategy) || left.choiceId.localeCompare(right.choiceId))[0]?.choiceId
}

function runRoute(content: ShopContent, strategy: AuditStrategy, seedIndex: number) {
  const seed = `balance-${strategy}-${seedIndex}`
  return simulateGame(
    createNewGame(seed, `audit-${strategy}-${seedIndex}`, content),
    (state) => decisionFor(strategy, state, content),
    chooserFor(strategy),
    content,
  )
}

const rate = (count: number, total: number) => total === 0 ? 0 : count / total
const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function runBalanceAudit(content: ShopContent, seedsPerStrategy: number): BalanceAuditSummary {
  const routeTotals = Object.fromEntries(strategies.map((strategy) => [strategy, 0])) as Record<AuditStrategy, number>
  const campaignSurvivorsByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, 0])) as Record<AuditStrategy, number>
  const endingDistribution: Record<string, number> = {}
  const endingByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, {}])) as Record<AuditStrategy, Record<string, number>>
  const statesByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, [] as GameState[]])) as Record<AuditStrategy, GameState[]>
  const turnTenMoneyByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, [] as number[]])) as Record<AuditStrategy, number[]>
  const eventsByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, 0])) as Record<AuditStrategy, number>
  const bankruptcyByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, 0])) as Record<AuditStrategy, number>
  const negativeDaysByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, 0])) as Record<AuditStrategy, number>
  const playedDaysByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, 0])) as Record<AuditStrategy, number>
  const terminalStates: GameState[] = []
  let bankruptcies = 0
  let zeroEnergy = 0

  for (const strategy of strategies) {
    for (let seedIndex = 0; seedIndex < seedsPerStrategy; seedIndex += 1) {
      const run = runRoute(content, strategy, seedIndex)
      const endingId = run.state.currentEndingId ?? 'unresolved'
      routeTotals[strategy] += 1
      endingDistribution[endingId] = (endingDistribution[endingId] ?? 0) + 1
      endingByStrategy[strategy][endingId] = (endingByStrategy[strategy][endingId] ?? 0) + 1
      if (run.state.page === 'bankruptcy') { bankruptcies += 1; bankruptcyByStrategy[strategy] += 1 }
      if (run.state.page === 'finalEnding' && run.state.day === content.balance.campaign.totalCalendarDays) campaignSurvivorsByStrategy[strategy] += 1
      if (run.state.energy === 0) zeroEnergy += 1
      terminalStates.push(run.state)
      statesByStrategy[strategy].push(run.state)
      const firstTenTurns = run.results.filter((result) => result.operatingDay <= 10)
      turnTenMoneyByStrategy[strategy].push(firstTenTurns.at(-1)?.nextState.money ?? run.state.money)
      eventsByStrategy[strategy] += run.results.filter((result) => result.eventId !== undefined).length
      negativeDaysByStrategy[strategy] += run.results.filter((result) => result.moneyDelta < 0).length
      playedDaysByStrategy[strategy] += run.results.length
    }
  }

  const totalRuns = terminalStates.length
  const moneyMedian = median(terminalStates.map((state) => state.money))
  const maxSingleEndingShareByStrategy = Math.max(...strategies.map((strategy) =>
    rate(Math.max(0, ...Object.values(endingByStrategy[strategy])), routeTotals[strategy])))
  const deterministicReplay = strategies.every((strategy) => {
    const original = terminalStates[strategies.indexOf(strategy) * seedsPerStrategy]
    return JSON.stringify(runRoute(content, strategy, 0).state) === JSON.stringify(original)
  })
  const routeMedians = Object.fromEntries(strategies.map((strategy) => [strategy, {
    money: median(statesByStrategy[strategy].map((state) => state.money)),
    reputation: median(statesByStrategy[strategy].map((state) => state.reputation)),
    energy: median(statesByStrategy[strategy].map((state) => state.energy)),
    relationships: median(statesByStrategy[strategy].map((state) => state.relationships)),
  }])) as BalanceAuditSummary['routeMedians']
  const bankruptcyRateByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, rate(bankruptcyByStrategy[strategy], routeTotals[strategy])])) as Record<AuditStrategy, number>
  const turnTenMoneyMedians = Object.fromEntries(strategies.map((strategy) => [strategy, median(turnTenMoneyByStrategy[strategy])])) as Record<AuditStrategy, number>
  const averageEventsByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, eventsByStrategy[strategy] / routeTotals[strategy]])) as Record<AuditStrategy, number>
  const negativeDayRateByStrategy = Object.fromEntries(strategies.map((strategy) => [strategy, rate(negativeDaysByStrategy[strategy], playedDaysByStrategy[strategy])])) as Record<AuditStrategy, number>

  return {
    totalRuns,
    routeTotals,
    campaignSurvivorsByStrategy,
    bankruptcyRate: rate(bankruptcies, totalRuns),
    bankruptcyRateByStrategy,
    turnTenMoneyMedians,
    averageEventsByStrategy,
    negativeDayRateByStrategy,
    endingDistribution,
    endingDistributionByStrategy: endingByStrategy,
    moneyMedian,
    zeroEnergyRate: rate(zeroEnergy, totalRuns),
    maxSingleEndingShareByStrategy,
    deterministicReplay,
    routeMedians,
  }
}
