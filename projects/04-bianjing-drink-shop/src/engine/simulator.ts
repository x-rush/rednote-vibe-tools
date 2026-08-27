import type { ShopContent } from '../content/schema'
import { shopContent } from '../content'
import type { BusinessBeat, DailyDecision, DailyResult, DayContext, DemandResolution, EventChoice, EventResolution, GameState, LedgerLine } from '../domain/types'
import { clampStat } from '../domain/numbers'
import { seedRng } from '../domain/rng'
import { advanceOperatingModifiers, applyEffects } from './effects'
import { calculateTrading, validateDecision } from './economy'
import { resolveDemand, scaleForecastDemand } from './demand'
import { resolveEnding } from './endings'
import { interruptExpiredChains, queueFollowUps, resolveChainChoice, selectDailyEvent, type EventSelection } from './events'
import { resolveOperatingMode } from './operating-mode'
import { withDayForecast } from './forecast'
import { acceptCrisisContract, advanceCrisisDay, assessFinancialHealth, availableCrisisContracts, recordContractSales, requiredFinancialPage } from './financial-health'
import { calendarDayForOperatingDay } from './campaign'

const unique = (values: string[]) => [...new Set(values)]

function selectionFields(selection: EventSelection) {
  if (selection.kind === 'event') return { selectionKind: 'event' as const, eventId: selection.eventId }
  if (selection.kind === 'chain') return {
    selectionKind: 'chain' as const,
    eventId: `${selection.chainId}-${selection.nodeId}`,
    chainId: selection.chainId,
    nodeId: selection.nodeId,
    variantId: selection.variantId,
  }
  return { selectionKind: 'none' as const }
}

function buildBusinessBeats(demand: DemandResolution): BusinessBeat[] {
  const direct = demand.products.filter((item) => item.directSold > 0)
  const substitutes = demand.products.filter((item) => item.substituteSold > 0)
  const losses = ([
    { stage: 2, kind: 'stockout', count: demand.losses.stockout },
    { stage: 2, kind: 'menu-mismatch', count: demand.losses.menuMismatch },
    { stage: 2, kind: 'price-left', count: demand.losses.price },
  ] satisfies BusinessBeat[]).filter((item) => item.count > 0)
  const candidates: Omit<BusinessBeat, 'stage'>[] = [
    ...direct.map((item) => ({ kind: 'direct-sale' as const, count: item.directSold, productId: item.productId })),
    ...substitutes.map((item) => ({ kind: 'substitute' as const, count: item.substituteSold, alternativeProductId: item.productId })),
    ...losses.map(({ stage: _stage, ...item }) => item),
  ]
  return [0, 1, 2, 3].map((stage) => ({
    stage: stage as 0 | 1 | 2 | 3,
    ...(candidates[stage] ?? { kind: 'quiet' as const, count: 0 }),
  }))
}

export function createNewGame(seed: string, saveId: string, content: ShopContent): GameState {
  const state: GameState = {
    schemaVersion: 5,
    contentVersion: shopContent.contentVersion,
    saveId,
    seed,
    rngState: seedRng(seed),
    day: 1,
    operatingDay: 1,
    page: 'morning',
    ...content.balance.initial,
    inventory: Object.fromEntries(content.drinks.map((product) => [product.productId, 0])),
    prices: Object.fromEntries(content.drinks.map((product) => [product.productId, product.basePrice])),
    unlockedProductIds: content.drinks.filter((product) => product.initiallyUnlocked).map((product) => product.productId),
    flags: [],
    triggeredEventIds: [],
    eventLastTriggeredDay: {},
    eventHistory: [],
    chainProgress: {},
    pendingEffects: [],
    modifiers: [],
    decisionSummaries: [],
    campaignTotals: { trackedOperatingDays: 0, totalSold: 0, profitDays: 0, lossDays: 0, breakEvenDays: 0, productSold: {} },
    unlockedEndingIds: [],
    negativeProfitStreak: 0,
    pendingFollowUps: [],
    financialHealth: { phase: 'normal', rescueUsed: false },
  }
  return withDayForecast(state, content)
}

