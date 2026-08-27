import type { ShopContent } from '../content/schema'
import type { GameState, SavePayload } from '../domain/types'
import { calendarDayForOperatingDay, operatingDayForCalendarDay } from '../engine/campaign'

export type V4MigrationResult =
  | { status: 'migrated'; payload: SavePayload }
  | { status: 'recovered-previous'; payload: SavePayload; reason: string }
  | { status: 'invalid'; reason: string }

const CONTENT_VERSION = '5.0.0-thirty-turns'
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function migrateState(value: unknown, content: ShopContent): GameState | undefined {
  if (!isRecord(value) || value.schemaVersion !== 4 || typeof value.saveId !== 'string' || typeof value.seed !== 'string'
    || !finite(value.day) || !finite(value.money) || !finite(value.reputation) || !finite(value.energy) || !finite(value.relationships)
    || !isRecord(value.rngState) || !finite(value.rngState.value)) return undefined

  const legacyDay = Math.max(1, Math.min(content.balance.campaign.totalCalendarDays, Math.trunc(value.day)))
  const operatingDay = operatingDayForCalendarDay(legacyDay, content.balance.campaign)
  const day = calendarDayForOperatingDay(operatingDay, content.balance.campaign)
  const forecast = isRecord(value.dayForecast)
    ? { ...value.dayForecast, day, operatingDay }
    : value.dayForecast
  const pendingOpening = isRecord(value.pendingOpening) && isRecord(value.pendingOpening.dayContext)
    ? { ...value.pendingOpening, dayContext: { ...value.pendingOpening.dayContext, day, operatingDay } }
    : value.pendingOpening
  const modifiers = Array.isArray(value.modifiers) ? value.modifiers.flatMap((modifier) => {
    if (!isRecord(modifier) || modifier.durationBasis !== undefined || !finite(modifier.expiresDay)) return [modifier]
    if (modifier.expiresDay < legacyDay) return []
    const expiryOperatingDay = operatingDayForCalendarDay(modifier.expiresDay, content.balance.campaign)
    const remainingOperatingDays = Math.max(1, expiryOperatingDay - operatingDay)
    return [{
      ...modifier,
      expiresDay: content.balance.campaign.totalCalendarDays,
      durationBasis: 'operating',
      remainingOperatingDays,
    }]
  }) : value.modifiers
  const pendingEffects = Array.isArray(value.pendingEffects) ? value.pendingEffects.map((pending) => {
    if (!isRecord(pending) || !finite(pending.dueDay)) return pending
    const dueOperatingDay = operatingDayForCalendarDay(pending.dueDay, content.balance.campaign)
    return { ...pending, dueDay: calendarDayForOperatingDay(dueOperatingDay, content.balance.campaign) }
  }) : value.pendingEffects
  const financialHealth = isRecord(value.financialHealth) && isRecord(value.financialHealth.activeContract)
    ? {
        ...value.financialHealth,
        activeContract: {
          ...value.financialHealth.activeContract,
          graceEndsDay: calendarDayForOperatingDay(
            operatingDayForCalendarDay(Number(value.financialHealth.activeContract.graceEndsDay), content.balance.campaign),
            content.balance.campaign,
          ),
        },
      }
    : value.financialHealth

  return {
    ...(value as unknown as GameState),
    schemaVersion: 5,
    contentVersion: CONTENT_VERSION,
    operatingDay,
    day,
    dayForecast: forecast as GameState['dayForecast'],
    pendingOpening: pendingOpening as GameState['pendingOpening'],
    modifiers: modifiers as GameState['modifiers'],
    pendingEffects: pendingEffects as GameState['pendingEffects'],
    financialHealth: financialHealth as GameState['financialHealth'],
  }
}

export function migrateV4Save(value: unknown, content: ShopContent): V4MigrationResult {
  if (!isRecord(value) || value.schemaVersion !== 4 || typeof value.id !== 'string'
    || typeof value.contentVersion !== 'string' || typeof value.updatedAt !== 'string') {
    return { status: 'invalid', reason: 'V4 存档外壳无效' }
  }
  let current = migrateState(value.current, content)
  let recovered = false
  if (!current) {
    current = migrateState(value.previousDay, content)
    recovered = true
  }
  if (!current) return { status: 'invalid', reason: 'V4 当前与上一经营日快照均不可恢复' }
  const previousDay = recovered ? undefined : migrateState(value.previousDay, content)
  const payload: SavePayload = {
    schemaVersion: 5,
    contentVersion: CONTENT_VERSION,
    id: value.id,
    updatedAt: value.updatedAt,
    current,
    previousDay,
  }
  return recovered
    ? { status: 'recovered-previous', payload, reason: '当前快照损坏，已恢复上一经营日并升级为三十回合存档' }
    : { status: 'migrated', payload }
}
