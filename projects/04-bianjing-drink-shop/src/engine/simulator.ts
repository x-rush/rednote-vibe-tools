import type { ShopContent, WeatherDefinition } from '../content/schema'
import type { DailyDecision, DailyResult, DayContext, EventChoice, GameState, LedgerLine } from '../domain/types'
import { clampStat, roundVisitors } from '../domain/numbers'
import { nextRandom, seedRng } from '../domain/rng'
import { applyEffects } from './effects'
import { allocateDemand, calculateTrading, calculateVisitors, validateDecision } from './economy'
import { resolveEnding } from './endings'
import { interruptExpiredChains, resolveChainChoice, selectDailyEvent, type EventSelection } from './events'

const milestones = new Set([10, 30, 60, 90])
const unique = (values: string[]) => [...new Set(values)]

function selectWeather(state: GameState, weather: WeatherDefinition[]) {
  const random = nextRandom(state.rngState)
  const total = weather.reduce((sum, item) => sum + item.weight, 0)
  let target = random.value * total
  const selected = weather.find((item) => {
    target -= item.weight
    return target < 0
  }) ?? weather[0]
  return { weather: selected, rngState: random.state }
}

function selectionFields(selection: EventSelection) {
  if (selection.kind === 'event') return { selectionKind: 'event' as const, eventId: selection.eventId }
  if (selection.kind === 'chain') return { selectionKind: 'chain' as const, eventId: `${selection.chainId}-${selection.nodeId}`, chainId: selection.chainId, nodeId: selection.nodeId }
  return { selectionKind: 'none' as const }
}

export function createNewGame(seed: string, saveId: string, content: ShopContent): GameState {
  return {
    schemaVersion: 1,
    contentVersion: '1.0.0-foundation',
    saveId,
    seed,
    rngState: seedRng(seed),
    day: 1,
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
    unlockedEndingIds: [],
    negativeProfitStreak: 0,
  }
}

export interface OpenDayResult { state: GameState; selection: EventSelection }

export function openDay(initial: GameState, decision: DailyDecision, content: ShopContent): OpenDayResult {
  if (initial.energy === 0 && !decision.closeEarly) throw new Error('体力为 0 时必须提前打烊休息半日')
  const decisionErrors = validateDecision(decision, content.drinks)
  if (decisionErrors.length > 0) throw new Error(decisionErrors.join('；'))
  let state = interruptExpiredChains(initial, content.chains)
  const season = content.seasons.find((item) => state.day >= item.dayRange[0] && state.day <= item.dayRange[1]) ?? content.seasons[0]
  const weatherRoll = selectWeather(state, content.weather)
  state = { ...state, rngState: weatherRoll.rngState }
  const context: DayContext = {
    day: state.day,
    weatherId: weatherRoll.weather.weatherId,
    seasonId: season.seasonId,
    eventVisitorDelta: state.modifiers.filter((item) => item.modifierId === 'visitor-delta' && item.expiresDay >= state.day).reduce((sum, item) => sum + item.value, 0),
    activeTags: [weatherRoll.weather.weatherId, season.seasonId, ...season.tags],
  }
  const unprotectedVisitors = calculateVisitors(state, context, content.balance, content.weather)
  const visitors = decision.closeEarly ? roundVisitors(unprotectedVisitors * content.balance.earlyCloseVisitorMultiplier) : unprotectedVisitors
  const demand = allocateDemand(visitors, decision.menu, content.drinks, state, context, content.balance)
  const trading = calculateTrading(state, context, decision, content, state.rngState, demand)
  const inventory = { ...state.inventory }
  trading.sales.forEach((sale) => { inventory[sale.productId] = 0 })
  state = {
    ...state,
    money: state.money + trading.moneyDelta,
    energy: clampStat(state.energy - trading.energyCost),
    inventory,
    rngState: trading.rngState,
    modifiers: state.modifiers.filter((item) => item.expiresDay >= state.day),
  }
  const selection = selectDailyEvent(state, context, content)
  const prepared = decision.menu.reduce((sum, item) => sum + item.prepare, 0)
  const averagePrice = prepared === 0 ? 0 : Math.round(decision.menu.reduce((sum, item) => sum + item.price * item.prepare, 0) / prepared)
  const opening = {
    resolutionId: `${state.saveId}-day-${state.day}-${state.rngState.value}`,
    dayContext: context,
    decision,
    visitors,
    sales: trading.sales,
    ledger: trading.ledger,
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
      closeEarly: decision.closeEarly,
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
    ledger.push(...applied.ledger)
  }
  return { state, ledger }
}