export interface OpenDayResult { state: GameState; selection: EventSelection }

export function openDay(initial: GameState, decision: DailyDecision, content: ShopContent): OpenDayResult {
  if (requiredFinancialPage(initial, content)) throw new Error('请先处理周转剧情')
  const operatingMode = resolveOperatingMode(decision)
  if (initial.energy === 0 && operatingMode !== 'rest') throw new Error('体力见底，今日只能休息')
  const decisionErrors = operatingMode === 'rest'
    ? decision.menu.length === 0 ? [] : ['menu: 休息日无需备货']
    : validateDecision(decision, content.drinks)
  if (decisionErrors.length > 0) throw new Error(decisionErrors.join('；'))
  const interrupted = interruptExpiredChains(initial, content.chains)
  let state = interrupted.state
  const forecast = state.dayForecast
  if (!forecast || forecast.day !== state.day) throw new Error('今日晨间情报尚未生成')
  const signal = content.marketSignals.find((item) => item.signalId === forecast.marketSignalId)
  const context: DayContext = {
    day: state.day,
    operatingDay: state.operatingDay,
    weatherId: forecast.weatherId,
    seasonId: forecast.seasonId,
    eventVisitorDelta: (signal?.visitorDelta ?? 0)
      + state.modifiers.filter((item) => item.modifierId === 'visitor-delta' && item.expiresDay >= state.day).reduce((sum, item) => sum + item.value, 0),
    activeTags: forecast.activeTags,
  }
  const operatingForecast = scaleForecastDemand(forecast, content.balance.operatingModes[operatingMode].visitorMultiplier)
  const demand = resolveDemand(state, operatingForecast, decision, content)
  const footTraffic = demand.potentialBuyers
  const unserved = Object.values(demand.losses).reduce((sum, value) => sum + value, 0)
  const trading = calculateTrading(state, context, decision, content, demand)
  const selection = selectDailyEvent(state, context, content, operatingMode)
  const prepared = decision.menu.reduce((sum, item) => sum + item.prepare, 0)
  const averagePrice = prepared === 0 ? 0 : Math.round(decision.menu.reduce((sum, item) => sum + item.price * item.prepare, 0) / prepared)
  const opening = {
    resolutionId: `${state.saveId}-day-${state.day}-${state.rngState.value}`,
    dayContext: context,
    decision: { ...decision, operatingMode },
    visitors: footTraffic,
    operatingMode,
    footTraffic,
    buyers: demand.servedCustomers,
    unserved,
    conversionRate: footTraffic === 0 ? 0 : demand.servedCustomers / footTraffic,
    demandResolution: demand,
    businessBeats: buildBusinessBeats(demand),
    sales: trading.sales,
    ledger: trading.ledger,
    moneyDelta: trading.moneyDelta,
    energyCost: operatingMode === 'rest' ? 0 : trading.energyCost,
    energyDelta: operatingMode === 'rest' ? content.balance.operatingModes.rest.energyRecovery : trading.energyDelta,
    chainInterruptions: interrupted.interruptions,
    ...selectionFields(selection),
    rngState: selection.rngState,
  }
  state = {
    ...state,
    rngState: selection.rngState,
    page: selection.kind === 'none' ? 'settlement' : 'event',
    pendingOpening: opening,
    decisionSummaries: [...state.decisionSummaries, {
      day: state.day,
      productIds: decision.menu.map((item) => item.productId),
      prepared,
      averagePrice,
      operatingMode,
    }].slice(-30),
  }
  return { state, selection }
}

