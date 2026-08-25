import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { selectQuestionIds } from '../quiz/selection'
import type { QuizResult } from '../quiz/types'
import { appReducer, createInitialState, restoreQuizProgress } from './state'
import { shouldPersistScreen } from './useSbtiApp'

const content = validateContent(rawContent)
const questionIds = selectQuestionIds(content, 'state-seed')
const result: QuizResult = {
  code: 'RTLS', completedAt: '2026-08-24T00:00:00.000Z', contentVersion: '1.0.0',
  summary: { code: 'RTLS', typeName: '山司型', creatureId: 'creature-luwu', creatureName: '陆吾', coreDescription: 'test', neighborCode: 'RTLM', dimensions: [] },
}

describe('application state reducer', () => {
  it('moves through intro, quiz, calculating, and result', () => {
    let state = createInitialState()
    state = appReducer(state, { type: 'OPEN_INTRO' })
    state = appReducer(state, { type: 'START', seed: 'state-seed', questionIds })
    expect(state.screen).toBe('quiz')

    for (const questionId of questionIds) {
      state = appReducer(state, { type: 'ANSWER', answer: { questionId, optionId: `option-${questionId}` } })
      state = appReducer(state, { type: 'NEXT' })
    }
    state = appReducer(state, { type: 'SUBMIT' })
    expect(state.screen).toBe('calculating')
    state = appReducer(state, { type: 'CALCULATED', result })
    expect(state.screen).toBe('result')
    expect(state.recentResult).toEqual(result)
  })

  it('prevents incomplete submission and supports previous-answer editing', () => {
    let state = appReducer(createInitialState(), { type: 'START', seed: 'state-seed', questionIds })
    state = appReducer(state, { type: 'ANSWER', answer: { questionId: questionIds[0]!, optionId: 'first' } })
    state = appReducer(state, { type: 'NEXT' })
    state = appReducer(state, { type: 'PREVIOUS' })
    state = appReducer(state, { type: 'ANSWER', answer: { questionId: questionIds[0]!, optionId: 'replacement' } })
    state = appReducer(state, { type: 'SUBMIT' })

    expect(state.screen).toBe('quiz')
    expect(state.progress?.answers).toEqual([{ questionId: questionIds[0], optionId: 'replacement' }])
    expect(state.message).toMatch(/完成全部 24 题/)
  })

  it('opens history, returns home, and restarts without retaining answers', () => {
    let state = createInitialState(result)
    state = appReducer(state, { type: 'OPEN_HISTORY' })
    expect(state.screen).toBe('history')
    state = appReducer(state, { type: 'HOME' })
    state = appReducer(state, { type: 'START', seed: 'fresh', questionIds })
    expect(state.progress?.answers).toEqual([])
    expect(state.progress?.seed).toBe('fresh')
  })

  it('restores valid progress and rejects dangling question references', () => {
    const valid = { seed: 'saved', questionIds, currentIndex: 4, answers: [] }
    expect(restoreQuizProgress(valid, content)).toEqual(valid)
    expect(() => restoreQuizProgress({ ...valid, questionIds: [...questionIds.slice(0, -1), 'missing'] }, content)).toThrow(/unknown question/)
  })

  it('provides an error fallback and recovery path', () => {
    let state = appReducer(createInitialState(), { type: 'FAIL', reason: 'content', message: '内容损坏' })
    expect(state.screen).toBe('error')
    state = appReducer(state, { type: 'RECOVER' })
    expect(state.screen).toBe('landing')
  })

  it('preserves valid in-memory progress when recovering from a storage failure', () => {
    const progress = { seed: 'saved', questionIds, currentIndex: 4, answers: [] }
    let state = createInitialState(undefined, progress)
    state = appReducer(state, { type: 'FAIL', reason: 'storage', message: '保存失败' })
    state = appReducer(state, { type: 'RECOVER' })

    expect(state.screen).toBe('landing')
    expect(state.progress).toEqual(progress)
  })

  it('clears both progress and recent result from in-memory state', () => {
    const state = appReducer(createInitialState(result, { seed: 'saved', questionIds, currentIndex: 0, answers: [] }), { type: 'CLEAR_ALL' })
    expect(state).toEqual({ screen: 'landing' })
  })

  it('never retries persistence while showing a storage error', () => {
    expect(shouldPersistScreen('error')).toBe(false)
    expect(shouldPersistScreen('quiz')).toBe(true)
    expect(shouldPersistScreen('quiz', false)).toBe(false)
  })
})
