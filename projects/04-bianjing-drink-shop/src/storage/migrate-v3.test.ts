import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { GameState } from '../domain/types'
import { openDay } from '../engine/simulator'
import { basicDecision, makeState } from '../tests/fixtures'
import { migrateV3Save } from './migrate-v3'

const content = shopContent.content

function v3State(overrides: Partial<GameState> = {}) {
  const state = makeState(overrides)
  return {
    ...state,
    schemaVersion: 3,
    contentVersion: '3.0.0-story-followups',
    dayForecast: undefined,
    financialHealth: undefined,
    pendingContractScene: undefined,
    lastDecision: undefined,
  }
}

function payload(current: unknown, previousDay?: unknown) {
  return {
    schemaVersion: 3,
    contentVersion: '3.0.0-story-followups',
    id: 'legacy-v3',
    updatedAt: '2026-08-27T00:00:00.000Z',
    current,
    previousDay,
  }
}

describe('schema-3 to schema-4 save migration', () => {
  it('freezes one forecast for an unopened morning', () => {
    const result = migrateV3Save(payload(v3State({ day: 18 })), content)
    expect(result).toMatchObject({
      status: 'migrated',
      payload: {
        schemaVersion: 4,
        current: { schemaVersion: 4, day: 18, dayForecast: { day: 18 }, financialHealth: { rescueUsed: false } },
      },
    })
  })

  it('preserves a pending opening snapshot without rerolling its weather, ledger, sales, or RNG', () => {
    const opened = openDay(makeState(), basicDecision, content).state
    const legacyOpening = structuredClone(opened.pendingOpening!) as unknown as Record<string, unknown>
    delete legacyOpening.demandResolution
    delete legacyOpening.businessBeats
    const legacy = v3State({ ...opened, pendingOpening: legacyOpening as unknown as GameState['pendingOpening'] })
    const result = migrateV3Save(payload(legacy), content)
    expect(result.status).toBe('migrated')
    if (result.status !== 'migrated') return
    expect(result.payload.current.pendingOpening).toMatchObject({
      resolutionId: legacyOpening.resolutionId,
      dayContext: legacyOpening.dayContext,
      sales: legacyOpening.sales,
      ledger: legacyOpening.ledger,
      rngState: legacyOpening.rngState,
      demandResolution: { potentialBuyers: 0, servedCustomers: 0 },
      businessBeats: [
        { stage: 0, kind: 'quiet', count: 0 }, { stage: 1, kind: 'quiet', count: 0 },
        { stage: 2, kind: 'quiet', count: 0 }, { stage: 3, kind: 'quiet', count: 0 },
      ],
    })
    expect(result.payload.current.rngState).toEqual(legacy.rngState)
  })

  it('routes a negative unfinished save to the offer but preserves existing endings', () => {
    expect(migrateV3Save(payload(v3State({ money: -1, page: 'morning' })), content)).toMatchObject({
      status: 'migrated', payload: { current: { page: 'financialCrisis', financialHealth: { phase: 'offer', rescueUsed: false } } },
    })
    expect(migrateV3Save(payload(v3State({ money: -1, page: 'bankruptcy', currentEndingId: 'ending-closed-early' })), content)).toMatchObject({
      status: 'migrated', payload: { current: { page: 'bankruptcy', currentEndingId: 'ending-closed-early' } },
    })
  })

  it('recovers an invalid current snapshot from a valid previous day', () => {
    const result = migrateV3Save(payload({ ...v3State(), money: 'bad' }, v3State({ day: 9, money: 88 })), content)
    expect(result).toMatchObject({ status: 'recovered-previous', payload: { schemaVersion: 4, current: { day: 9, money: 88 } } })
  })
})
