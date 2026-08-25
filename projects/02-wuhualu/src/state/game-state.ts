import type {
  Artifact,
  ArtifactLearningProgress,
  CasePhase,
  CaseProgress,
  DistractorCandidate,
  GuessResult,
  QuizQuestion,
  QuizSession,
  StoragePayload,
  StorySectionId,
} from '../content/types.ts'
import { hasArtifactExperienceV2 } from '../content/types.ts'
import { unlockArtifact } from '../game/collection.ts'
import { getSetProgress, openClueCard } from '../game/experience.ts'
import { evaluateGuess } from '../game/progress.ts'
import { createQuizQuestion, isQuizGenerationError, selectRoundArtifacts } from '../game/quiz.ts'

type StoredState = { payload: StoragePayload }
type QuestionCore = StoredState & { artifacts: Artifact[]; questions: QuizQuestion[]; session: QuizSession }
type ResultCore = QuestionCore & { result: GuessResult }

export type PlayState =
  | (QuestionCore & { screen: 'observation' | 'clueSelect' })
  | (QuestionCore & { screen: 'answering'; selectedOptionId: string })
  | (ResultCore & { screen: 'wrongReview' | 'reveal' | 'story' | 'memory' | 'archive' })
  | (ResultCore & { screen: 'setComplete'; completedSetId: NonNullable<CaseProgress['completedSetId']> })

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
  | { type: 'discoverSpot'; spotId: string }
  | { type: 'openClue'; clueId: string }
  | { type: 'selectOption'; optionId: string }
  | { type: 'submitAnswer'; answeredAt: string }
  | { type: 'continueToReveal' }
  | { type: 'openStory' }
  | { type: 'markStorySectionRead'; sectionId: StorySectionId }
  | { type: 'answerMemory'; optionId: string }
  | { type: 'archiveArtifact'; artifacts: readonly Artifact[]; archivedAt: string }
  | { type: 'nextQuestion' }
  | { type: 'leaveSetComplete' }
  | { type: 'exitRound' }
  | { type: 'openCollection' }
  | { type: 'openArtifact'; artifactId: string }
  | { type: 'closeDetail' }
  | { type: 'closeCollection' }
  | { type: 'replay' }
  | { type: 'dataError'; message: string }
  | { type: 'recover' }

const CASE_PHASES = new Set<CasePhase>([
  'observation', 'clueSelect', 'answering', 'wrongReview', 'reveal', 'story', 'memory', 'archive', 'setComplete',
])

export function createInitialState(payload: StoragePayload): AppState {
  return { screen: 'landing', payload }
}

function createCaseProgress(): CaseProgress {
  return {
    phase: 'observation',
    openedClueIds: [],
    observedSpotIds: [],
    storyReadSections: [],
    selectedOptionId: null,
    memoryAnswerId: null,
    completedSetId: null,
  }
}

function normalizeCaseProgress(session: QuizSession): CaseProgress {
  const progress = session.caseProgress
  if (!progress || !CASE_PHASES.has(progress.phase)) {
    return { ...createCaseProgress(), openedClueIds: [...new Set(session.revealedClueIds)] }
  }
  const openedClueIds = Array.isArray(progress.openedClueIds) ? progress.openedClueIds.filter(id => typeof id === 'string') : []
  const observedSpotIds = Array.isArray(progress.observedSpotIds) ? progress.observedSpotIds.filter(id => typeof id === 'string') : []
  const storyReadSections = Array.isArray(progress.storyReadSections)
    ? progress.storyReadSections.filter((id): id is StorySectionId => ['first-look', 'making', 'lived-world', 'journey', 'why-now'].includes(id))
    : []
  return {
    phase: progress.phase,
    openedClueIds: [...new Set(openedClueIds)],
    observedSpotIds: [...new Set(observedSpotIds)],
    storyReadSections: [...new Set(storyReadSections)],
    selectedOptionId: typeof progress.selectedOptionId === 'string' ? progress.selectedOptionId : null,
    memoryAnswerId: typeof progress.memoryAnswerId === 'string' ? progress.memoryAnswerId : null,
    completedSetId: progress.completedSetId ?? null,
  }
}

function withProgress(session: QuizSession, progress: CaseProgress): QuizSession {
  return { ...session, revealedClueIds: progress.openedClueIds, caseProgress: progress }
}

function withCurrentSession(payload: StoragePayload, session: QuizSession): StoragePayload {
  return { ...payload, currentSession: session }
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
  const caseProgress = createCaseProgress()
  const session: QuizSession = {
    seed,
    artifactIds: selected.map(({ id }) => id),
    index: 0,
    answers: [],
    revealedClueIds: [],
    score: 0,
    streak: 0,
    caseProgress,
  }
  return {
    screen: 'observation',
    artifacts: selected,
    questions,
    session,
    payload: withCurrentSession(state.payload, session),
  }
}

function currentQuestion(state: QuestionCore): QuizQuestion {
  return state.questions[state.session.index]
}

function currentArtifact(state: QuestionCore): Artifact | undefined {
  return state.artifacts.find(({ id }) => id === currentQuestion(state).artifactId)
}

