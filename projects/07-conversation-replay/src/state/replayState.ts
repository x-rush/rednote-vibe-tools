import type { ReplayAnswers, ReplayResult } from '../domain/types'

export type ReplayPage =
  | 'landing'
  | 'intro'
  | 'scenarioSelect'
  | 'replayWizard'
  | 'comparison'
  | 'result'
  | 'savedResults'
  | 'safetyNotice'
  | 'error'

export type WizardStep =
  | 'relationship'
  | 'goal'
  | 'conflict'
  | 'emotion'
  | 'expression'
  | 'response'
  | 'intention'

export type ReplayState = {
  page: ReplayPage
  wizardStep: WizardStep
  answers: Partial<ReplayAnswers>
  result?: ReplayResult
  error?: string
}

export type ReplayAction =
  | { type: 'START' }
  | { type: 'ACCEPT_INTRO' }
  | { type: 'CHOOSE_SCENARIO'; scenarioId?: string }
  | { type: 'SET_ANSWER'; key: keyof ReplayAnswers; value: ReplayAnswers[keyof ReplayAnswers] }
  | { type: 'NEXT_WIZARD' }
  | { type: 'BACK' }
  | { type: 'SET_RESULT'; result: ReplayResult }
  | { type: 'SHOW_RESULT' }
  | { type: 'SHOW_SAVED_RESULTS' }
  | { type: 'RESTORE_RESULT'; result: ReplayResult }
  | { type: 'FAIL'; message: string }
  | { type: 'RESTART' }

export const initialReplayState: ReplayState = {
  page: 'landing',
  wizardStep: 'relationship',
  answers: {},
}

const wizardSteps: WizardStep[] = ['relationship', 'goal', 'conflict', 'emotion', 'expression', 'response', 'intention']
const answerSteps: Partial<Record<keyof ReplayAnswers, WizardStep>> = {
  relationshipType: 'relationship',
  communicationGoal: 'goal',
  conflictLevel: 'conflict',
  emotionId: 'emotion',
  originalExpressionId: 'expression',
  responseId: 'response',
  intention: 'intention',
}

export function replayReducer(state: ReplayState, action: ReplayAction): ReplayState {
  switch (action.type) {
    case 'START':
      return { ...state, page: 'intro', error: undefined }
    case 'ACCEPT_INTRO':
      return { ...state, page: 'scenarioSelect' }
    case 'CHOOSE_SCENARIO':
      return {
        ...state,
        page: 'replayWizard',
        wizardStep: 'relationship',
        answers: { ...state.answers, scenarioId: action.scenarioId },
        result: undefined,
      }
    case 'SET_ANSWER':
      return {
        ...state,
        page: state.result ? 'replayWizard' : state.page,
        wizardStep: state.result ? (answerSteps[action.key] ?? state.wizardStep) : state.wizardStep,
        answers: { ...state.answers, [action.key]: action.value },
        result: undefined,
      }
    case 'NEXT_WIZARD': {
      const index = wizardSteps.indexOf(state.wizardStep)
      return index < wizardSteps.length - 1
        ? { ...state, wizardStep: wizardSteps[index + 1]! }
        : state
    }
    case 'BACK': {
      if (state.page === 'replayWizard') {
        const index = wizardSteps.indexOf(state.wizardStep)
        return index > 0
          ? { ...state, wizardStep: wizardSteps[index - 1]! }
          : { ...state, page: 'scenarioSelect' }
      }
      const previous: Partial<Record<ReplayPage, ReplayPage>> = {
        intro: 'landing',
        scenarioSelect: 'intro',
        comparison: 'replayWizard',
        result: 'comparison',
        savedResults: 'landing',
        safetyNotice: 'replayWizard',
        error: 'landing',
      }
      return { ...state, page: previous[state.page] ?? state.page }
    }
    case 'SET_RESULT':
      return {
        ...state,
        result: action.result,
        page: action.result.safetyNotice ? 'safetyNotice' : 'comparison',
      }
    case 'SHOW_RESULT':
      return state.result ? { ...state, page: 'result' } : state
    case 'SHOW_SAVED_RESULTS':
      return { ...state, page: 'savedResults' }
    case 'RESTORE_RESULT':
      return { ...state, page: 'result', result: action.result, error: undefined }
    case 'FAIL':
      return { ...state, page: 'error', error: action.message }
    case 'RESTART':
      return initialReplayState
  }
}
