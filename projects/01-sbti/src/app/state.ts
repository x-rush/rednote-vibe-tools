import type { ShbtiContentPackage } from '../content/types'
import type { QuizAnswer, QuizProgress, QuizResult } from '../quiz/types'

export type AppScreen = 'landing' | 'intro' | 'quiz' | 'calculating' | 'result' | 'history' | 'error'
export type StorageRecoveryKind = 'cleared' | 'unavailable' | 'write-failed'

export type AppState = {
  screen: AppScreen
  progress?: QuizProgress
  result?: QuizResult
  recentResult?: QuizResult
  message?: string
  errorReason?: 'content' | 'storage'
  recoveryKind?: StorageRecoveryKind
}

export type AppAction =
  | { type: 'OPEN_INTRO' }
  | { type: 'OPEN_HISTORY' }
  | { type: 'OPEN_RECENT_RESULT' }
  | { type: 'START'; seed: string; questionIds: string[] }
  | { type: 'RESTORE'; progress: QuizProgress }
  | { type: 'ANSWER'; answer: QuizAnswer }
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'SUBMIT' }
  | { type: 'CALCULATED'; result: QuizResult }
  | { type: 'HOME' }
  | { type: 'FAIL'; reason: 'content' | 'storage'; message: string; recoveryKind?: StorageRecoveryKind }
  | { type: 'RECOVER' }
  | { type: 'CLEAR_ALL' }

export function createInitialState(recentResult?: QuizResult, progress?: QuizProgress): AppState {
  return { screen: 'landing', recentResult, progress }
}

function replaceAnswer(answers: QuizAnswer[], answer: QuizAnswer) {
  return [...answers.filter((item) => item.questionId !== answer.questionId), answer]
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'OPEN_INTRO':
      return { ...state, screen: 'intro', message: undefined }
    case 'OPEN_HISTORY':
      return { ...state, screen: 'history', message: undefined }
    case 'OPEN_RECENT_RESULT':
      return state.recentResult ? { ...state, screen: 'result', result: state.recentResult, message: undefined } : state
    case 'START':
      return { ...state, screen: 'quiz', result: undefined, message: undefined, progress: { seed: action.seed, questionIds: [...action.questionIds], currentIndex: 0, answers: [] } }
    case 'RESTORE':
      return { ...state, screen: 'quiz', progress: action.progress, message: undefined }
    case 'ANSWER':
      if (!state.progress) return state
      return { ...state, message: undefined, progress: { ...state.progress, answers: replaceAnswer(state.progress.answers, action.answer) } }
    case 'NEXT':
      if (!state.progress) return state
      return { ...state, progress: { ...state.progress, currentIndex: Math.min(state.progress.currentIndex + 1, state.progress.questionIds.length - 1) } }
    case 'PREVIOUS':
      if (!state.progress) return state
      return { ...state, message: undefined, progress: { ...state.progress, currentIndex: Math.max(0, state.progress.currentIndex - 1) } }
    case 'SUBMIT': {
      if (!state.progress) return state
      const answered = new Set(state.progress.answers.map((item) => item.questionId)).size
      if (answered !== state.progress.questionIds.length) return { ...state, message: '请先完成全部 24 题，再让兽格显形。' }
      return { ...state, screen: 'calculating', message: undefined }
    }
    case 'CALCULATED':
      return { ...state, screen: 'result', result: action.result, recentResult: action.result, progress: undefined, message: undefined }
    case 'HOME':
      return { ...state, screen: 'landing', result: undefined, message: undefined }
    case 'FAIL':
      return { ...state, screen: 'error', message: action.message, errorReason: action.reason, recoveryKind: action.recoveryKind }
    case 'RECOVER':
      return state.errorReason === 'storage'
        ? { ...state, screen: 'landing', result: undefined, message: undefined, errorReason: undefined, recoveryKind: undefined }
        : { screen: 'landing', recentResult: state.recentResult }
    case 'CLEAR_ALL':
      return { screen: 'landing' }
  }
}

export function restoreQuizProgress(progress: QuizProgress, content: ShbtiContentPackage): QuizProgress {
  if (progress.questionIds.length !== 24 || new Set(progress.questionIds).size !== 24) throw new Error('Saved progress must contain 24 unique questions')
  const questions = new Map(content.content.questions.map((question) => [question.id, question]))
  for (const questionId of progress.questionIds) {
    if (!questions.has(questionId)) throw new Error(`Saved progress references unknown question: ${questionId}`)
  }
  if (!Number.isInteger(progress.currentIndex) || progress.currentIndex < 0 || progress.currentIndex >= 24) throw new Error('Saved progress has an invalid current index')
  const seen = new Set<string>()
  for (const answer of progress.answers) {
    const question = questions.get(answer.questionId)
    if (!question || !progress.questionIds.includes(answer.questionId)) throw new Error(`Saved answer references unknown question: ${answer.questionId}`)
    if (seen.has(answer.questionId)) throw new Error(`Saved progress repeats answer: ${answer.questionId}`)
    if (!question.options.some((option) => option.id === answer.optionId)) throw new Error(`Saved answer references unknown option: ${answer.optionId}`)
    seen.add(answer.questionId)
  }
  return { seed: progress.seed, questionIds: [...progress.questionIds], currentIndex: progress.currentIndex, answers: progress.answers.map((answer) => ({ ...answer })) }
}
