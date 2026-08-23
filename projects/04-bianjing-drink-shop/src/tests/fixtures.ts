import type { DailyDecision, GameState } from '../domain/types'
import { seedRng } from '../domain/rng'

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    schemaVersion: 1,
    contentVersion: '1.0.0-foundation',
    saveId: 'save-test-1',
    seed: 'fixture-seed',
    rngState: seedRng('fixture-seed'),
    day: 10,
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
    ...overrides,
  }
}

export const basicDecision: DailyDecision = {
  menu: [
    { productId: 'drink-green-plum', prepare: 4, price: 7 },
    { productId: 'drink-ginger-honey', prepare: 3, price: 9 },
    { productId: 'drink-perilla', prepare: 3, price: 11 },
  ],
  closeEarly: false,
  strategyId: 'test-steady',
}
