import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { seedRng } from '../domain/rng'
import type { GameState } from '../domain/types'
import { basicDecision, makeState } from '../tests/fixtures'
import { resolveResumeRoute } from './resume-route'

function pendingEventState(eventId: string): GameState {
  return makeState({
    page: 'event',
    pendingOpening: {
      resolutionId: `resume-${eventId}`,
      dayContext: {
        day: 10,
        operatingDay: 4,
        weatherId: 'weather-clear',
        seasonId: 'season-early-spring',
        eventVisitorDelta: 0,
        activeTags: [],
      },
      decision: basicDecision,
      visitors: 8,
      sales: [],
      ledger: [],
      moneyDelta: 0,
      energyCost: 8,
      chainInterruptions: [],
      selectionKind: 'event',
      eventId,
      rngState: seedRng(`resume-${eventId}`),
    },
  })
}

describe('resume route', () => {
  it.each([
    ['morning', makeState({ page: 'morning' }), { displayPage: 'morning' }],
    ['settlement', makeState({ page: 'settlement' }), { displayPage: 'settlement' }],
    ['ending', makeState({ page: 'finalEnding' }), { displayPage: 'finalEnding' }],
  ] as const)('resumes %s without an intermediate confirmation page', (_label, state, expected) => {
    expect(resolveResumeRoute(state, shopContent.content)).toEqual(expected)
  })

  it.each([
    ['event-signboard', 'event', 'opening'],
    ['event-cup-shortage', 'business', 'business'],
    ['event-wrong-change', 'event', 'closing'],
  ] as const)('routes unresolved event %s to its authored experience', (eventId, displayPage, eventTiming) => {
    expect(resolveResumeRoute(pendingEventState(eventId), shopContent.content)).toEqual({ displayPage, eventTiming })
  })

  it('normalizes the removed legacy continue page to morning', () => {
    expect(resolveResumeRoute(makeState({ page: 'continueGame' }), shopContent.content)).toEqual({ displayPage: 'morning' })
  })

  it('routes a pending offer or contract scene before any business playback', () => {
    expect(resolveResumeRoute(makeState({ money: -1, page: 'morning', financialHealth: { phase: 'offer', rescueUsed: false } }), shopContent.content))
      .toEqual({ displayPage: 'financialCrisis' })
    expect(resolveResumeRoute(makeState({
      page: 'morning', pendingContractScene: { contractId: 'crisis-credit', trigger: 'first-installment' },
    }), shopContent.content)).toEqual({ displayPage: 'financialCrisis' })
  })
})