function resultFromSession(question: QuizQuestion, session: QuizSession): GuessResult | null {
  const answer = session.answers.findLast(({ artifactId }) => artifactId === question.artifactId)
  if (!answer) return null
  return {
    artifactId: answer.artifactId,
    selectedOptionId: answer.optionId,
    correct: answer.correct,
    stars: answer.stars,
    points: answer.points,
    nextStreak: session.streak,
    feedback: answer.correct ? question.successFeedback : question.wrongFeedback,
  }
}

function restorePlayState(
  payload: StoragePayload,
  artifacts: Artifact[],
  questions: QuizQuestion[],
  storedSession: QuizSession,
): AppState {
  const progress = normalizeCaseProgress(storedSession)
  const session = withProgress(storedSession, progress)
  const base: QuestionCore = { payload: withCurrentSession(payload, session), artifacts, questions, session }
  if (progress.phase === 'observation' || progress.phase === 'clueSelect') return { ...base, screen: progress.phase }
  if (progress.phase === 'answering') {
    const optionExists = currentQuestion(base).options.some(({ id }) => id === progress.selectedOptionId)
    return optionExists && progress.selectedOptionId
      ? { ...base, screen: 'answering', selectedOptionId: progress.selectedOptionId }
      : { ...base, screen: 'clueSelect' }
  }
  const result = resultFromSession(currentQuestion(base), session)
  if (!result) return { ...base, screen: 'observation' }
  if (progress.phase === 'setComplete' && progress.completedSetId) {
    return { ...base, screen: 'setComplete', result, completedSetId: progress.completedSetId }
  }
  if (progress.phase === 'setComplete') return { ...base, screen: 'archive', result }
  return { ...base, screen: progress.phase, result }
}

function submitAnswer(state: Extract<PlayState, { screen: 'answering' }>, answeredAt: string): AppState {
  const question = currentQuestion(state)
  if (!question.options.some(({ id }) => id === state.selectedOptionId)) return state
  const progress = normalizeCaseProgress(state.session)
  const result = evaluateGuess(
    question,
    state.selectedOptionId,
    Math.max(0, progress.openedClueIds.length - 1),
    state.session.streak,
  )
  const answer = {
    artifactId: result.artifactId,
    optionId: result.selectedOptionId,
    correct: result.correct,
    additionalCluesUsed: Math.max(0, progress.openedClueIds.length - 1),
    stars: result.stars,
    points: result.points,
  }
  const nextProgress: CaseProgress = { ...progress, phase: result.correct ? 'reveal' : 'wrongReview' }
  const session = withProgress({
    ...state.session,
    answers: [...state.session.answers, answer],
    score: state.session.score + result.points,
    streak: result.nextStreak,
  }, nextProgress)
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
  return {
    screen: result.correct ? 'reveal' : 'wrongReview',
    artifacts: state.artifacts,
    questions: state.questions,
    session,
    result,
    payload,
  }
}

function uniqueRecent(previous: readonly string[], current: readonly string[]): string[] {
  const combined = [...previous, ...current]
  return combined.filter((id, index) => combined.lastIndexOf(id) === index).slice(-10)
}

function mergeLearningProgress(
  entries: readonly ArtifactLearningProgress[],
  artifactId: string,
  progress: CaseProgress,
): ArtifactLearningProgress[] {
  const existing = entries.find(entry => entry.artifactId === artifactId)
  const next: ArtifactLearningProgress = {
    artifactId,
    observedSpotIds: [...new Set([...(existing?.observedSpotIds ?? []), ...progress.observedSpotIds])],
    storyReadSections: [...new Set([...(existing?.storyReadSections ?? []), ...progress.storyReadSections])],
    memoryCompleted: existing?.memoryCompleted === true || progress.memoryAnswerId !== null,
  }
  return [...entries.filter(entry => entry.artifactId !== artifactId), next]
}

