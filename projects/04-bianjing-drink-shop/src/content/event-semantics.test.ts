import { describe, expect, it } from 'vitest'
import type { BusinessEvent, EventEffect } from '../domain/types'
import rawContent from './content.json'

const events = rawContent.content.events as unknown as BusinessEvent[]
const choiceEffects = (eventId: string, choiceId: string): EventEffect[] => {
  const event = events.find((candidate) => candidate.eventId === eventId)
  const choice = event?.choices.find((candidate) => candidate.choiceId === choiceId)
  if (!choice) throw new Error(`测试事件不存在：${eventId}/${choiceId}`)
  return choice.effects
}

describe('high-risk event semantic contracts', () => {
  it('keeps every authored immediate cash loss within the recoverable floor', () => {
    const choices = events.flatMap((event) => event.choices.map((eventChoice) => ({ event, eventChoice })))
    for (const { event, eventChoice } of choices) {
      const immediateMoney = eventChoice.effects
        .filter((effect): effect is Extract<EventEffect, { type: 'money-delta' }> => effect.type === 'money-delta')
        .reduce((sum, effect) => sum + effect.value, 0)
      expect(immediateMoney, `${event.eventId}/${eventChoice.choiceId}`).toBeGreaterThanOrEqual(-20)
    }
  })

  it('marks only non-trading follow-ups as rest eligible', () => {
    const restIds = events.filter((event) => event.allowedOperatingModes?.includes('rest')).map((event) => event.eventId)
    expect(restIds).toEqual([
      'event-wrong-change-delayed',
      'event-neighbor-fire-boundary',
      'event-supplier-honest-return',
    ])
  })
  it('gives six city-life choices two distinct and reachable long-term returns', () => {
    const pairs: Record<string, [string, string]> = {
      'event-wrong-change': ['event-wrong-change-returned', 'event-wrong-change-delayed'],
      'event-traveler-question': ['event-runner-kept-promise', 'event-runner-kept-distance'],
      'event-neighbor-borrow-fire': ['event-neighbor-fire-returned', 'event-neighbor-fire-boundary'],
      'event-new-supplier': ['event-supplier-honest-return', 'event-supplier-tested-return'],
      'event-first-customer': ['event-youth-respect-return', 'event-youth-kindness-return'],
      'event-scholar-critique': ['event-regular-clear-recipe', 'event-regular-sweet-recipe'],
    }

    for (const [starterId, [firstId, secondId]] of Object.entries(pairs)) {
      const starter = events.find((item) => item.eventId === starterId)
      const first = events.find((item) => item.eventId === firstId)
      const second = events.find((item) => item.eventId === secondId)
      expect(starter?.choices[0].followUpEventIds).toEqual([firstId])
      expect(starter?.choices[1].followUpEventIds).toEqual([secondId])
      expect(first).toMatchObject({ category: 'follow-up', weight: 0, oncePerSave: true, tags: expect.arrayContaining(['follow-up']) })
      expect(second).toMatchObject({ category: 'follow-up', weight: 0, oncePerSave: true, tags: expect.arrayContaining(['follow-up']) })
      expect(first?.content).not.toBe(second?.content)
      expect(first?.choices.map((item) => item.resultText)).not.toEqual(second?.choices.map((item) => item.resultText))
    }
  })

  it('charges the returned wrong change and rewards the honest action', () => {
    expect(choiceEffects('event-wrong-change', 'a')).toEqual([
      { type: 'money-delta', value: -4, labelId: 'event-wrong-change-a-effect-1' },
      { type: 'stat-delta', stat: 'energy', value: -2, labelId: 'event-wrong-change-a-effect-2' },
      { type: 'stat-delta', stat: 'reputation', value: 5, labelId: 'event-wrong-change-a-effect-3' },
    ])
    expect(choiceEffects('event-wrong-change', 'b')).toEqual([
      { type: 'money-delta', value: -4, labelId: 'event-wrong-change-b-effect-1' },
      { type: 'stat-delta', stat: 'relationships', value: 2, labelId: 'event-wrong-change-b-effect-2' },
    ])
  })

  it('actually repays the old regular customer credit on the following day', () => {
    expect(choiceEffects('event-old-regular', 'a')).toEqual(expect.arrayContaining([
      {
        type: 'schedule-effect',
        delayDays: 1,
        effects: [{ type: 'money-delta', value: 4, labelId: 'event-old-regular-a-repayment' }],
      },
    ]))
  })

  it('treats helping at the neighborhood feast as work rather than rest', () => {
    expect(choiceEffects('event-community-feast', 'b')).toContainEqual(
      { type: 'stat-delta', stat: 'energy', value: -4, labelId: 'event-community-feast-b-effect-1' },
    )
  })

  it('models both the capacity and rent of expansion', () => {
    expect(choiceEffects('event-shop-renovation', 'a')).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'set-modifier', target: 'visitor-count', value: 3, durationDays: 56 }),
      expect.objectContaining({ type: 'set-modifier', target: 'fixed-cost', value: 2, durationDays: 56 }),
    ]))
  })

  it('gives the hundred-day journal a delayed payoff and keeps bookkeeping savings bounded', () => {
    expect(choiceEffects('event-hundred-day-book', 'a')).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'set-modifier', target: 'energy-cost', value: 1, durationDays: 20 }),
      {
        type: 'schedule-effect',
        delayDays: 20,
        effects: [
          { type: 'stat-delta', stat: 'reputation', value: 10, labelId: 'event-hundred-day-book-a-reputation' },
          { type: 'stat-delta', stat: 'relationships', value: 8, labelId: 'event-hundred-day-book-a-relationships' },
        ],
      },
    ]))
    expect(choiceEffects('event-hundred-day-book', 'b')).toEqual(expect.arrayContaining([
      { type: 'stat-delta', stat: 'energy', value: -3, labelId: 'event-hundred-day-book-b-energy' },
      expect.objectContaining({ type: 'set-modifier', target: 'fixed-cost', value: -1, durationDays: 20 }),
    ]))
  })
})
