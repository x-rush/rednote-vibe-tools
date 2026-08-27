import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { SavePayload } from '../domain/types'
import { createNewGame, openDay } from '../engine/simulator'
import { basicDecision, makeState } from '../tests/fixtures'
import { decodeSave, encodeSave } from './save-codec'

const payload = (): SavePayload => ({
  schemaVersion: 5,
  contentVersion: shopContent.contentVersion,
  id: 'save-codec-1',
  updatedAt: '2026-08-24T00:00:00.000Z',
  current: createNewGame('codec', 'save-codec-1', shopContent.content),
})

describe('save codec and recovery', () => {
  it('round-trips a valid save and bounds summaries', () => {
    const value = payload()
    value.current.eventHistory = Array.from({ length: 140 }, (_, day) => ({ day, eventId: 'event-signboard', choiceId: 'a', moneyDelta: 0, statDeltas: {} }))
    value.current.decisionSummaries = Array.from({ length: 40 }, (_, day) => ({ day, productIds: ['drink-green-plum'], prepared: 1, averagePrice: 7, operatingMode: 'full' }))
    const decoded = decodeSave(encodeSave(value), shopContent.content)
    expect(decoded.status).toBe('ok')
    if (decoded.status === 'ok') {
      expect(decoded.payload.current.eventHistory).toHaveLength(120)
      expect(decoded.payload.current.decisionSummaries).toHaveLength(30)
    }
  })

  it.each([
    ['truncated JSON', '{"bad"'],
    ['future version', JSON.stringify({ ...payload(), schemaVersion: 6 })],
    ['wrong money type', JSON.stringify({ ...payload(), current: { ...payload().current, money: 'many' } })],
    ['unknown inventory ID', JSON.stringify({ ...payload(), current: { ...payload().current, inventory: { unknown: 2 } } })],
    ['Base64 payload', JSON.stringify({ ...payload(), current: { ...payload().current, flags: ['data:image/png;base64,bad'] } })],
    ['oversized flags', JSON.stringify({ ...payload(), current: { ...payload().current, flags: Array.from({ length: 501 }, (_, index) => `flag-${index}`) } })],
    ['unknown story flag', JSON.stringify({ ...payload(), current: { ...payload().current, flags: ['flag-from-another-content-pack'] } })],
    ['unknown page', JSON.stringify({ ...payload(), current: { ...payload().current, page: 'secret-admin' } })],
    ['unknown history event', JSON.stringify({ ...payload(), current: { ...payload().current, eventHistory: [{ day: 2, eventId: 'event-missing', choiceId: 'a', moneyDelta: 2, statDeltas: {} }] } })],
    ['unknown history choice', JSON.stringify({ ...payload(), current: { ...payload().current, eventHistory: [{ day: 2, eventId: 'event-signboard', choiceId: 'missing', moneyDelta: 2, statDeltas: {} }] } })],
    ['malformed modifier', JSON.stringify({ ...payload(), current: { ...payload().current, modifiers: [{ modifierId: 'bad', target: 'luck', operation: 'add', value: 1, expiresDay: 9, playerLabel: '坏数据' }] } })],
    ['malformed pending effect', JSON.stringify({ ...payload(), current: { ...payload().current, pendingEffects: [{ scheduledEffectId: 'bad', dueDay: 2, effects: [{ type: 'money-delta', value: 'many', labelId: 'bad' }] }] } })],
    ['unknown chain progress', JSON.stringify({ ...payload(), current: { ...payload().current, chainProgress: { 'chain-missing': { chainId: 'chain-missing', status: 'active', nodeIndex: -1, startedDay: 1, lastAdvancedDay: 1 } } } })],
    ['malformed campaign totals', JSON.stringify({ ...payload(), current: { ...payload().current, campaignTotals: { trackedOperatingDays: 2, totalSold: -1, profitDays: 1, lossDays: 1, breakEvenDays: 0, productSold: {} } } })],
  ])('returns a safe result for %s', (_label, raw) => {
    expect(decodeSave(raw, shopContent.content).status).not.toBe('ok')
  })

  it('recovers the previous-day snapshot when current data is corrupt', () => {
    const value = payload()
    const raw = JSON.stringify({ ...value, current: { ...value.current, money: 'bad' }, previousDay: value.current })
    const decoded = decodeSave(raw, shopContent.content)
    expect(decoded.status).toBe('recovered-previous')
    if (decoded.status === 'recovered-previous') expect(decoded.payload.current.money).toBe(120)
  })

  it('keeps a valid current snapshot and discards a malformed previous snapshot', () => {
    const value = payload()
    const decoded = decodeSave(JSON.stringify({ ...value, previousDay: { schemaVersion: 5 } }), shopContent.content)

    expect(decoded).toMatchObject({ status: 'ok', payload: { previousDay: undefined } })
  })

  it('routes a V1 morning save through bounded migration', () => {
    const value = payload()
    const legacy = {
      ...value,
      schemaVersion: 1,
      current: { ...value.current, schemaVersion: 1 },
    }
    const decoded = decodeSave(JSON.stringify(legacy), shopContent.content)
    expect(decoded.status).toBe('migrated')
    if (decoded.status === 'migrated') {
      expect(decoded.payload.schemaVersion).toBe(5)
      expect(decoded.payload.current.schemaVersion).toBe(5)
    }
  })

  it('routes a V2 save through schema-4 migration', () => {
    const value = payload()
    const legacy = {
      ...value,
      schemaVersion: 2,
      current: { ...value.current, schemaVersion: 2, pendingFollowUps: undefined },
    }
    const decoded = decodeSave(JSON.stringify(legacy), shopContent.content)

    expect(decoded.status).toBe('migrated')
    if (decoded.status === 'migrated') {
      expect(decoded.payload.schemaVersion).toBe(5)
      expect(decoded.payload.current).toMatchObject({ schemaVersion: 5, operatingDay: 1, pendingFollowUps: [], dayForecast: { operatingDay: 1, day: 1 } })
    }
  })

  it('rejects a future state schema even inside a V5 envelope', () => {
    const value = payload()
    expect(decodeSave(JSON.stringify({
      ...value,
      current: { ...value.current, schemaVersion: 6 },
    }), shopContent.content).status).toBe('invalid')
  })

  it('rejects invalid V5 campaign clocks, demand, financial scenes, and operating durations', () => {
    const value = payload()
    expect(decodeSave(JSON.stringify({ ...value, current: { ...value.current, operatingDay: 2, day: 1 } }), shopContent.content).status).toBe('invalid')
    const badForecast = { ...value.current, dayForecast: { ...value.current.dayForecast!, day: value.current.day + 1 } }
    expect(decodeSave(JSON.stringify({ ...value, current: badForecast }), shopContent.content).status).toBe('invalid')
    const badScene = { ...value.current, pendingContractScene: { contractId: 'crisis-missing', trigger: 'accepted' } }
    expect(decodeSave(JSON.stringify({ ...value, current: badScene }), shopContent.content).status).toBe('invalid')
    const badModifier = { ...value.current, modifiers: [{
      modifierId: 'bad-operating', target: 'energy-cost', operation: 'add', value: 2, expiresDay: 100,
      playerLabel: '坏数据', durationBasis: 'operating', remainingOperatingDays: -1,
    }] }
    expect(decodeSave(JSON.stringify({ ...value, current: badModifier }), shopContent.content).status).toBe('invalid')
  })

  it('round-trips a pending authored branch and rejects an unknown variant id', () => {
    const state = makeState({
      day: 10,
      flags: ['poet-debt-gentle'],
      chainProgress: {
        'chain-poet': {
          chainId: 'chain-poet',
          status: 'active',
          nodeIndex: 0,
          currentNodeId: 'poet-credit',
          startedDay: 4,
          lastAdvancedDay: 4,
        },
      },
    })
    const opened = openDay(state, basicDecision, shopContent.content).state
    const value = { ...payload(), current: opened }

    const decoded = decodeSave(encodeSave(value), shopContent.content)
    expect(decoded.status).toBe('ok')
    if (decoded.status === 'ok') expect(decoded.payload.current.pendingOpening?.variantId).toBe('gentle-debt')

    const invalid = { ...opened, pendingOpening: { ...opened.pendingOpening, variantId: 'missing-route' } }
    expect(decodeSave(JSON.stringify({ ...value, current: invalid }), shopContent.content).status).toBe('invalid')
  })
})
