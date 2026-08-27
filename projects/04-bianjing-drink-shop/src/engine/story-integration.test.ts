import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { BusinessEvent } from '../domain/types'
import { basicDecision, makeState } from '../tests/fixtures'
import { createNewGame, openDay, resolveDay } from './simulator'
import { withDayForecast } from './forecast'

describe('story and economy settlement integration', () => {
  it('enqueues a chosen ordinary follow-up and consumes it only after resolution', () => {
    const fullContent = shopContent.content
    const base = fullContent.events.find((event) => event.eventId === 'event-signboard') as BusinessEvent
    const starter: BusinessEvent = {
      ...base,
      eventId: 'event-test-starter',
      dayRange: [1, 100],
      oncePerSave: true,
      choices: [
        { ...base.choices[0], choiceId: 'a', followUpEventIds: ['event-test-followup'] },
        { ...base.choices[1], choiceId: 'b', followUpEventIds: [] },
      ],
    }
    const followUp: BusinessEvent = { ...base, eventId: 'event-test-followup', dayRange: [1, 100], weight: 0, oncePerSave: true, tags: [...base.tags, 'follow-up'] }
    const content = {
      ...fullContent,
      events: [starter, followUp],
      chains: [],
      balance: { ...fullContent.balance, operatingModes: { ...fullContent.balance.operatingModes, full: { ...fullContent.balance.operatingModes.full, ordinaryEventChance: 1 } } },
    }
    const first = openDay(makeState({ day: 10, pendingFollowUps: [] }), basicDecision, content)
    const afterStarter = resolveDay(first.state, 'a', content).nextState

    expect(afterStarter.pendingFollowUps).toEqual([{ eventId: followUp.eventId, earliestDay: 18 }])

    const secondState = withDayForecast({ ...afterStarter, operatingDay: 6, day: 18, page: 'morning', dayForecast: undefined }, content)
    const second = openDay(secondState, basicDecision, content)
    expect(second.selection).toMatchObject({ kind: 'event', eventId: followUp.eventId })
    expect(resolveDay(second.state, 'a', content).nextState.pendingFollowUps).toEqual([])
  })

  it('returns an exact event result snapshot alongside the immutable base plan', () => {
    const content = shopContent.content
    const initial = createNewGame('day-one-0', 'story-result', content)
    const opened = openDay(initial, basicDecision, content)
    const baseLedger = opened.state.pendingOpening?.ledger ?? []
    const result = resolveDay(opened.state, 'a', content)

    expect(result.eventResolution).toEqual({
      eventId: 'event-first-customer',
      choiceId: 'a',
      moneyDelta: -2,
      statDeltas: { relationships: 4, reputation: 2 },
      activatedModifierIds: [],
    })
    expect(result.ledger.slice(0, baseLedger.length)).toEqual(baseLedger)
    expect(result.nextState.eventHistory.at(-1)).toMatchObject({
      eventId: 'event-first-customer',
      choiceId: 'a',
      moneyDelta: -2,
    })
  })

  it('reports the chain started by an ordinary entrance choice', () => {
    const fullContent = shopContent.content
    const chain = fullContent.chains[0]
    const event = fullContent.events.find((item) => item.eventId === chain.startEventId)!
    const isolated = {
      ...fullContent,
      events: [event],
      chains: [chain],
      balance: { ...fullContent.balance, operatingModes: { ...fullContent.balance.operatingModes, full: { ...fullContent.balance.operatingModes.full, ordinaryEventChance: 1 } } },
    }
    const opened = openDay(makeState({ day: event.dayRange[0], money: 500, energy: 100 }), basicDecision, isolated)
    const result = resolveDay(opened.state, chain.startChoiceId, isolated)
    expect(result.eventResolution).toMatchObject({ chainId: chain.chainId, chainStatus: 'active' })
  })

  it('completes all five chains through natural cross-day openings without duplicate entrances', () => {
    const fullContent = shopContent.content
    for (const chain of fullContent.chains) {
      const startEvent = fullContent.events.find((event) => event.eventId === chain.startEventId)
      expect(startEvent).toBeDefined()
      const startDay = startEvent?.dayRange[0] ?? 1
      let state = makeState({
        day: startDay,
        money: 500,
        energy: 100,
        page: 'morning',
        flags: ['joint-purchase', 'old-supplier-supported'],
        chainProgress: {},
      })
      const entranceContent = {
        ...fullContent,
        events: startEvent ? [startEvent] : [],
        chains: [chain],
        balance: { ...fullContent.balance, operatingModes: { ...fullContent.balance.operatingModes, full: { ...fullContent.balance.operatingModes.full, ordinaryEventChance: 1 } } },
      }
      const entrance = openDay(state, basicDecision, entranceContent)
      expect(entrance.selection).toMatchObject({ kind: 'event', eventId: chain.startEventId })
      state = resolveDay(entrance.state, chain.startChoiceId, entranceContent).nextState
      expect(state.chainProgress[chain.chainId]).toMatchObject({ status: 'active', nodeIndex: -1 })

      const followUpContent = { ...fullContent, events: [], chains: [chain] }
      const seenNodeIds: string[] = []
      for (let elapsedDay = 0; elapsedDay < 40 && state.chainProgress[chain.chainId]?.status === 'active'; elapsedDay += 1) {
        const opened = openDay(state, basicDecision, followUpContent)
        const choiceId = opened.selection.kind === 'chain' ? opened.selection.node.choices[0].choiceId : undefined
        if (opened.selection.kind === 'chain') seenNodeIds.push(opened.selection.nodeId)
        state = resolveDay(opened.state, choiceId, followUpContent).nextState
      }

      expect(seenNodeIds).toEqual(chain.nodes.map((node) => node.nodeId))
      expect(new Set(seenNodeIds).size).toBe(chain.nodes.length)
      expect(state.chainProgress[chain.chainId]).toMatchObject({ status: 'completed', nodeIndex: 2 })
    }
  })
})
