import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { SavePayload } from '../domain/types'
import { createNewGame } from '../engine/simulator'
import { decodeSave, encodeSave } from './save-codec'

const payload = (): SavePayload => ({
  schemaVersion: 1,
  contentVersion: shopContent.contentVersion,
  id: 'save-codec-1',
  updatedAt: '2026-08-24T00:00:00.000Z',
  current: createNewGame('codec', 'save-codec-1', shopContent.content),
})

describe('save codec and recovery', () => {
  it('round-trips a valid save and bounds summaries', () => {
    const value = payload()
    value.current.eventHistory = Array.from({ length: 140 }, (_, day) => ({ day, eventId: 'event-signboard', choiceId: 'a', moneyDelta: 0, statDeltas: {} }))
    value.current.decisionSummaries = Array.from({ length: 40 }, (_, day) => ({ day, productIds: ['drink-green-plum'], prepared: 1, averagePrice: 7, closeEarly: false }))
    const decoded = decodeSave(encodeSave(value), shopContent.content)
    expect(decoded.status).toBe('ok')
    if (decoded.status === 'ok') {
      expect(decoded.payload.current.eventHistory).toHaveLength(120)
      expect(decoded.payload.current.decisionSummaries).toHaveLength(30)
    }
  })

  it.each([
    ['truncated JSON', '{"bad"'],
    ['future version', JSON.stringify({ ...payload(), schemaVersion: 2 })],
    ['wrong money type', JSON.stringify({ ...payload(), current: { ...payload().current, money: 'many' } })],
    ['unknown inventory ID', JSON.stringify({ ...payload(), current: { ...payload().current, inventory: { unknown: 2 } } })],
    ['Base64 payload', JSON.stringify({ ...payload(), current: { ...payload().current, flags: ['data:image/png;base64,bad'] } })],
    ['oversized flags', JSON.stringify({ ...payload(), current: { ...payload().current, flags: Array.from({ length: 501 }, (_, index) => `flag-${index}`) } })],
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
})
