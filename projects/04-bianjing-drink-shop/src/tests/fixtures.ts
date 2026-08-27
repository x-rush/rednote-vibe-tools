import type { DailyDecision, GameState } from '../domain/types'
import { seedRng } from '../domain/rng'
import { shopContent } from '../content'
import { operatingDayForCalendarDay } from '../engine/campaign'

export function makeState(overrides: Partial<GameState> = {}): GameState {
  const day = overrides.day ?? 10
  const operatingDay = overrides.operatingDay ?? operatingDayForCalendarDay(day, shopContent.content.balance.campaign)
  const hasForecastOverride = Object.prototype.hasOwnProperty.call(overrides, 'dayForecast')
  return {
    schemaVersion: 5,
    contentVersion: '5.0.0-thirty-turns',
    saveId: 'save-test-1',
    seed: 'fixture-seed',
    rngState: seedRng('fixture-seed'),
    day,
    operatingDay,
    page: 'morning',
    money: 120,
    reputation: 20,
    energy: 60,
    relationships: 15,
    inventory: { 'drink-green-plum': 2 },
    prices: { 'drink-green-plum': 7 },
    unlockedProductIds: ['drink-green-plum', 'drink-ginger-honey', 'drink-perilla'],
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
    pendingFollowUps: [],
    dayForecast: {
      forecastId: `save-test-1-forecast-${day}`,
      day,
      operatingDay,
      weatherId: 'weather-clear',
      seasonId: 'season-early-spring',
      marketSignalId: 'signal-quiet-lane',
      activeTags: ['weather-clear', 'spring', 'quiet-market'],
      demandGroups: [
        { segmentId: 'segment-cool-sour', expectedCustomers: 3, actualCustomers: 3 },
        { segmentId: 'segment-sweet-warm', expectedCustomers: 2, actualCustomers: 2 },
        { segmentId: 'segment-herbal-light', expectedCustomers: 2, actualCustomers: 2 },
        { segmentId: 'segment-hot-spiced', expectedCustomers: 1, actualCustomers: 1 },
        { segmentId: 'segment-novel-signature', expectedCustomers: 0, actualCustomers: 0 },
      ],
    },
    financialHealth: { phase: 'normal', rescueUsed: false },
    ...overrides,
    ...(hasForecastOverride ? { dayForecast: overrides.dayForecast } : {}),
  }
}

export const basicDecision: DailyDecision = {
  menu: [
    { productId: 'drink-green-plum', prepare: 4, price: 7 },
    { productId: 'drink-ginger-honey', prepare: 3, price: 9 },
    { productId: 'drink-perilla', prepare: 3, price: 11 },
  ],
  operatingMode: 'full',
  strategyId: 'test-steady',
}
