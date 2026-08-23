import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { createDefaultStoragePayload } from '../storage/storage.ts'
import { appReducer, createInitialState, type AppState } from '../state/game-state.ts'

const content = parseContent(rawContent)

function runGame(seed: string, correctPattern: readonly boolean[]): AppState {
  let state = createInitialState(createDefaultStoragePayload(content.contentVersion, '2026-08-24T00:00:00.000Z'))
  state = appReducer(state, { type: 'showIntro' })
  state = appReducer(state, { type: 'showModeSelect' })
  state = appReducer(state, {
    type: 'startRound', seed, artifacts: content.content.artifacts,
    candidates: content.content.distractorCandidates, recentArtifactIds: [],
  })
  for (let index = 0; index < 5; index += 1) {
    if (state.screen !== 'question') throw new Error(`expected question ${index}`)
    const question = state.questions[state.session.index]
    const option = correctPattern[index]
      ? question.correctOptionId
      : question.options.find(({ isCorrect }) => !isCorrect)?.id
    if (!option) throw new Error('missing option')
    state = appReducer(state, { type: 'selectOption', optionId: option })
    state = appReducer(state, { type: 'submitAnswer', answeredAt: `2026-08-24T00:0${index}:00.000Z` })
    state = appReducer(state, { type: 'nextQuestion' })
  }
  return state
}

describe('complete five-question simulations', () => {
  it('completes an all-correct game', () => {
    const state = runGame('simulation-perfect', [true, true, true, true, true])
    expect(state.screen).toBe('summary')
    if (state.screen !== 'summary') throw new Error('expected summary')
    expect(state.session.answers).toHaveLength(5)
    expect(state.session.score).toBe(1600)
    expect(state.session.streak).toBe(5)
    expect(state.payload.collection).toHaveLength(5)
  })

  it('completes a mixed game', () => {
    const state = runGame('simulation-mixed', [true, false, true, false, true])
    expect(state.screen).toBe('summary')
    if (state.screen !== 'summary') throw new Error('expected summary')
    expect(state.session.score).toBe(900)
    expect(state.session.streak).toBe(1)
    expect(state.payload.collection).toHaveLength(5)
  })

  it('completes an all-wrong game without blocking collection unlocks', () => {
    const state = runGame('simulation-wrong', [false, false, false, false, false])
    expect(state.screen).toBe('summary')
    if (state.screen !== 'summary') throw new Error('expected summary')
    expect(state.session.score).toBe(0)
    expect(state.session.streak).toBe(0)
    expect(state.payload.collection).toHaveLength(5)
  })
})
