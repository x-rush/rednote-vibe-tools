import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { BusinessEvent, DayContext } from '../domain/types'
import { seedRng } from '../domain/rng'
import { makeState } from '../tests/fixtures'
import { eligibleEvents, interruptExpiredChains, queueFollowUps, resolveChainChoice, selectDailyEvent } from './events'
import { applyEffects } from './effects'
import { calendarDayForOperatingDay } from './campaign'

const context = (day: number, activeTags: string[] = [], operatingDay = 1): DayContext => ({
  day, operatingDay, weatherId: 'weather-clear', seasonId: 'season-early-spring', eventVisitorDelta: 0, activeTags,
})

const advanceBy = (state: ReturnType<typeof makeState>, turns: number) => {
  const operatingDay = state.operatingDay + turns
  return { ...state, operatingDay, day: calendarDayForOperatingDay(operatingDay, shopContent.content.balance.campaign) }
}

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
    const event = { ...(content.events.find((item) => item.eventId === 'event-signboard') as BusinessEvent), cooldownDays: 4 }
    expect(eligibleEvents(makeState({ operatingDay: 5, day: 14, eventLastTriggeredDay: { [event.eventId]: 1 } }), context(14, [], 5), [event], content.chains)).toEqual([event])
  })

  it('only offers a rain event during matching weather', () => {
    const event = content.events.find((item) => item.eventId === 'event-sudden-rain') as BusinessEvent
    const rainEvent = { ...event, conditions: [{ type: 'weather-is' as const, weatherId: 'weather-rain' }] }

    expect(eligibleEvents(makeState({ day: 20 }), context(20), [rainEvent], content.chains)).toEqual([])
    expect(eligibleEvents(
      makeState({ day: 20 }),
      { ...context(20), weatherId: 'weather-rain' },
      [rainEvent],
      content.chains,
    )).toEqual([rainEvent])
  })

  it('selects the same weighted event and RNG continuation from the same state', () => {
    const state = makeState({ day: 20, rngState: seedRng('event-0') })
    const first = selectDailyEvent(state, context(20), content)
    const replay = selectDailyEvent(state, context(20), content)
    expect(first.kind).toBe('event')
    expect(replay).toEqual(first)
  })

  it('returns an explicit no-event fallback for an empty pool', () => {
    const emptyContent = { ...content, events: [], chains: [] }
    expect(selectDailyEvent(makeState(), context(10), emptyContent)).toMatchObject({ kind: 'none' })
  })

  it('queues a branch-specific follow-up two playable turns after its starter choice', () => {
    const base = content.events.find((event) => event.eventId === 'event-signboard') as BusinessEvent
    const starter: BusinessEvent = {
      ...base,
      eventId: 'event-test-starter',
      dayRange: [1, 100],
      choices: [
        { ...base.choices[0], choiceId: 'a', followUpEventIds: ['event-test-followup'] },
        { ...base.choices[1], choiceId: 'b', followUpEventIds: [] },
      ],
    }
    const followUp: BusinessEvent = { ...base, eventId: 'event-test-followup', dayRange: [1, 100], weight: 0, tags: [...base.tags, 'follow-up'] }
    const fixtureContent = { ...content, events: [starter, followUp], chains: [] }

    const queued = queueFollowUps(makeState({ operatingDay: 4, day: 10, pendingFollowUps: [] }), starter.eventId, 'a', fixtureContent)

    expect(queued.pendingFollowUps).toEqual([{ eventId: followUp.eventId, earliestDay: 18 }])
  })

  it('measures cooldown in playable turns instead of skipped calendar dates', () => {
    const event = { ...(content.events.find((item) => item.eventId === 'event-signboard') as BusinessEvent), cooldownDays: 6 }
    const state = makeState({ operatingDay: 5, day: 14, eventLastTriggeredDay: { [event.eventId]: 1 } })

    expect(eligibleEvents(state, context(14, [], 5), [event], content.chains)).toEqual([])
  })

  it('does not start a promise that cannot resolve before the final playable turn', () => {
    const base = content.events.find((event) => event.eventId === 'event-signboard') as BusinessEvent
    const promised: BusinessEvent = {
      ...base,
      eventId: 'event-final-promise',
      dayRange: [1, 100],
      choices: base.choices.map((choice) => ({ ...choice, followUpEventIds: ['event-later'] })),
    }
    const state = makeState({ operatingDay: 30, day: 100 })

    expect(eligibleEvents(state, context(100, [], 30), [promised], [])).toEqual([])
  })

  it('prioritizes a due queued follow-up and only allows explicitly restful content on rest days', () => {
    const base = content.events.find((event) => event.eventId === 'event-signboard') as BusinessEvent
    const ordinary: BusinessEvent = { ...base, eventId: 'event-test-ordinary', dayRange: [1, 100], weight: 10 }
    const followUp: BusinessEvent = { ...base, eventId: 'event-test-followup', dayRange: [1, 100], weight: 0, tags: [...base.tags, 'follow-up'] }
    const restfulFollowUp: BusinessEvent = { ...followUp, allowedOperatingModes: ['rest'] }
    const fixtureContent = { ...content, events: [ordinary, followUp], chains: [] }
    const state = makeState({ day: 10, pendingFollowUps: [{ eventId: followUp.eventId, earliestDay: 10 }] })

    expect(selectDailyEvent(state, context(10), fixtureContent, 'full')).toMatchObject({ kind: 'event', eventId: followUp.eventId })
    expect(selectDailyEvent(state, context(10), fixtureContent, 'rest')).toMatchObject({ kind: 'none' })
    expect(selectDailyEvent(state, context(10), { ...fixtureContent, events: [ordinary, restfulFollowUp] }, 'rest'))
      .toMatchObject({ kind: 'event', eventId: followUp.eventId })
  })

  it('can skip an ordinary event on half day while full day still receives one', () => {
    const state = makeState({ day: 20, rngState: seedRng('event-7') })
    const full = selectDailyEvent(state, context(20), content, 'full')
    const half = selectDailyEvent(state, context(20), content, 'half')

    expect(full.kind).toBe('event')
    expect(half.kind).toBe('none')
  })

  it('prioritizes the next reachable chain node over ordinary events', () => {
    const state = makeState({ day: 10, flags: ['poet-debt-gentle'], chainProgress: {
      'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 0, currentNodeId: 'poet-credit', startedDay: 4, lastAdvancedDay: 4 },
    } })
    const selection = selectDailyEvent(state, context(10), content)
    expect(selection).toMatchObject({ kind: 'chain', chainId: 'chain-poet', nodeId: 'poet-song-spreads' })
  })

  it('waits when the next chain node cannot consume the prior branch state', () => {
    const state = makeState({ day: 10, flags: [], chainProgress: {
      'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 0, currentNodeId: 'poet-credit', startedDay: 4, lastAdvancedDay: 4 },
    } })
    expect(selectDailyEvent(state, context(10), content)).not.toMatchObject({
      kind: 'chain', chainId: 'chain-poet', nodeId: 'poet-song-spreads',
    })
  })

  it('advances and completes chain choices', () => {
    const state = makeState({ day: 12, flags: ['poet-song-shared'], chainProgress: {
      'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 1, currentNodeId: 'poet-song-spreads', startedDay: 4, lastAdvancedDay: 10 },
    } })
    const resolved = resolveChainChoice(state, content.chains[0], 'poet-returns', 'b')
    expect(resolved.state.reputation).toBe(28)
    expect(resolved.state.relationships).toBe(19)
    expect(resolved.state.chainProgress['chain-poet']?.status).toBe('completed')
  })

  it('interrupts a chain whose next node waited past its maximum', () => {
    const state = makeState({ operatingDay: 20, day: 74, chainProgress: {
      'chain-poet': { chainId: 'chain-poet', status: 'active', nodeIndex: 0, currentNodeId: 'poet-credit', startedDay: 4, lastAdvancedDay: 4 },
    } })
    const interrupted = interruptExpiredChains(state, content.chains)
    expect(interrupted.state.chainProgress['chain-poet']).toMatchObject({ status: 'interrupted', reason: 'timeout' })
    expect(interrupted.interruptions).toEqual([{
      chainId: 'chain-poet',
      nodeId: 'poet-song-spreads',
      chainStatus: 'interrupted',
      reasonId: 'timeout',
    }])
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
        state = advanceBy(state, node.minDelayDays)
        const selection = selectDailyEvent(state, context(state.day, [], state.operatingDay), content)
        expect(selection).toMatchObject({ kind: 'chain', chainId: chain.chainId, nodeId: node.nodeId })
        state = resolveChainChoice(state, chain, node.nodeId, node.choices[0].choiceId).state
      }
      expect(state.chainProgress[chain.chainId]).toMatchObject({ status: 'completed' })
    }
  })

  it('completes all twenty authored chain routes without merging earlier choices', () => {
    for (const chain of content.chains) {
      const finalVariants = new Set<string>()
      for (const firstChoiceIndex of [0, 1]) for (const secondChoiceIndex of [0, 1]) {
        const startEvent = content.events.find((event) => event.eventId === chain.startEventId)
        const startChoice = startEvent?.choices.find((choice) => choice.choiceId === chain.startChoiceId)
        let state = makeState({ day: Math.min(50, chain.startDayMax), chainProgress: {} })
        state = applyEffects(state, startChoice?.effects ?? [], { day: state.day, sourceId: chain.startEventId }).state

        state = advanceBy(state, chain.nodes[0].minDelayDays)
        const first = selectDailyEvent(state, context(state.day, [], state.operatingDay), content)
        if (first.kind !== 'chain') throw new Error(`${chain.chainId}: 第一幕不可达`)
        state = resolveChainChoice(
          state,
          chain,
          first.nodeId,
          first.node.choices[firstChoiceIndex].choiceId,
          context(state.day, [], state.operatingDay),
          first.variantId,
        ).state

        state = advanceBy(state, chain.nodes[1].minDelayDays)
        const second = selectDailyEvent(state, context(state.day, [], state.operatingDay), content)
        if (second.kind !== 'chain' || !second.variantId) throw new Error(`${chain.chainId}: 第二幕分支不可达`)
        state = resolveChainChoice(
          state,
          chain,
          second.nodeId,
          second.node.choices[secondChoiceIndex].choiceId,
          context(state.day, [], state.operatingDay),
          second.variantId,
        ).state

        state = advanceBy(state, chain.nodes[2].minDelayDays)
        const third = selectDailyEvent(state, context(state.day, [], state.operatingDay), content)
        if (third.kind !== 'chain' || !third.variantId) throw new Error(`${chain.chainId}: 第三幕分支不可达`)
        finalVariants.add(third.variantId)
        state = resolveChainChoice(
          state,
          chain,
          third.nodeId,
          third.node.choices[0].choiceId,
          context(state.day, [], state.operatingDay),
          third.variantId,
        ).state
        expect(state.chainProgress[chain.chainId]).toMatchObject({ status: 'completed' })
      }
      expect(finalVariants, `${chain.chainId} 应有四种不合流的最终剧情`).toHaveLength(4)
    }
  })
})
