import { describe, expect, it } from 'vitest'
import { businessCompletionAction, createUiFlow, nextDisplayAfterEvent, nextDisplayAfterOpening, reduceUiFlow } from './ui-flow'

describe('UI-only daily flow', () => {
  it('settles a no-event business in one action while preserving event and playback routes', () => {
    expect(businessCompletionAction(false, 'none')).toBe('resolve')
    expect(businessCompletionAction(false, 'event')).toBe('event')
    expect(businessCompletionAction(true, 'none')).toBe('settlement')
  })

  it('skips fake business playback for a rest day unless a due chain arrives', () => {
    expect(nextDisplayAfterOpening('rest')).toBe('settlement')
    expect(nextDisplayAfterOpening('rest', 'opening')).toBe('event')
    expect(nextDisplayAfterOpening('full')).toBe('business')
  })

  it('routes event acknowledgement from its authored timing', () => {
    expect(nextDisplayAfterEvent('opening')).toBe('business')
    expect(nextDisplayAfterEvent('business')).toBe('business')
    expect(nextDisplayAfterEvent('closing')).toBe('settlement')
  })
  it('advances and clamps the three-step guide and four-stage business playback', () => {
    let state = createUiFlow()
    state = reduceUiFlow(state, { type: 'tutorial-next' })
    expect(state.tutorialStep).toBe(1)
    state = reduceUiFlow(state, { type: 'tutorial-skip' })
    expect(state.tutorialStep).toBe(2)
    expect(reduceUiFlow(state, { type: 'tutorial-next' }).tutorialStep).toBe(2)

    state = reduceUiFlow(state, { type: 'business-next' })
    state = reduceUiFlow(state, { type: 'business-next' })
    expect(state.businessStage).toBe(2)
    state = reduceUiFlow(state, { type: 'business-skip' })
    expect(state.businessStage).toBe(3)
    expect(reduceUiFlow(state, { type: 'business-next' }).businessStage).toBe(3)
  })

  it('selects an event before submission and ignores a repeated submit start', () => {
    let state = createUiFlow()
    state = reduceUiFlow(state, { type: 'event-open', timing: 'opening' })
    expect(state.eventStage).toBe('situation')
    state = reduceUiFlow(state, { type: 'select-choice', choiceId: 'choice-a' })
    expect(state.selectedChoiceId).toBe('choice-a')
    expect(state.eventStage).toBe('selection')

    state = reduceUiFlow(state, { type: 'submit-start' })
    expect(state.isSubmitting).toBe(true)
    expect(reduceUiFlow(state, { type: 'submit-start' })).toBe(state)
    expect(reduceUiFlow(state, { type: 'select-choice', choiceId: 'choice-b' })).toBe(state)

    state = reduceUiFlow(state, { type: 'submit-end' })
    expect(state.isSubmitting).toBe(false)
    expect(state.selectedChoiceId).toBe('choice-a')

    state = reduceUiFlow(state, { type: 'event-resolved' })
    expect(state.eventStage).toBe('result')
    state = reduceUiFlow(state, { type: 'event-acknowledge' })
    expect(state.eventNextRoute).toBe('business')
  })

  it('guards duplicate crisis submissions with the shared submitting state', () => {
    const started = reduceUiFlow(createUiFlow(), { type: 'crisis-submit-start' })
    expect(started.isSubmitting).toBe(true)
    expect(reduceUiFlow(started, { type: 'crisis-submit-start' })).toBe(started)
    expect(reduceUiFlow(started, { type: 'crisis-submit-end' }).isSubmitting).toBe(false)
  })

  it.each([
    ['opening', 'business'],
    ['business', 'business'],
    ['closing', 'settlement'],
  ] as const)('routes an acknowledged %s event to %s', (timing, route) => {
    let state = reduceUiFlow(createUiFlow(), { type: 'event-open', timing })
    state = reduceUiFlow(state, { type: 'event-resolved' })
    state = reduceUiFlow(state, { type: 'event-acknowledge' })
    expect(state.eventNextRoute).toBe(route)
  })

  it('toggles the ledger and resets every day-only interaction field', () => {
    let state = createUiFlow()
    state = reduceUiFlow(state, { type: 'tutorial-skip' })
    state = reduceUiFlow(state, { type: 'business-skip' })
    state = reduceUiFlow(state, { type: 'select-choice', choiceId: 'choice-b' })
    state = reduceUiFlow(state, { type: 'toggle-ledger' })
    expect(state.ledgerExpanded).toBe(true)

    expect(reduceUiFlow(state, { type: 'reset-day' })).toEqual({
      tutorialStep: 2,
      businessStage: 0,
      selectedChoiceId: undefined,
      isSubmitting: false,
      ledgerExpanded: false,
      eventStage: 'situation',
      eventTiming: undefined,
      eventNextRoute: undefined,
    })
  })

  it('restarts the guide when the player opens another new shop', () => {
    const completed = reduceUiFlow(createUiFlow(), { type: 'tutorial-skip' })

    expect(reduceUiFlow(completed, { type: 'tutorial-restart' }).tutorialStep).toBe(0)
  })
})
