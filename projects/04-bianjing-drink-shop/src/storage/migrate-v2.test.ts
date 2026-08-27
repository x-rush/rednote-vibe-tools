import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { GameState } from '../domain/types'
import { openDay } from '../engine/simulator'
import { basicDecision, makeState } from '../tests/fixtures'
import { migrateV2Save } from './migrate-v2'

const content = shopContent.content

function legacyPayload(current: unknown) {
  return {
    schemaVersion: 2,
    contentVersion: '2.1.0-story-branches',
    id: 'legacy-save',
    updatedAt: '2026-08-27T00:00:00.000Z',
    current,
  }
}

describe('schema-2 to schema-3 save migration', () => {
  it('maps both legacy close-early values and initializes the follow-up queue', () => {
    const current = {
      ...makeState(),
      schemaVersion: 2,
      decisionSummaries: [
        { day: 8, productIds: ['drink-green-plum'], prepared: 3, averagePrice: 7, closeEarly: false },
        { day: 9, productIds: ['drink-green-plum'], prepared: 2, averagePrice: 7, closeEarly: true },
      ],
    }

    const result = migrateV2Save(legacyPayload(current), content)

    expect(result).toMatchObject({
      status: 'migrated',
      payload: {
        schemaVersion: 3,
        current: {
          schemaVersion: 3,
          pendingFollowUps: [],
          decisionSummaries: [{ operatingMode: 'full' }, { operatingMode: 'half' }],
        },
      },
    })
  })

  it('preserves a frozen opening while deriving only the new funnel fields', () => {
    const state = makeState({
      day: 10,
      flags: ['poet-debt-gentle'],
      chainProgress: {
        'chain-poet': {
          chainId: 'chain-poet', status: 'active', nodeIndex: 0, currentNodeId: 'poet-credit',
          startedDay: 4, lastAdvancedDay: 6,
        },
      },
    })
    const opened = openDay(state, basicDecision, content).state
    const currentOpening = opened.pendingOpening!
    const {
      operatingMode: _operatingMode,
      footTraffic: _footTraffic,
      buyers: _buyers,
      unserved: _unserved,
      conversionRate: _conversionRate,
      energyDelta: _energyDelta,
      ...legacyOpening
    } = currentOpening
    const legacyCurrent = {
      ...opened,
      schemaVersion: 2,
      pendingFollowUps: undefined,
      pendingOpening: { ...legacyOpening, decision: { ...legacyOpening.decision, operatingMode: undefined } },
    } as unknown as GameState
    const frozen = {
      sales: structuredClone(legacyOpening.sales),
      ledger: structuredClone(legacyOpening.ledger),
      moneyDelta: legacyOpening.moneyDelta,
      eventId: legacyOpening.eventId,
      variantId: legacyOpening.variantId,
      rngState: structuredClone(legacyOpening.rngState),
    }

    const result = migrateV2Save(legacyPayload(legacyCurrent), content)

    expect(result.status).toBe('migrated')
    if (result.status !== 'migrated') return
    const migrated = result.payload.current.pendingOpening!
    expect({
      sales: migrated.sales,
      ledger: migrated.ledger,
      moneyDelta: migrated.moneyDelta,
      eventId: migrated.eventId,
      variantId: migrated.variantId,
      rngState: migrated.rngState,
    }).toEqual(frozen)
    expect(migrated).toMatchObject({
      operatingMode: 'full',
      footTraffic: legacyOpening.visitors,
      buyers: legacyOpening.sales.reduce((sum, sale) => sum + sale.demand, 0),
      unserved: 0,
      energyDelta: -legacyOpening.energyCost,
    })
  })
})