function applyDueEffects(initial: GameState) {
  let state = { ...initial, pendingEffects: initial.pendingEffects.filter((pending) => pending.dueDay > initial.day) }
  const ledger: LedgerLine[] = []
  for (const pending of initial.pendingEffects.filter((item) => item.dueDay <= initial.day)) {
    const applied = applyEffects(state, pending.effects, { day: state.day, sourceId: pending.scheduledEffectId, ledgerKind: 'scheduled' })
    state = applied.state
    if (pending.contractId && pending.contractSceneTrigger) {
      state = { ...state, pendingContractScene: { contractId: pending.contractId, trigger: pending.contractSceneTrigger } }
    }
    ledger.push(...applied.ledger)
  }
  return { state, ledger }
}

function resolveEventChoice(state: GameState, choiceId: string | undefined, content: ShopContent): {
  state: GameState
  ledger: LedgerLine[]
  eventId?: string
  choiceId?: string
  eventResolution?: EventResolution
} {
  const opening = state.pendingOpening
  if (!opening || opening.selectionKind === 'none') return { state, ledger: [] as LedgerLine[], eventId: undefined, choiceId: undefined }
  if (!choiceId) throw new Error('事件选择不能为空')
  if (opening.selectionKind === 'chain') {
    const chain = content.chains.find((item) => item.chainId === opening.chainId)
    if (!chain || !opening.nodeId) throw new Error('连锁内容引用失效')
    const applied = resolveChainChoice(state, chain, opening.nodeId, choiceId, opening.dayContext, opening.variantId)
    const eventId = opening.eventId as string
    return {
      state: applied.state,
      ledger: applied.ledger,
      eventId,
      choiceId,
      eventResolution: {
        eventId,
        choiceId,
        variantId: opening.variantId,
        moneyDelta: applied.ledger.reduce((sum, line) => sum + line.amount, 0),
        statDeltas: applied.statDeltas,
        activatedModifierIds: applied.activatedModifierIds,
        chainId: chain.chainId,
        chainStatus: applied.state.chainProgress[chain.chainId]?.status,
      },
    }
  }
  const event = content.events.find((item) => item.eventId === opening.eventId)
  const choice: EventChoice | undefined = event?.choices.find((item) => item.choiceId === choiceId)
  if (!event || !choice) throw new Error('事件或选择引用失效')
  const applied = applyEffects(state, choice.effects, { day: state.day, sourceId: event.eventId })
  const withoutConsumedFollowUp = {
    ...applied.state,
    pendingFollowUps: (applied.state.pendingFollowUps ?? []).filter((pending) => pending.eventId !== event.eventId),
  }
  const queuedState = queueFollowUps(withoutConsumedFollowUp, event.eventId, choiceId, content)
  const startedChain = choice.effects.find((effect) => effect.type === 'start-chain')
  const history = [...queuedState.eventHistory, {
    day: state.day,
    eventId: event.eventId,
    choiceId,
    moneyDelta: applied.ledger.reduce((sum, line) => sum + line.amount, 0),
    statDeltas: applied.statDeltas,
  }].slice(-content.balance.historyLimit)
  return {
    state: {
      ...queuedState,
      triggeredEventIds: unique([...queuedState.triggeredEventIds, event.eventId]),
      eventLastTriggeredDay: { ...queuedState.eventLastTriggeredDay, [event.eventId]: state.day },
      eventHistory: history,
    },
    ledger: applied.ledger,
    eventId: event.eventId,
    choiceId,
    eventResolution: {
      eventId: event.eventId,
      choiceId,
      moneyDelta: applied.ledger.reduce((sum, line) => sum + line.amount, 0),
      statDeltas: applied.statDeltas,
      activatedModifierIds: applied.activatedModifierIds,
      ...(startedChain?.type === 'start-chain' ? {
        chainId: startedChain.chainId,
        chainStatus: applied.state.chainProgress[startedChain.chainId]?.status,
      } : {}),
    },
  }
}

