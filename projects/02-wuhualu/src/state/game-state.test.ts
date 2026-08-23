import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { createDefaultStoragePayload } from '../storage/storage.ts'
import { appReducer, createInitialState } from './game-state.ts'

const content = parseContent(rawContent)
const payload = createDefaultStoragePayload(content.contentVersion, '2026-08-24T00:00:00.000Z')

function startedState() {
  let state = createInitialState(payload)
  state = appReducer(state, { type: 'showIntro' })
  state = appReducer(state, { type: 'showModeSelect' })
  state = appReducer(state, {
    type: 'startRound', seed: 'state-test', artifacts: content.content.artifacts,
    candidates: content.content.distractorCandidates, recentArtifactIds: [],
  })
  return state
}

describe('application state machine', () => {
  it('moves from landing through intro and mode selection to a five-item question', () => {
    const state = startedState()
    expect(state.screen).toBe('question')
    if (state.screen !== 'question') throw new Error('expected question')
    expect(state.questions).toHaveLength(5)
    expect(state.session.revealedClueIds).toHaveLength(1)
  })

  it('reveals, selects, submits once, unlocks, and advances', () => {
    let state = startedState()
    state = appReducer(state, { type: 'revealClue' })
    expect(state.screen).toBe('clueRevealed')
    if (state.screen !== 'clueRevealed') throw new Error('expected clue')
    const correct = state.questions[0].correctOptionId
    state = appReducer(state, { type: 'selectOption', optionId: correct })
    expect(state.screen).toBe('answering')
    state = appReducer(state, { type: 'submitAnswer', answeredAt: '2026-08-24T00:01:00.000Z' })
    expect(state.screen).toBe('feedback')
    if (state.screen !== 'feedback') throw new Error('expected feedback')
    expect(state.result).toMatchObject({ correct: true, stars: 2, points: 200 })
    expect(state.payload.collection).toHaveLength(1)
    const duplicate = appReducer(state, { type: 'submitAnswer', answeredAt: '2026-08-24T00:01:01.000Z' })
    expect(duplicate).toBe(state)
    state = appReducer(state, { type: 'nextQuestion' })
    expect(state.screen).toBe('question')
  })

  it('supports collection, detail, exit, replay, error, and recovery states', () => {
    let state = startedState()
    state = appReducer(state, { type: 'exitRound' })
    expect(state.screen).toBe('landing')
    state = appReducer(state, { type: 'openCollection' })
    expect(state.screen).toBe('collection')
    state = appReducer(state, { type: 'openArtifact', artifactId: content.content.artifacts[0].id })
    expect(state.screen).toBe('artifactDetail')
    state = appReducer(state, { type: 'closeDetail' })
    expect(state.screen).toBe('collection')
    state = appReducer(state, { type: 'dataError', message: '坏内容' })
    expect(state.screen).toBe('error')
    state = appReducer(state, { type: 'recover' })
    expect(state.screen).toBe('landing')
    state = appReducer(state, { type: 'replay' })
    expect(state.screen).toBe('modeSelect')
  })
})
