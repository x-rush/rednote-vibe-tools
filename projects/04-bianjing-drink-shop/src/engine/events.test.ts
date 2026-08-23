import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { BusinessEvent, DayContext } from '../domain/types'
import { makeState } from '../tests/fixtures'
import { eligibleEvents, interruptExpiredChains, resolveChainChoice, selectDailyEvent } from './events'
import { applyEffects } from './effects'

const context = (day: number, activeTags: string[] = []): DayContext => ({
  day, weatherId: 'weather-clear', seasonId: 'season-early-spring', eventVisitorDelta: 0, activeTags,
})

describe('daily event engine', () => {
  const content = shopContent.content

  it('filters by date, prerequisites, cooldown, once-only, and conflict tags', () => {
    const base = content.events.find((event) => event.eventId === 'event-signboard') as BusinessEvent
    const candidates: BusinessEvent[] = [
      base,
      { ...base, eventId: 'event-future', dayRange: [50, 60] },
      { ...base, eventId: 'event-condition', conditions: [{ type: 'has-flag', flag: 'required' }] },
      { ...base, eventId: 'event-once', oncePerSave: true },
      { ...base, eventId: 'event-conflict', conflictTags: ['quiet-day'] },
    ]
    const state = makeState({ day: 10, triggeredEventIds: ['event-once'], eventLastTriggeredDay: { 'event-signboard': 5 } })

    expect(eligibleEvents(state, context(10, ['quiet-day']), candidates, content.chains)).toEqual([])
  })

  it('allows an event again exactly when its cooldown has elapsed', () => {
    const event = content.events.find((item) => item.eventId === 'event-signboard') as BusinessEvent
    expect(eligibleEvents(makeState({ day: 11, eventLastTriggeredDay: { [event.eventId]: 1 } }), context(11), [event], content.chains)).toEqual([event])
  })

  it('selects the same weighted event and RNG continuation from the same state', () => {
    const state = makeState({ day: 20 })
    const first = selectDailyEvent(state, context(20), content)
    const replay = selectDailyEvent(state, context(20), content)
    expect(first.kind).toBe('event')
    expect(replay).toEqual(first)
  })

  it('returns an explicit no-event fallback for an empty pool', () => {
    const emptyContent = { ...content, events: [], chains: [] }
    expect(selectDailyEvent(makeState(), context(10), emptyContent)).toMatchObject({ kind: 'none' })
  })

  it('prioritizes the next reachable chain node over ordinary events', () => {
    const state = makeState({ day: 10, chainProgress: {
      'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 0, currentNodeId: 'poet-credit', startedDay: 4, lastAdvancedDay: 4 },
    } })
    const selection = selectDailyEvent(state, context(10), content)
    expect(selection).toMatchObject({ kind: 'chain', chainId: 'chain-poet', nodeId: 'poet-song-spreads' })
  })

  it('advances and completes chain choices', () => {
    const state = makeState({ day: 12, chainProgress: {
      'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 1, currentNodeId: 'poet-song-spreads', startedDay: 4, lastAdvancedDay: 10 },
    } })
    const resolved = resolveChainChoice(state, content.chains[0], 'poet-returns', 'b')
    expect(resolved.state.reputation).toBe(28)
    expect(resolved.state.relationships).toBe(19)
    expect(resolved.state.chainProgress['chain-poet']?.status).toBe('completed')
  })

  it('interrupts a chain whose next node waited past its maximum', () => {
    const state = makeState({ day: 30, chainProgress: {
      'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 0, currentNodeId: 'poet-credit', startedDay: 4, lastAdvancedDay: 4 },
    } })
    expect(interruptExpiredChains(state, content.chains).chainProgress['chain-poet']).toMatchObject({ status: 'interrupted', reason: 'timeout' })
  })

  it('does not offer a new three-stage chain after day 90', () => {
    const signature = content.events.find((event) => event.eventId === 'event-signature-drink') as BusinessEvent
    expect(eligibleEvents(makeState({ day: 95 }), context(95), [signature], content.chains)).toEqual([])
  })

  it('can reach completion through every node of all five chains', () => {
    for (const chain of content.chains) {
      const startEvent = content.events.find((event) => event.eventId === chain.startEventId)
      const startChoice = startEvent?.choices.find((choice) => choice.choiceId === chain.startChoiceId)
      expect(startChoice).toBeDefined()
      let state = makeState({ day: Math.min(50, chain.startDayMax), chainProgress: {} })
      state = applyEffects(state, startChoice?.effects ?? [], { day: state.day, sourceId: chain.startEventId }).state
      for (const node of chain.nodes) {
        state = { ...state, day: state.chainProgress[chain.chainId].lastAdvancedDay + node.minDelayDays }
        const selection = selectDailyEvent(state, context(state.day), content)
        expect(selection).toMatchObject({ kind: 'chain', chainId: chain.chainId, nodeId: node.nodeId })
        state = resolveChainChoice(state, chain, node.nodeId, node.choices[0].choiceId).state
      }
      expect(state.chainProgress[chain.chainId]).toMatchObject({ status: 'completed' })
    }
  })
})
