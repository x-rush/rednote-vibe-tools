import type { ShopContent } from '../content/schema'
import type { DailyDecision, DecisionSummary, GameState, OperatingMode, PendingOpening, SavePayload } from '../domain/types'
import type { SaveMigrationResult } from './migrate-v1'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const operatingModes = new Set<OperatingMode>(['full', 'half', 'rest'])

function migrateDecision(value: unknown): DailyDecision | undefined {
  if (!isRecord(value) || !Array.isArray(value.menu) || typeof value.strategyId !== 'string') return undefined
  const operatingMode = operatingModes.has(value.operatingMode as OperatingMode)
    ? value.operatingMode as OperatingMode
    : value.closeEarly === true ? 'half' : 'full'
  return {
    menu: value.menu as DailyDecision['menu'],
    operatingMode,
    strategyId: value.strategyId,
  }
}

function migrateSummary(value: unknown): DecisionSummary | undefined {
  if (!isRecord(value) || !finite(value.day) || !Array.isArray(value.productIds)
    || !finite(value.prepared) || !finite(value.averagePrice)) return undefined
  const operatingMode = operatingModes.has(value.operatingMode as OperatingMode)
    ? value.operatingMode as OperatingMode
    : value.closeEarly === true ? 'half' : 'full'
  return {
    day: value.day,
    productIds: value.productIds.filter((item): item is string => typeof item === 'string'),
    prepared: value.prepared,
    averagePrice: value.averagePrice,
    operatingMode,
  }
}

function migrateOpening(value: unknown): PendingOpening | undefined {
  if (!isRecord(value)) return undefined
  const decision = migrateDecision(value.decision)
  if (!decision || !Array.isArray(value.sales) || !Array.isArray(value.ledger) || !finite(value.visitors) || !finite(value.energyCost)) return undefined
  const sales = value.sales as PendingOpening['sales']
  const buyers = sales.reduce((sum, sale) => sum + (finite(sale.demand) ? sale.demand : 0), 0)
  return {
    ...(value as unknown as PendingOpening),
    decision,
    operatingMode: decision.operatingMode,
    footTraffic: value.visitors,
    buyers,
    unserved: 0,
    conversionRate: value.visitors === 0 ? 0 : buyers / value.visitors,
    energyDelta: -value.energyCost,
  }
}

function migrateState(value: unknown): GameState | undefined {
  if (!isRecord(value) || value.schemaVersion !== 2 || typeof value.saveId !== 'string' || typeof value.seed !== 'string') return undefined
  const pendingOpening = value.pendingOpening === undefined ? undefined : migrateOpening(value.pendingOpening)
  if (value.pendingOpening !== undefined && !pendingOpening) return undefined
  return {
    ...(value as unknown as GameState),
    schemaVersion: 3,
    pendingOpening,
    pendingFollowUps: [],
    decisionSummaries: Array.isArray(value.decisionSummaries)
      ? value.decisionSummaries.flatMap((summary) => migrateSummary(summary) ?? []).slice(-30)
      : [],
  }
}

export function migrateV2Save(value: unknown, _content: ShopContent): SaveMigrationResult {
  if (!isRecord(value) || value.schemaVersion !== 2 || typeof value.id !== 'string'
    || typeof value.contentVersion !== 'string' || typeof value.updatedAt !== 'string') {
    return { status: 'invalid', reason: 'V2 存档外壳无效' }
  }
  const current = migrateState(value.current)
  if (!current) return { status: 'invalid', reason: 'V2 当前快照无效' }
  const previousDay = value.previousDay === undefined ? undefined : migrateState(value.previousDay)
  const payload: SavePayload = {
    schemaVersion: 3,
    contentVersion: current.contentVersion,
    id: value.id,
    updatedAt: value.updatedAt,
    current,
    previousDay,
  }
  return { status: 'migrated', payload }
}