function advanceQuestion(state: ResultCore & { screen: 'archive' | 'setComplete' }): AppState {
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
  const session = withProgress({ ...state.session, index: nextIndex }, createCaseProgress())
  return {
    screen: 'observation',
    artifacts: state.artifacts,
    questions: state.questions,
    session,
    payload: withCurrentSession(state.payload, session),
  }
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
        : restorePlayState(state.payload, selected, questions, state.payload.currentSession)
    }
    case 'discoverSpot': {
      if (state.screen !== 'observation' && state.screen !== 'clueSelect') return state
      const artifact = currentArtifact(state)
      if (!artifact || !hasArtifactExperienceV2(artifact) || !artifact.experienceV2.observationSpots.some(({ id }) => id === action.spotId)) return state
      const progress = normalizeCaseProgress(state.session)
      if (progress.observedSpotIds.includes(action.spotId)) return state
      const session = withProgress(state.session, { ...progress, observedSpotIds: [...progress.observedSpotIds, action.spotId] })
      return { ...state, session, payload: withCurrentSession(state.payload, session) }
    }
    case 'openClue': {
      if (state.screen !== 'observation' && state.screen !== 'clueSelect') return state
      const artifact = currentArtifact(state)
      if (!artifact) return state
      const validIds = hasArtifactExperienceV2(artifact)
        ? artifact.experienceV2.clueCards.map(({ id }) => id)
        : currentQuestion(state).clues.map(({ id }) => id)
      if (!validIds.includes(action.clueId)) return state
      const progress = normalizeCaseProgress(state.session)
      const opened = openClueCard(progress.openedClueIds, action.clueId)
      const session = withProgress(state.session, { ...progress, phase: 'clueSelect', openedClueIds: opened.openedIds })
      return { ...state, screen: 'clueSelect', session, payload: withCurrentSession(state.payload, session) }
    }
    case 'selectOption': {
      if (state.screen !== 'observation' && state.screen !== 'clueSelect' && state.screen !== 'answering') return state
      if (!currentQuestion(state).options.some(({ id }) => id === action.optionId)) return state
      const progress = normalizeCaseProgress(state.session)
      const session = withProgress(state.session, { ...progress, phase: 'answering', selectedOptionId: action.optionId })
      return { ...state, screen: 'answering', selectedOptionId: action.optionId, session, payload: withCurrentSession(state.payload, session) }
    }
    case 'submitAnswer':
      return state.screen === 'answering' ? submitAnswer(state, action.answeredAt) : state
    case 'continueToReveal': {
      if (state.screen !== 'wrongReview') return state
      const progress = { ...normalizeCaseProgress(state.session), phase: 'reveal' as const }
      const session = withProgress(state.session, progress)
      return { ...state, screen: 'reveal', session, payload: withCurrentSession(state.payload, session) }
    }
    case 'openStory': {
      if (state.screen !== 'reveal') return state
      const progress = { ...normalizeCaseProgress(state.session), phase: 'story' as const }
      const session = withProgress(state.session, progress)
      return { ...state, screen: 'story', session, payload: withCurrentSession(state.payload, session) }
    }
    case 'markStorySectionRead': {
      if (state.screen !== 'story') return state
      const artifact = currentArtifact(state)
      if (!artifact || !hasArtifactExperienceV2(artifact) || !artifact.experienceV2.story.some(({ id }) => id === action.sectionId)) return state
      const progress = normalizeCaseProgress(state.session)
      if (progress.storyReadSections.includes(action.sectionId)) return state
      const session = withProgress(state.session, { ...progress, storyReadSections: [...progress.storyReadSections, action.sectionId] })
      return { ...state, session, payload: withCurrentSession(state.payload, session) }
    }
    case 'answerMemory': {
      if (state.screen !== 'story') return state
      const artifact = currentArtifact(state)
      if (!artifact || !hasArtifactExperienceV2(artifact)) return state
      const progress = normalizeCaseProgress(state.session)
      if (progress.storyReadSections.length !== artifact.experienceV2.story.length) return state
      if (!artifact.experienceV2.memoryChallenge.options.some(({ id }) => id === action.optionId)) return state
      const session = withProgress(state.session, { ...progress, phase: 'memory', memoryAnswerId: action.optionId })
      return { ...state, screen: 'memory', session, payload: withCurrentSession(state.payload, session) }
    }
    case 'archiveArtifact': {
      if (state.screen !== 'story' && state.screen !== 'memory') return state
      const artifact = currentArtifact(state)
      if (!artifact) return state
      const enhanced = hasArtifactExperienceV2(artifact)
      if (enhanced && state.screen !== 'memory') return state
      const progress = normalizeCaseProgress(state.session)
      const artifactProgress = enhanced
        ? mergeLearningProgress(state.payload.artifactProgress, artifact.id, progress)
        : state.payload.artifactProgress
      const setProgress = getSetProgress(action.artifacts, state.payload.collection, artifact.setId)
      const completedSetId = setProgress.complete && !state.payload.setSealIds.includes(artifact.setId) ? artifact.setId : null
      const phase: CasePhase = completedSetId ? 'setComplete' : 'archive'
      const nextProgress: CaseProgress = { ...progress, phase, completedSetId }
      const session = withProgress(state.session, nextProgress)
      const payload: StoragePayload = {
        ...state.payload,
        updatedAt: action.archivedAt,
        artifactProgress,
        setSealIds: completedSetId ? [...state.payload.setSealIds, completedSetId] : state.payload.setSealIds,
        currentSession: session,
      }
      return completedSetId
        ? { ...state, screen: 'setComplete', completedSetId, session, payload }
        : { ...state, screen: 'archive', session, payload }
    }
    case 'nextQuestion':
      return state.screen === 'archive' ? advanceQuestion(state) : state
    case 'leaveSetComplete':
      return state.screen === 'setComplete' ? advanceQuestion(state) : state
    case 'exitRound':
      return 'session' in state ? { screen: 'landing', payload: state.payload } : state
    case 'openCollection':
      return state.screen === 'summary'
        ? { screen: 'collection', payload: state.payload, returnTo: 'summary', summarySession: state.session }
        : state.screen === 'landing'
          ? { screen: 'collection', payload: state.payload, returnTo: 'landing', summarySession: null }
          : state
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
