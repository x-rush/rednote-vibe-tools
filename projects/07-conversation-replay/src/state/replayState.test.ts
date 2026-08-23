import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate'
import { buildReplayResult } from '../domain/result'
import { initialReplayState, replayReducer } from './replayState'

const content = parseContent(rawContent)
const ordinaryResult = buildReplayResult({
  relationshipType: 'friend',
  communicationGoal: 'coordinate',
  conflictLevel: 'medium',
  emotionId: 'feel-uneasy',
  originalExpressionId: 'expr-accusation',
  responseId: 'response-discussed',
  intention: 'repair-now',
}, content)
const safetyResult = buildReplayResult({
  relationshipType: 'partner',
  communicationGoal: 'set-boundary',
  conflictLevel: 'safety',
  emotionId: 'feel-afraid',
  originalExpressionId: 'expr-boundary',
  responseId: 'response-refused',
  intention: 'prepare-next-time',
}, content)

describe('replay state model', () => {
  it('moves through landing, intro, scenario selection and wizard', () => {
    const intro = replayReducer(initialReplayState, { type: 'START' })
    const selection = replayReducer(intro, { type: 'ACCEPT_INTRO' })
    const wizard = replayReducer(selection, { type: 'CHOOSE_SCENARIO', scenarioId: 'friend-late' })

    expect(intro.page).toBe('intro')
    expect(selection.page).toBe('scenarioSelect')
    expect(wizard.page).toBe('replayWizard')
    expect(wizard.wizardStep).toBe('relationship')
  })

  it('supports previous step and changing an answer', () => {
    const started = { ...initialReplayState, page: 'replayWizard' as const, wizardStep: 'goal' as const }
    const withAnswer = replayReducer(started, { type: 'SET_ANSWER', key: 'relationshipType', value: 'friend' })
    const back = replayReducer(withAnswer, { type: 'BACK' })

    expect(withAnswer.answers.relationshipType).toBe('friend')
    expect(back.wizardStep).toBe('relationship')
  })

  it('clears stale results when an option changes', () => {
    const state = { ...initialReplayState, page: 'result' as const, result: ordinaryResult }
    const changed = replayReducer(state, { type: 'SET_ANSWER', key: 'conflictLevel', value: 'high' })

    expect(changed.result).toBeUndefined()
    expect(changed.page).toBe('replayWizard')
  })

  it('routes ordinary and safety results to different pages', () => {
    expect(replayReducer(initialReplayState, { type: 'SET_RESULT', result: ordinaryResult }).page).toBe('comparison')
    expect(replayReducer(initialReplayState, { type: 'SET_RESULT', result: safetyResult }).page).toBe('safetyNotice')
  })

  it('supports comparison, result, saved results and restored results', () => {
    const comparison = replayReducer(initialReplayState, { type: 'SET_RESULT', result: ordinaryResult })
    const result = replayReducer(comparison, { type: 'SHOW_RESULT' })
    const saved = replayReducer(result, { type: 'SHOW_SAVED_RESULTS' })
    const restored = replayReducer(saved, { type: 'RESTORE_RESULT', result: ordinaryResult })

    expect(result.page).toBe('result')
    expect(saved.page).toBe('savedResults')
    expect(restored.page).toBe('result')
  })

  it('supports restart and recoverable errors', () => {
    const failed = replayReducer(initialReplayState, { type: 'FAIL', message: '内容损坏' })
    const reset = replayReducer(failed, { type: 'RESTART' })

    expect(failed.page).toBe('error')
    expect(failed.error).toBe('内容损坏')
    expect(reset).toEqual(initialReplayState)
  })
})
