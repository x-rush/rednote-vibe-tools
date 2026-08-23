import type {
  Artifact,
  DistractorCandidate,
  GuessResult,
  QuizQuestion,
  QuizSession,
  StoragePayload,
} from '../content/types.ts'
import { unlockArtifact } from '../game/collection.ts'
import { evaluateGuess, revealNextClue } from '../game/progress.ts'
import { createQuizQuestion, isQuizGenerationError, selectRoundArtifacts } from '../game/quiz.ts'

type StoredState = { payload: StoragePayload }
type QuestionCore = StoredState & { questions: QuizQuestion[]; session: QuizSession }

export type PlayState =
  | (QuestionCore & { screen: 'question' })
  | (QuestionCore & { screen: 'clueRevealed' })
  | (QuestionCore & { screen: 'answering'; selectedOptionId: string })
  | (QuestionCore & { screen: 'feedback'; result: GuessResult })

export type AppState =
  | (StoredState & { screen: 'landing' })
  | (StoredState & { screen: 'intro' })
  | (StoredState & { screen: 'modeSelect' })
  | PlayState
  | (StoredState & { screen: 'summary'; session: QuizSession })
  | (StoredState & { screen: 'collection'; returnTo: 'landing' | 'summary'; summarySession: QuizSession | null })
  | (StoredState & { screen: 'artifactDetail'; artifactId: string; returnTo: 'landing' | 'summary'; summarySession: QuizSession | null })
  | (StoredState & { screen: 'error'; message: string })

export type AppAction =
  | { type: 'showIntro' }
  | { type: 'showModeSelect' }
  | { type: 'startRound'; seed: string; artifacts: readonly Artifact[]; candidates: readonly DistractorCandidate[]; recentArtifactIds: readonly string[] }
  | { type: 'resumeRound'; artifacts: readonly Artifact[]; candidates: readonly DistractorCandidate[] }
  | { type: 'revealClue' }
  | { type: 'selectOption'; optionId: string }
  | { type: 'submitAnswer'; answeredAt: string }
  | { type: 'continueObserving' }
  | { type: 'nextQuestion' }
  | { type: 'exitRound' }
  | { type: 'openCollection' }
  | { type: 'openArtifact'; artifactId: string }
  | { type: 'closeDetail' }
  | { type: 'closeCollection' }
  | { type: 'replay' }
  | { type: 'dataError'; message: string }
  | { type: 'recover' }

export function createInitialState(payload: StoragePayload): AppState {
  return { screen: 'landing', payload }
}

function buildQuestions(artifacts: readonly Artifact[], candidates: readonly DistractorCandidate[], seed: string): QuizQuestion[] | string {
  const questions: QuizQuestion[] = []
  for (const artifact of artifacts) {
    const result = createQuizQuestion(artifact, candidates, `${seed}-${artifact.id}`)
    if (isQuizGenerationError(result)) return result.message
    questions.push(result)
  }
  return questions
}

function withCurrentSession(payload: StoragePayload, session: QuizSession): StoragePayload {
  return { ...payload, currentSession: session }
}

function startRound(
  state: AppState,
  seed: string,
  artifacts: readonly Artifact[],
  candidates: readonly DistractorCandidate[],
  recentArtifactIds: readonly string[],
): AppState {
  const selected = selectRoundArtifacts(artifacts, seed, recentArtifactIds, 5)
  if (selected.length !== 5) return { screen: 'error', payload: state.payload, message: '可用文物不足，无法生成五件题局。' }
  const questions = buildQuestions(selected, candidates, seed)
  if (typeof questions === 'string') return { screen: 'error', payload: state.payload, message: questions }
  const session: QuizSession = {
    seed,
    artifactIds: selected.map(({ id }) => id),
    index: 0,
    answers: [],
    revealedClueIds: [questions[0].clues[0].id],
    score: 0,
    streak: 0,
  }
  return { screen: 'question', questions, session, payload: withCurrentSession(state.payload, session) }
}

function submitAnswer(state: Extract<PlayState, { screen: 'answering' }>, answeredAt: string): AppState {
  const question = state.questions[state.session.index]
  if (!question.options.some(({ id }) => id === state.selectedOptionId)) return state
  const result = evaluateGuess(
    question,
    state.selectedOptionId,
    Math.max(0, state.session.revealedClueIds.length - 1),
    state.session.streak,
  )
  const answer = {
    artifactId: result.artifactId,
    optionId: result.selectedOptionId,
    correct: result.correct,
    additionalCluesUsed: Math.max(0, state.session.revealedClueIds.length - 1),
    stars: result.stars,
    points: result.points,
  }
  const session: QuizSession = {
    ...state.session,
    answers: [...state.session.answers, answer],
    score: state.session.score + result.points,
    streak: result.nextStreak,
  }
  const collection = unlockArtifact(state.payload.collection, result.artifactId, result.stars, answeredAt)
  const payload: StoragePayload = {
    ...state.payload,
    updatedAt: answeredAt,
    collection,
    currentSession: session,
    recentAttempts: [...state.payload.recentAttempts, {
      artifactId: result.artifactId,
      correct: result.correct,
      stars: result.stars,
      answeredAt,
    }].slice(-20),
  }
  return { screen: 'feedback', questions: state.questions, session, result, payload }
}

