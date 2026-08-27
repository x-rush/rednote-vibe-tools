import type { MarketSignalDefinition, ShopContent } from '../content/schema'
import type { DayForecast, GameState } from '../domain/types'
import { nextRandom, type RngState } from '../domain/rng'
import { calculateVisitors } from './economy'

interface ForecastCreation {
  forecast: DayForecast
  rngState: RngState
}

function weightedPick<T>(items: T[], weightOf: (item: T) => number, rngState: RngState) {
  if (items.length === 0) throw new Error('晨间情报没有可用候选')
  const random = nextRandom(rngState)
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0)
  if (total <= 0) return { item: items[0], rngState: random.state }
  let target = random.value * total
  const item = items.find((candidate) => {
    target -= Math.max(0, weightOf(candidate))
    return target < 0
  }) ?? items[items.length - 1]
  return { item, rngState: random.state }
}

function allocateTotal(total: number, weightedIds: { id: string; weight: number }[]) {
  const safeTotal = Math.max(0, Math.round(total))
  const totalWeight = weightedIds.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  if (totalWeight <= 0) return Object.fromEntries(weightedIds.map((item) => [item.id, 0]))
  const exact = weightedIds.map((item, index) => ({
    id: item.id,
    index,
    value: safeTotal * Math.max(0, item.weight) / totalWeight,
  }))
  const allocated = Object.fromEntries(exact.map((item) => [item.id, Math.floor(item.value)])) as Record<string, number>
  let remaining = safeTotal - Object.values(allocated).reduce((sum, value) => sum + value, 0)
  exact
    .slice()
    .sort((left, right) => (right.value % 1) - (left.value % 1) || left.index - right.index)
    .forEach((item) => {
      if (remaining <= 0) return
      allocated[item.id] += 1
      remaining -= 1
    })
  return allocated
}

function eligibleSignals(content: ShopContent, day: number, seasonId: string, weatherId: string): MarketSignalDefinition[] {
  return content.marketSignals.filter((signal) =>
    day >= signal.dayRange[0]
    && day <= signal.dayRange[1]
    && signal.seasonIds.includes(seasonId)
    && signal.weatherIds.includes(weatherId))
}

export function createDayForecast(state: GameState, content: ShopContent): ForecastCreation {
  const season = content.seasons.find((item) => state.day >= item.dayRange[0] && state.day <= item.dayRange[1]) ?? content.seasons[0]
  if (!season) throw new Error(`第 ${state.day} 日没有可用季节配置`)
  const weatherRoll = weightedPick(content.weather, (item) => item.weight, state.rngState)
  const signalRoll = weightedPick(
    eligibleSignals(content, state.day, season.seasonId, weatherRoll.item.weatherId),
    (item) => item.weight,
    weatherRoll.rngState,
  )
  const activeTags = [
    weatherRoll.item.weatherId,
    season.seasonId,
    ...season.tags,
    ...signalRoll.item.activeTags,
  ]
  const context = {
    day: state.day,
    operatingDay: state.operatingDay,
    weatherId: weatherRoll.item.weatherId,
    seasonId: season.seasonId,
    eventVisitorDelta: signalRoll.item.visitorDelta,
    activeTags,
  }
  const expectedCustomers = calculateVisitors(state, context, content.balance, content.weather)
  const weights = content.demandSegments.map((segment) => {
    const tagFactor = segment.tagWeights.reduce(
      (factor, rule) => activeTags.includes(rule.tag) ? factor * rule.multiplier : factor,
      1,
    )
    const signalFactor = signalRoll.item.segmentWeights.find((item) => item.segmentId === segment.segmentId)?.multiplier ?? 1
    return { id: segment.segmentId, weight: segment.baseWeight * tagFactor * signalFactor }
  })
  const allocated = allocateTotal(expectedCustomers, weights)
  const [minimumVariation, maximumVariation] = content.balance.forecast.hiddenVariation
  let rngState = signalRoll.rngState
  const demandGroups = content.demandSegments.map((segment) => {
    const variationRoll = nextRandom(rngState)
    rngState = variationRoll.state
    const span = Math.max(0, Math.floor(maximumVariation) - Math.ceil(minimumVariation) + 1)
    const variation = span === 0 ? 0 : Math.ceil(minimumVariation) + Math.floor(variationRoll.value * span)
    const expected = allocated[segment.segmentId] ?? 0
    return {
      segmentId: segment.segmentId,
      expectedCustomers: expected,
      actualCustomers: Math.max(0, expected + variation),
    }
  })
  return {
    forecast: {
      forecastId: `${state.saveId}-forecast-${state.day}-${rngState.value}`,
      day: state.day,
      operatingDay: state.operatingDay,
      weatherId: weatherRoll.item.weatherId,
      seasonId: season.seasonId,
      marketSignalId: signalRoll.item.signalId,
      activeTags,
      demandGroups,
    },
    rngState,
  }
}

export function withDayForecast(state: GameState, content: ShopContent): GameState {
  if (state.dayForecast?.day === state.day && state.dayForecast.operatingDay === state.operatingDay) return state
  const created = createDayForecast(state, content)
  return { ...state, dayForecast: created.forecast, rngState: created.rngState }
}