export function resolveDay(openedState: GameState, choiceId: string | undefined, content: ShopContent): DailyResult {
  const opening = openedState.pendingOpening
  if (!opening) throw new Error('没有待结算的营业日')
  if (openedState.lastResolutionId === opening.resolutionId) throw new Error('该营业日已经结算')
  const inventory = { ...openedState.inventory }
  opening.sales.forEach((sale) => { inventory[sale.productId] = 0 })
  const committedState: GameState = {
    ...openedState,
    money: openedState.money + opening.moneyDelta,
    energy: clampStat(openedState.energy + (opening.energyDelta ?? -opening.energyCost)),
    inventory,
    rngState: opening.rngState,
    modifiers: openedState.modifiers.filter((modifier) => modifier.expiresDay >= openedState.day),
  }
  const due = applyDueEffects(committedState)
  const event = resolveEventChoice(due.state, choiceId, content)
  let state: GameState = { ...event.state, pendingOpening: undefined, lastResolutionId: opening.resolutionId }
  const ledger = [...opening.ledger, ...due.ledger, ...event.ledger]
  const contractBaseResult: DailyResult = {
    day: opening.dayContext.day,
    operatingDay: opening.dayContext.operatingDay,
    weatherId: opening.dayContext.weatherId,
    visitors: opening.visitors,
    operatingMode: opening.operatingMode,
    sales: opening.sales,
    ledger,
    moneyDelta: ledger.reduce((sum, line) => sum + line.amount, 0),
    chainInterruptions: opening.chainInterruptions,
    nextState: state,
  }
  const beforeContractMoney = state.money
  state = recordContractSales(state, contractBaseResult, content)
  if (state.money !== beforeContractMoney) ledger.push({
    kind: 'event', labelId: 'crisis-preorder-final-payment', amount: state.money - beforeContractMoney,
    entityId: state.financialHealth?.activeContract?.contractId,
  })
  const moneyDelta = ledger.reduce((sum, line) => sum + line.amount, 0)
  const campaignTotals = state.campaignTotals ?? { trackedOperatingDays: 0, totalSold: 0, profitDays: 0, lossDays: 0, breakEvenDays: 0, productSold: {} }
  const productSold = { ...campaignTotals.productSold }
  for (const sale of opening.sales) productSold[sale.productId] = (productSold[sale.productId] ?? 0) + sale.sold
  state.campaignTotals = {
    trackedOperatingDays: campaignTotals.trackedOperatingDays + 1,
    totalSold: campaignTotals.totalSold + opening.sales.reduce((sum, sale) => sum + sale.sold, 0),
    profitDays: campaignTotals.profitDays + (moneyDelta > 0 ? 1 : 0),
    lossDays: campaignTotals.lossDays + (moneyDelta < 0 ? 1 : 0),
    breakEvenDays: campaignTotals.breakEvenDays + (moneyDelta === 0 ? 1 : 0),
    productSold,
  }
  state.negativeProfitStreak = moneyDelta < 0 ? state.negativeProfitStreak + 1 : 0
  state = advanceOperatingModifiers(state, opening.operatingMode ?? 'full')
  const completedOperatingDay = state.operatingDay
  const totalOperatingDays = content.balance.campaign.operatingDays.length
  const nextOperatingDay = Math.min(totalOperatingDays, completedOperatingDay + 1)
  state = {
    ...state,
    operatingDay: nextOperatingDay,
    day: calendarDayForOperatingDay(nextOperatingDay, content.balance.campaign),
    lastDecision: opening.decision,
  }
  if (completedOperatingDay < totalOperatingDays) state = withDayForecast(state, content)
  const crisis = advanceCrisisDay(state, content)
  state = crisis.state
  const financialAssessment = assessFinancialHealth(state, content)
  if (financialAssessment !== 'bankruptcy') {
    state = {
      ...state,
      financialHealth: {
        ...(state.financialHealth ?? { rescueUsed: false }),
        phase: financialAssessment,
      },
    }
  }
  const ending = financialAssessment === 'offer' || requiredFinancialPage(state, content) || completedOperatingDay < totalOperatingDays
    ? undefined
    : resolveEnding(state, content.endings, opening.dayContext)
  let endingId: string | undefined
  if (financialAssessment === 'offer' || requiredFinancialPage(state, content)) {
    state = { ...state, page: 'financialCrisis' }
  } else if (financialAssessment === 'bankruptcy') {
    const bankruptcy = resolveEnding(state, content.endings, opening.dayContext)
    endingId = bankruptcy?.primary.endingId ?? 'ending-closed-early'
    state = {
      ...state,
      page: 'bankruptcy',
      currentEndingId: endingId,
      unlockedEndingIds: bankruptcy ? unique([...state.unlockedEndingIds, ...bankruptcy.unlocked.map((item) => item.endingId)]) : state.unlockedEndingIds,
    }
  } else if (ending) {
    endingId = ending.primary.endingId
    state = {
      ...state,
      page: ending.primary.immediate ? 'bankruptcy' : 'finalEnding',
      currentEndingId: endingId,
      unlockedEndingIds: unique([...state.unlockedEndingIds, ...ending.unlocked.map((item) => item.endingId)]),
    }
  } else {
    state = {
      ...state,
      page: content.balance.campaign.milestoneOperatingDays.includes(completedOperatingDay) ? 'milestone' : 'morning',
    }
  }
  return {
    day: opening.dayContext.day,
    operatingDay: opening.dayContext.operatingDay,
    weatherId: opening.dayContext.weatherId,
    visitors: opening.visitors,
    operatingMode: opening.operatingMode,
    footTraffic: opening.footTraffic ?? opening.visitors,
    buyers: opening.buyers ?? opening.sales.reduce((sum, sale) => sum + sale.demand, 0),
    unserved: opening.unserved ?? 0,
    conversionRate: opening.conversionRate ?? (opening.visitors === 0 ? 0 : opening.sales.reduce((sum, sale) => sum + sale.demand, 0) / opening.visitors),
    demandResolution: opening.demandResolution,
    businessBeats: opening.businessBeats,
    energyDelta: opening.energyDelta ?? -opening.energyCost,
    sales: opening.sales,
    ledger,
    moneyDelta,
    eventId: event.eventId,
    choiceId: event.choiceId,
    eventResolution: event.eventResolution,
    chainInterruptions: opening.chainInterruptions,
    endingId,
    nextState: state,
  }
}