function uniqueRecent(previous: readonly string[], current: readonly string[]): string[] {
  const combined = [...previous, ...current]
  return combined.filter((id, index) => combined.lastIndexOf(id) === index).slice(-10)
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'showIntro':
      return state.screen === 'landing' ? { screen: 'intro', payload: state.payload } : state
    case 'showModeSelect':
      return state.screen === 'intro' || state.screen === 'landing' ? { screen: 'modeSelect', payload: state.payload } : state
    case 'startRound':
      return state.screen === 'modeSelect'
        ? startRound(state, action.seed, action.artifacts, action.candidates, action.recentArtifactIds)
        : state
    case 'resumeRound': {
      if (state.screen !== 'landing' || !state.payload.currentSession) return state
      const artifactMap = new Map(action.artifacts.map(artifact => [artifact.id, artifact]))
      const selected = state.payload.currentSession.artifactIds.map(id => artifactMap.get(id)).filter((artifact): artifact is Artifact => Boolean(artifact))
      if (selected.length !== state.payload.currentSession.artifactIds.length) return { screen: 'error', payload: state.payload, message: '旧题局引用的文物已经失效。' }
      const questions = buildQuestions(selected, action.candidates, state.payload.currentSession.seed)
      return typeof questions === 'string'
        ? { screen: 'error', payload: state.payload, message: questions }
        : { screen: state.payload.currentSession.revealedClueIds.length > 1 ? 'clueRevealed' : 'question', payload: state.payload, questions, session: state.payload.currentSession }
    }
    case 'revealClue': {
      if (state.screen !== 'question' && state.screen !== 'clueRevealed') return state
      const question = state.questions[state.session.index]
      const revealedClueIds = revealNextClue(question, state.session.revealedClueIds)
      if (revealedClueIds === state.session.revealedClueIds) return state
      const session = { ...state.session, revealedClueIds }
      return { screen: 'clueRevealed', questions: state.questions, session, payload: withCurrentSession(state.payload, session) }
    }
    case 'selectOption':
      if (state.screen !== 'question' && state.screen !== 'clueRevealed') return state
      if (!state.questions[state.session.index].options.some(({ id }) => id === action.optionId)) return state
      return { ...state, screen: 'answering', selectedOptionId: action.optionId }
    case 'submitAnswer':
      return state.screen === 'answering' ? submitAnswer(state, action.answeredAt) : state
    case 'continueObserving': {
      if (state.screen !== 'feedback' || state.result.correct) return state
      const answers = state.session.answers.slice(0, -1)
      const session = { ...state.session, answers }
      return { screen: 'clueRevealed', questions: state.questions, session, payload: withCurrentSession(state.payload, session) }
    }
    case 'nextQuestion': {
      if (state.screen !== 'feedback') return state
      const nextIndex = state.session.index + 1
      if (nextIndex >= state.questions.length) {
        const payload = {
          ...state.payload,
          bestScore: Math.max(state.payload.bestScore, state.session.score),
          currentSession: null,
          recentArtifactIds: uniqueRecent(state.payload.recentArtifactIds, state.session.artifactIds),
        }
        return { screen: 'summary', session: state.session, payload }
      }
      const session = {
        ...state.session,
        index: nextIndex,
        revealedClueIds: [state.questions[nextIndex].clues[0].id],
      }
      return { screen: 'question', questions: state.questions, session, payload: withCurrentSession(state.payload, session) }
    }
    case 'exitRound':
      return 'session' in state ? { screen: 'landing', payload: state.payload } : state
    case 'openCollection':
      return state.screen === 'summary'
        ? { screen: 'collection', payload: state.payload, returnTo: 'summary', summarySession: state.session }
        : { screen: 'collection', payload: state.payload, returnTo: 'landing', summarySession: null }
    case 'openArtifact':
      return state.screen === 'collection'
        ? { screen: 'artifactDetail', payload: state.payload, artifactId: action.artifactId, returnTo: state.returnTo, summarySession: state.summarySession }
        : state
    case 'closeDetail':
      return state.screen === 'artifactDetail'
        ? { screen: 'collection', payload: state.payload, returnTo: state.returnTo, summarySession: state.summarySession }
        : state
    case 'closeCollection':
      if (state.screen !== 'collection') return state
      return state.returnTo === 'summary' && state.summarySession
        ? { screen: 'summary', payload: state.payload, session: state.summarySession }
        : { screen: 'landing', payload: state.payload }
    case 'replay':
      return { screen: 'modeSelect', payload: { ...state.payload, currentSession: null } }
    case 'dataError':
      return { screen: 'error', payload: state.payload, message: action.message }
    case 'recover':
      return { screen: 'landing', payload: { ...state.payload, currentSession: null } }
  }
}
