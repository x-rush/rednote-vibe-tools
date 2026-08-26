import { describe, expect, it } from 'vitest'
import { createGuildState } from '../domain/quests'
import { createStorageEnvelope, persistBeforeTransition } from './controller'

const preference = { minutes: 10 as const, energy: 1 as const, environment: 'indoor' as const, social: 'none' as const, spend: 'none' as const, timeOfDay: 'day' as const, location: 'familiar-indoor' as const, goalId: 'relax', excludedConditions: [] }

describe('application persistence controller', () => {
  it('does not report a persisted transition when localStorage rejects the write', () => {
    const envelope = createStorageEnvelope(createGuildState(preference, 1), '1.0.0', '2026-08-26T08:00:00.000Z')
    const storage = { setItem: () => { throw new Error('quota') } }
    expect(persistBeforeTransition(storage, envelope)).toEqual({ kind: 'temporary-required', reason: 'quota-or-unavailable' })
  })

  it('creates a whitelisted envelope with durable guild settings', () => {
    const guild = { ...createGuildState(preference, 1), settings: { hasSeenGuide: true, softAvoidCategoryIds: ['move' as const] } }
    const envelope = createStorageEnvelope(guild, '1.0.0', '2026-08-26T08:00:00.000Z')
    expect(envelope.data.settings).toEqual({ hasSeenGuide: true, softAvoidCategoryIds: ['move'] })
    expect(JSON.stringify(envelope)).not.toMatch(/image|base64|blob|latitude|proof/i)
  })
})