export type ChoiceStrategy = (state: GameState, selection: EventSelection) => string | undefined

export function simulateDay(state: GameState, decision: DailyDecision, choose: ChoiceStrategy, content: ShopContent) {
  const opened = openDay(state, decision, content)
  return resolveDay(opened.state, choose(opened.state, opened.selection), content)
}

export function simulateGame(
  initial: GameState,
  decide: (state: GameState) => DailyDecision,
  choose: ChoiceStrategy,
  content: ShopContent,
  maximumDays = content.balance.campaign.operatingDays.length,
) {
  const results: DailyResult[] = []
  let state = initial
  while (!['bankruptcy', 'finalEnding'].includes(state.page) && results.length < maximumDays) {
    if (state.page === 'financialCrisis') {
      if (state.pendingContractScene) state = { ...state, pendingContractScene: undefined, page: 'morning' }
      else {
        const contract = availableCrisisContracts(state, content)[0]
        if (!contract) {
          state = { ...state, page: 'bankruptcy', currentEndingId: 'ending-closed-early' }
          break
        }
        state = { ...acceptCrisisContract(state, contract.contractId, content).state, pendingContractScene: undefined, page: 'morning' }
      }
    }
    if (state.page === 'milestone') state = { ...state, page: 'morning' }
    const result = simulateDay(state, decide(state), choose, content)
    results.push(result)
    state = result.nextState
  }
  return { state, results }
}
