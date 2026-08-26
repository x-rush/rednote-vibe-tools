import { describe, expect, it } from 'vitest'
import { createInitialReplayStateV2, replayReducerV2 } from './replayStateV2'

describe('V2 replay state', () => {
  it('walks from privacy through the five-layer desk', () => {
    let state = createInitialReplayStateV2()
    state = replayReducerV2(state, { type: 'START' })
    expect(state.page).toBe('privacy')
    state = replayReducerV2(state, { type: 'CHOOSE_MODE', mode: 'ephemeral' })
    expect(state.page).toBe('guide')
    state = replayReducerV2(state, { type: 'SKIP_GUIDE' })
    state = replayReducerV2(state, { type: 'SET_RELATIONSHIP', value: 'friend' })
    state = replayReducerV2(state, { type: 'SET_GOAL', value: 'coordinate' })
    state = replayReducerV2(state, { type: 'SET_SCENARIO', scenarioId: 'friend-late', safety: false })
    expect(state.page).toBe('fact')
    state = replayReducerV2(state, { type: 'SET_FACTS', ids: ['friend-late-fact-observed'] })
    state = replayReducerV2(state, { type: 'SET_FEELINGS', ids: ['feel-worried'], intensity: 'clear' })
    state = replayReducerV2(state, { type: 'SET_INFERENCES', ids: ['expr-accusation'] })
    state = replayReducerV2(state, { type: 'SET_NEEDS', ids: ['need-reliability'] })
    state = replayReducerV2(state, { type: 'SET_REQUEST', id: 'friend-late-request-next' })
    expect(state.page).toBe('draft')
  })

  it('clears scenario-dependent layers when the scenario changes', () => {
    const completed = {
      ...createInitialReplayStateV2(),
      page: 'result' as const,
      draft: {
        ...createInitialReplayStateV2().draft,
        scenarioId: 'friend-late',
        factOptionIds: ['friend-late-fact-observed'],
        feelingIds: ['feel-worried'],
        inferenceExpressionIds: ['expr-accusation'],
        needIds: ['need-reliability'],
        requestOptionId: 'friend-late-request-next',
        practiceOptionId: 'friend-late-practice-1',
        practiceReplyId: 'friend-late-reply-repair-1',
      },
      resultReady: true,
    }

    const changed = replayReducerV2(completed, { type: 'SET_SCENARIO', scenarioId: 'friend-cancel', safety: false })

    expect(changed.draft.scenarioId).toBe('friend-cancel')
    expect(changed.draft.factOptionIds).toEqual([])
    expect(changed.draft.feelingIds).toEqual([])
    expect(changed.draft.requestOptionId).toBeUndefined()
    expect(changed.resultReady).toBe(false)
  })

  it('sends safety scenarios directly to the safety page', () => {
    const state = replayReducerV2(createInitialReplayStateV2(), {
      type: 'SET_SCENARIO',
      scenarioId: 'general-safety',
      safety: true,
    })

    expect(state.page).toBe('safety')
    expect(state.draft.conflictLevel).toBe('safety')
  })

  it('opens and closes help without losing the current page', () => {
    const current = { ...createInitialReplayStateV2(), page: 'inference' as const }
    const open = replayReducerV2(current, { type: 'OPEN_HELP' })
    const closed = replayReducerV2(open, { type: 'CLOSE_HELP' })

    expect(open.helpOpen).toBe(true)
    expect(closed.helpOpen).toBe(false)
    expect(closed.page).toBe('inference')
  })

  it('switches to local mode without moving the current page', () => {
    const current = { ...createInitialReplayStateV2(), page: 'result' as const }
    const changed = replayReducerV2(current, { type: 'SET_SAVE_MODE', mode: 'local' })

    expect(changed.saveMode).toBe('local')
    expect(changed.page).toBe('result')
  })

  it('restores a saved draft directly to its result', () => {
    const savedDraft = {
      ...createInitialReplayStateV2().draft,
      scenarioId: 'friend-late',
      factOptionIds: ['friend-late-fact-observed'],
    }
    const restored = replayReducerV2(createInitialReplayStateV2(), { type: 'RESTORE_DRAFT', draft: savedDraft })

    expect(restored.page).toBe('result')
    expect(restored.draft.scenarioId).toBe('friend-late')
    expect(restored.resultReady).toBe(true)
  })
})
