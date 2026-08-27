import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { GameState } from '../domain/types'
import { createNewGame } from '../engine/simulator'
import { migrateV1Save } from './migrate-v1'

const content = shopContent.content

function v1State(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame('legacy-seed', 'legacy-save', content),
    schemaVersion: 1,
    contentVersion: '1.0.0-foundation',
    ...overrides,
  }
}

function payload(current: GameState, previousDay?: GameState) {
  return {
    schemaVersion: 1,
    contentVersion: '1.0.0-foundation',
    id: 'legacy-save',
    updatedAt: '2026-08-24T00:00:00.000Z',
    current,
    previousDay,
  }
}

describe('bounded V1 save migration', () => {
  it('preserves a valid morning state and normalizes known modifiers', () => {
    const current = v1State({
      day: 28,
      money: 233,
      modifiers: [{ modifierId: 'apprentice-energy', value: 2, expiresDay: 34 } as GameState['modifiers'][number]],
    })
    const result = migrateV1Save(payload(current), content)

    expect(result).toMatchObject({
      status: 'migrated',
      payload: { schemaVersion: 3, current: { schemaVersion: 3, day: 28, money: 233 } },
    })
    if (result.status === 'migrated') expect(result.payload.current.modifiers[0]).toMatchObject({
      target: 'energy-cost', operation: 'add', value: -2,
    })
  })

  it('rolls a V1 pending day back to a valid previous morning snapshot', () => {
    const previous = v1State({ day: 12, page: 'morning', money: 180 })
    const pending = v1State({
      day: 12,
      page: 'event',
      money: 146,
      pendingOpening: { resolutionId: 'old-half-committed' } as GameState['pendingOpening'],
    })
    expect(migrateV1Save(payload(pending, previous), content)).toMatchObject({
      status: 'migrated',
      payload: { current: { page: 'morning', day: 12, money: 180, pendingOpening: undefined } },
    })
  })

  it('refuses a V1 pending day without a safe previous snapshot', () => {
    const pending = v1State({
      page: 'event',
      pendingOpening: { resolutionId: 'old-half-committed' } as GameState['pendingOpening'],
    })
    expect(migrateV1Save(payload(pending), content)).toMatchObject({ status: 'unrecoverable-pending' })
  })

  it('keeps a legitimate not-yet-advanced chain entrance active', () => {
    const current = v1State({
      day: 18,
      chainProgress: {
        'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: -1, startedDay: 17, lastAdvancedDay: 17, currentNodeId: 'poet-credit' },
      },
    })
    const result = migrateV1Save(payload(current), content)
    expect(result.status === 'migrated' && result.payload.current.chainProgress['chain-poet']).toMatchObject({
      status: 'active', nodeIndex: -1, lastAdvancedDay: 18,
    })
  })

  it('revives only the bug-generated timeout before a first follow-up', () => {
    const current = v1State({
      day: 18,
      chainProgress: {
        'chain-poet': {
          chainId: 'chain-poet', status: 'interrupted', nodeIndex: -1, startedDay: 17,
          lastAdvancedDay: 18, currentNodeId: 'poet-credit', reason: 'timeout',
        },
        'chain-festival': {
          chainId: 'chain-festival', status: 'interrupted', nodeIndex: -1, startedDay: 16,
          lastAdvancedDay: 18, currentNodeId: 'festival-register', reason: 'player-declined',
        },
      },
    })
    const result = migrateV1Save(payload(current), content)
    expect(result.status === 'migrated' && result.payload.current.chainProgress['chain-poet']).toMatchObject({
      status: 'active', nodeIndex: -1, lastAdvancedDay: 18, reason: undefined,
    })
    expect(result.status === 'migrated' && result.payload.current.chainProgress['chain-festival']).toMatchObject({
      status: 'interrupted', reason: 'player-declined',
    })
  })
})