function resolveEventChoice(state: GameState, choiceId: string | undefined, content: ShopContent) {
  const opening = state.pendingOpening
  if (!opening || opening.selectionKind === 'none') return { state, ledger: [] as LedgerLine[], eventId: undefined, choiceId: undefined }
  if (!choiceId) throw new Error('事件选择不能为空')
  if (opening.selectionKind === 'chain') {
    const chain = content.chains.find((item) => item.chainId === opening.chainId)
    if (!chain || !opening.nodeId) throw new Error('连锁内容引用失效')
    const applied = resolveChainChoice(state, chain, opening.nodeId, choiceId)
    return { state: applied.state, ledger: applied.ledger, eventId: opening.eventId, choiceId }
  }
  const event = content.events.find((item) => item.eventId === opening.eventId)
  const choice: EventChoice | undefined = event?.choices.find((item) => item.choiceId === choiceId)
  if (!event || !choice) throw new Error('事件或选择引用失效')
  const applied = applyEffects(state, choice.effects, { day: state.day, sourceId: event.eventId })
  const history = [...applied.state.eventHistory, {
    day: state.day,
    eventId: event.eventId,
    choiceId,
    moneyDelta: applied.ledger.reduce((sum, line) => sum + line.amount, 0),
    statDeltas: applied.statDeltas,
  }].slice(-content.balance.historyLimit)
  return {
    state: {
      ...applied.state,
      triggeredEventIds: unique([...applied.state.triggeredEventIds, event.eventId]),
      eventLastTriggeredDay: { ...applied.state.eventLastTriggeredDay, [event.eventId]: state.day },
      eventHistory: history,
    },
    ledger: applied.ledger,
    eventId: event.eventId,
    choiceId,
  }
}

export function resolveDay(openedState: GameState, choiceId: string | undefined, content: ShopContent): DailyResult {
  const opening = openedState.pendingOpening
  if (!opening) throw new Error('没有待结算的营业日')
  if (openedState.lastResolutionId === opening.resolutionId) throw new Error('该营业日已经结算')
  const due = applyDueEffects(openedState)
  const event = resolveEventChoice(due.state, choiceId, content)
  let state = { ...event.state, pendingOpening: undefined, lastResolutionId: opening.resolutionId }
  const ledger = [...opening.ledger, ...due.ledger, ...event.ledger]
  const moneyDelta = ledger.reduce((sum, line) => sum + line.amount, 0)
  state.negativeProfitStreak = moneyDelta < 0 ? state.negativeProfitStreak + 1 : 0
  const ending = resolveEnding(state, content.endings)
  let endingId: string | undefined
  if (ending) {
    endingId = ending.primary.endingId
    state = {
      ...state,
      page: ending.primary.immediate ? 'bankruptcy' : 'finalEnding',
      currentEndingId: endingId,
      unlockedEndingIds: unique([...state.unlockedEndingIds, ...ending.unlocked.map((item) => item.endingId)]),
    }
  } else {
    const completedDay = state.day
    state = { ...state, day: Math.min(100, state.day + 1), page: milestones.has(completedDay) ? 'milestone' : 'morning' }
  }
  return {
    day: opening.dayContext.day,
    weatherId: opening.dayContext.weatherId,
    visitors: opening.visitors,
    sales: opening.sales,
    ledger,
    moneyDelta,
    eventId: event.eventId,
    choiceId: event.choiceId,
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
  maximumDays = 100,
) {
  const results: DailyResult[] = []
  let state = initial
  while (!['bankruptcy', 'finalEnding'].includes(state.page) && results.length < maximumDays) {
    if (state.page === 'milestone') state = { ...state, page: 'morning' }
    const result = simulateDay(state, decide(state), choose, content)
    results.push(result)
    state = result.nextState
  }
  return { state, results }
}
