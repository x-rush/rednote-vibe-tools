import type { ShopContent } from '../content/schema'
import type { BusinessBeat, DayForecast, DemandResolution, GameState, PendingOpening, SavePayload } from '../domain/types'
import { operatingDayForCalendarDay } from '../engine/campaign'
import { withDayForecast } from '../engine/forecast'

export type V3MigrationResult =
  | { status: 'migrated'; payload: SavePayload }
  | { status: 'recovered-previous'; payload: SavePayload; reason: string }
  | { status: 'invalid'; reason: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function quietBeats(): BusinessBeat[] {
  return [0, 1, 2, 3].map((stage) => ({ stage: stage as 0 | 1 | 2 | 3, kind: 'quiet', count: 0 }))
}

function emptyDemand(opening: PendingOpening): DemandResolution {
  return {
    potentialBuyers: 0,
    servedCustomers: 0,
    losses: { stockout: 0, menuMismatch: 0, price: 0, service: 0 },
    products: opening.decision.menu.map((entry) => ({
      productId: entry.productId,
      directDemand: 0,
      directSold: 0,
      substituteSold: 0,
      prepared: entry.prepare,
      unsold: entry.prepare,
      stockoutLost: 0,
    })),
  }
}

function pendingForecast(state: GameState, content: ShopContent): DayForecast {
  const context = state.pendingOpening!.dayContext
  const signal = content.marketSignals.find((item) =>
    context.day >= item.dayRange[0] && context.day <= item.dayRange[1]
    && item.seasonIds.includes(context.seasonId) && item.weatherIds.includes(context.weatherId)) ?? content.marketSignals[0]
  return {
    forecastId: `${state.saveId}-migrated-forecast-${state.day}`,
    day: state.day,
    operatingDay: state.operatingDay,
    weatherId: context.weatherId,
    seasonId: context.seasonId,
    marketSignalId: signal.signalId,
    activeTags: context.activeTags.slice(0, 30),
    demandGroups: content.demandSegments.map((segment) => ({ segmentId: segment.segmentId, expectedCustomers: 0, actualCustomers: 0 })),
  }
}

function migrateState(value: unknown, content: ShopContent): GameState | undefined {
  if (!isRecord(value) || value.schemaVersion !== 3 || typeof value.saveId !== 'string' || typeof value.seed !== 'string'
    || !finite(value.day) || !finite(value.money) || !finite(value.reputation) || !finite(value.energy) || !finite(value.relationships)
    || !isRecord(value.rngState) || !finite(value.rngState.value)) return undefined
  const endingPage = value.page === 'bankruptcy' || value.page === 'finalEnding'
  let state: GameState = {
    ...(value as unknown as GameState),
    schemaVersion: 4,
    contentVersion: '4.0.0-demand-crisis',
    operatingDay: operatingDayForCalendarDay(value.day, content.balance.campaign),
    dayForecast: undefined,
    pendingContractScene: undefined,
    lastDecision: undefined,
    financialHealth: endingPage
      ? { phase: 'offer' as const, rescueUsed: true }
      : value.money < 0
        ? { phase: 'offer' as const, rescueUsed: false }
        : value.money < content.balance.crisis.warningMoney
          ? { phase: 'warning' as const, rescueUsed: false }
          : { phase: 'normal' as const, rescueUsed: false },
    page: endingPage ? value.page as GameState['page'] : value.money < 0 ? 'financialCrisis' as const : value.page as GameState['page'],
  }
  if (state.pendingOpening) {
    state = {
      ...state,
      pendingOpening: {
        ...state.pendingOpening,
        dayContext: { ...state.pendingOpening.dayContext, operatingDay: state.operatingDay },
        demandResolution: emptyDemand(state.pendingOpening),
        businessBeats: quietBeats(),
      },
      dayForecast: pendingForecast(state, content),
    }
  } else state = withDayForecast(state, content)
  return state
}

export function migrateV3Save(value: unknown, content: ShopContent): V3MigrationResult {
  if (!isRecord(value) || value.schemaVersion !== 3 || typeof value.id !== 'string'
    || typeof value.contentVersion !== 'string' || typeof value.updatedAt !== 'string') {
    return { status: 'invalid', reason: 'V3 存档外壳无效' }
  }
  let current = migrateState(value.current, content)
  let recovered = false
  if (!current) {
    current = migrateState(value.previousDay, content)
    recovered = true
  }
  if (!current) return { status: 'invalid', reason: 'V3 当前与上一日快照均不可恢复' }
  const previousDay = recovered ? undefined : migrateState(value.previousDay, content)
  const payload: SavePayload = {
    schemaVersion: 4,
    contentVersion: '4.0.0-demand-crisis',
    id: value.id,
    updatedAt: value.updatedAt,
    current,
    previousDay,
  }
  return recovered
    ? { status: 'recovered-previous', payload, reason: '当前快照损坏，已恢复上一日并升级存档' }
    : { status: 'migrated', payload }
}
