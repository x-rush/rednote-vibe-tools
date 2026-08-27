import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { GameState } from '../domain/types'
import { openDay } from '../engine/simulator'
import { basicDecision, makeState } from '../tests/fixtures'
import { migrateV4Save } from './migrate-v4'

const content = shopContent.content

function legacyState(day: number, overrides: Partial<GameState> = {}) {
  const state = makeState({ day, ...overrides }) as GameState & { operatingDay?: number }
  const legacy = structuredClone(state) as unknown as Record<string, any>
  legacy.schemaVersion = 4
  legacy.contentVersion = '4.0.0-demand-crisis'
  delete legacy.operatingDay
  if (legacy.dayForecast) delete legacy.dayForecast.operatingDay
  if (legacy.pendingOpening?.dayContext) delete legacy.pendingOpening.dayContext.operatingDay
  return legacy
}

function payload(current: unknown, previousDay?: unknown) {
  return {
    schemaVersion: 4,
    contentVersion: '4.0.0-demand-crisis',
    id: 'legacy-v4',
    updatedAt: '2026-08-27T00:00:00.000Z',
    current,
    previousDay,
  }
}

describe('schema-4 to schema-5 campaign migration', () => {
  it.each([
    [1, 1, 1],
    [18, 6, 18],
    [99, 30, 100],
    [100, 30, 100],
  ])('maps calendar day %i to operating day %i at calendar checkpoint %i', (legacyDay, operatingDay, calendarDay) => {
    const result = migrateV4Save(payload(legacyState(legacyDay)), content)

    expect(result).toMatchObject({
      status: 'migrated',
      payload: {
        schemaVersion: 5,
        current: { schemaVersion: 5, operatingDay, day: calendarDay, dayForecast: { operatingDay, day: calendarDay } },
      },
    })
  })

  it('preserves a pending opening while adding both playable clock fields', () => {
    const opened = openDay(makeState({ operatingDay: 6, day: 18 }), basicDecision, content).state
    const legacy = legacyState(18, opened)
    const result = migrateV4Save(payload(legacy), content)

    expect(result.status).toBe('migrated')
    if (result.status !== 'migrated') return
    expect(result.payload.current.pendingOpening).toMatchObject({
      resolutionId: opened.pendingOpening?.resolutionId,
      dayContext: { operatingDay: 6, day: 18 },
      sales: opened.pendingOpening?.sales,
      ledger: opened.pendingOpening?.ledger,
    })
  })

  it('recovers a valid previous snapshot when current data is corrupt', () => {
    const result = migrateV4Save(payload({ ...legacyState(18), money: 'bad' }, legacyState(14, { money: 88 })), content)

    expect(result).toMatchObject({
      status: 'recovered-previous',
      payload: { schemaVersion: 5, current: { operatingDay: 5, day: 14, money: 88 } },
    })
  })

  it('converts calendar expiry to remaining operating turns and drops expired modifiers', () => {
    const current = legacyState(18, {
      modifiers: [
        { modifierId: 'active', target: 'visitor-count', operation: 'add', value: 1, expiresDay: 26, playerLabel: '仍在生效' },
        { modifierId: 'expired', target: 'fixed-cost', operation: 'add', value: 1, expiresDay: 17, playerLabel: '已经过期' },
      ],
    })

    const result = migrateV4Save(payload(current), content)

    expect(result.status).toBe('migrated')
    if (result.status !== 'migrated') return
    expect(result.payload.current.modifiers).toEqual([
      expect.objectContaining({ modifierId: 'active', durationBasis: 'operating', remainingOperatingDays: 2 }),
    ])
  })
})
