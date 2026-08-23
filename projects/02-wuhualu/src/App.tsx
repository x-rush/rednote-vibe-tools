import { useEffect, useReducer, useRef, useState } from 'react'
import rawContent from './content/content.json'
import { parseContent } from './content/validate.ts'
import type { Artifact } from './content/types.ts'
import { shouldShowExitAction } from './app/page-model.ts'
import { buildArtifactDetailViewModel, buildRoundSummaryViewModel } from './game/view-models.ts'
import { appReducer, createInitialState, type AppState } from './state/game-state.ts'
import { clearStorage, loadStorage, saveStorage } from './storage/storage.ts'
import './App.css'

const content = parseContent(rawContent)
const artifacts = content.content.artifacts
const candidates = content.content.distractorCandidates
const copy = content.content.copy
const validArtifactIds = new Set(artifacts.map(({ id }) => id))

function findArtifact(id: string): Artifact | undefined {
  return artifacts.find(artifact => artifact.id === id)
}

function initialAppState(bootstrap: ReturnType<typeof loadStorage>): AppState {
  const state = createInitialState(bootstrap.payload)
  if (bootstrap.recovery === 'corrupt-json') return appReducer(state, { type: 'dataError', message: copy.storageCorruptMessage })
  if (bootstrap.recovery === 'unsupported-schema') return appReducer(state, { type: 'dataError', message: copy.storageVersionMessage })
  if (bootstrap.recovery === 'invalid-payload') return appReducer(state, { type: 'dataError', message: copy.storageInvalidMessage })
  return state
}

function App() {
  const [bootstrap] = useState(() => loadStorage(window.localStorage, validArtifactIds, content.contentVersion))
  const allowPersistence = useRef(!['corrupt-json', 'unsupported-schema', 'invalid-payload'].includes(bootstrap.recovery ?? ''))
  const [state, dispatch] = useReducer(appReducer, bootstrap, initialAppState)

  useEffect(() => {
    if (allowPersistence.current) saveStorage(window.localStorage, state.payload)
  }, [state.payload])

  const resetAfterError = () => {
    clearStorage(window.localStorage)
    allowPersistence.current = true
    dispatch({ type: 'recover' })
  }

  return (
    <main className="app-shell">
      <header className="brand-bar">
        <div><p className="eyebrow">{copy.brand}</p><p className="brand-subtitle">{copy.subtitle}</p></div>
        {shouldShowExitAction(state.screen) && (
          <button className="text-button" type="button" onClick={() => dispatch({ type: 'exitRound' })}>{copy.exitAction}</button>
        )}
      </header>
      <Screen state={state} dispatch={dispatch} resetAfterError={resetAfterError} />
    </main>
  )
}

type ScreenProps = {
  state: AppState
  dispatch: React.Dispatch<Parameters<typeof appReducer>[1]>
  resetAfterError: () => void
}

function Screen({ state, dispatch, resetAfterError }: ScreenProps) {
  if (state.screen === 'landing') {
    const hasSession = Boolean(state.payload.currentSession)
    return (
      <section className="page hero-page" aria-labelledby="landing-title">
        <div className="museum-mark" aria-hidden="true"><span /></div>
        <p className="section-label">{copy.subtitle}</p>
        <h1 id="landing-title">{copy.landingTitle}</h1>
        <p className="lead">{copy.landingBody}</p>
        <dl className="stats-row">
          <div><dt>{copy.progressLabel}</dt><dd>{state.payload.collection.length} / {artifacts.length}</dd></div>
          <div><dt>{copy.bestScoreLabel}</dt><dd>{state.payload.bestScore}</dd></div>
        </dl>
        <div className="action-stack">
          {hasSession && <button className="primary-button" type="button" onClick={() => dispatch({ type: 'resumeRound', artifacts, candidates })}>{copy.continueAction}</button>}
          <button className={hasSession ? 'secondary-button' : 'primary-button'} type="button" onClick={() => dispatch({ type: 'showIntro' })}>{copy.startAction}</button>
          <button className="text-button wide" type="button" onClick={() => dispatch({ type: 'openCollection' })}>{copy.collectionAction}</button>
        </div>
      </section>
    )
  }

  if (state.screen === 'intro') {
    return (
      <section className="page" aria-labelledby="intro-title">
        <p className="section-label">01 · {copy.subtitle}</p>
        <h1 id="intro-title">{copy.introTitle}</h1>
        <p className="lead">{copy.introBody}</p>
        <div className="rule-grid" aria-label={copy.introTitle}>
          <div><strong>5</strong><span>{copy.progressLabel}</span></div>
          <div><strong>3</strong><span>{copy.cluesTitle}</span></div>
          <div><strong>4</strong><span>{copy.optionsTitle}</span></div>
        </div>
        <button className="primary-button" type="button" onClick={() => dispatch({ type: 'showModeSelect' })}>{copy.introAction}</button>
      </section>
    )
  }

  if (state.screen === 'modeSelect') {
    return (
      <section className="page" aria-labelledby="mode-title">
        <p className="section-label">02 · {copy.subtitle}</p>
        <h1 id="mode-title">{copy.modeTitle}</h1>
        <div className="mode-grid">
          <button className="mode-card" type="button" onClick={() => dispatch({ type: 'startRound', seed: `daily-${new Date().toISOString().slice(0, 10)}`, artifacts, candidates, recentArtifactIds: state.payload.recentArtifactIds })}>
            <span className="mode-index">A</span><strong>{copy.dailyMode}</strong><span>{content.meta.updatedAt}</span>
          </button>
          <button className="mode-card" type="button" onClick={() => dispatch({ type: 'startRound', seed: `practice-${Date.now()}`, artifacts, candidates, recentArtifactIds: state.payload.recentArtifactIds })}>
            <span className="mode-index">B</span><strong>{copy.practiceMode}</strong><span>{content.contentVersion}</span>
          </button>
        </div>
      </section>
    )
  }

  if (state.screen === 'question' || state.screen === 'clueRevealed' || state.screen === 'answering') {
    const question = state.questions[state.session.index]
    const selectedOptionId = state.screen === 'answering' ? state.selectedOptionId : null
    const visibleClues = question.clues.filter(({ id }) => state.session.revealedClueIds.includes(id))
    return (
      <section className="page" aria-labelledby="question-title">
        <div className="progress-line"><span>{state.session.index + 1} / {state.questions.length}</span><progress value={state.session.index + 1} max={state.questions.length} /></div>
        <h1 id="question-title">{copy.optionsTitle}</h1>
        <div className="artifact-stage" aria-label={copy.placeholderText}>
          <div className="placeholder-form" aria-hidden="true"><span /><span /><span /></div><p>{copy.placeholderText}</p>
        </div>
        <section className="clue-panel" aria-labelledby="clues-title">
          <h2 id="clues-title">{copy.cluesTitle}</h2>
          <ol>{visibleClues.map(clue => <li key={clue.id}>{clue.text}</li>)}</ol>
          {state.screen !== 'answering' && visibleClues.length < question.clues.length && <button className="secondary-button" type="button" onClick={() => dispatch({ type: 'revealClue' })}>{copy.clueAction}</button>}
        </section>
        <fieldset className="options-grid">
          <legend>{copy.optionsTitle}</legend>
          {question.options.map(option => (
            <button key={option.id} className={selectedOptionId === option.id ? 'option-button selected' : 'option-button'} type="button" aria-pressed={selectedOptionId === option.id} disabled={state.screen === 'answering'} onClick={() => dispatch({ type: 'selectOption', optionId: option.id })}>{option.label}</button>
          ))}
        </fieldset>
        {state.screen === 'answering' && <button className="primary-button" type="button" onClick={() => dispatch({ type: 'submitAnswer', answeredAt: new Date().toISOString() })}>{copy.submitAction}</button>}
      </section>
    )
  }

  if (state.screen === 'feedback') {
    const artifact = findArtifact(state.result.artifactId)
    if (!artifact) return <ErrorPanel message={copy.contentMissingMessage} onReset={() => dispatch({ type: 'recover' })} />
    return (
      <section className="page" aria-labelledby="feedback-title">
        <p className="section-label" aria-live="polite">{state.result.correct ? state.result.feedback : artifact.wrongAnswerExplanation}</p>
        <h1 id="feedback-title">{artifact.name}</h1>
        <div className="star-result" aria-label={`${state.result.stars} / 3`}>{state.result.stars} / 3</div>
        <section className="fact-card"><h2>{copy.factsTitle}</h2><p>{artifact.highlight}</p><p>{artifact.culturalNote}</p><small>{copy.sourceStatusTitle} · {artifact.factCheckStatus}</small></section>
        <div className="action-stack">
          {!state.result.correct && <button className="secondary-button" type="button" onClick={() => dispatch({ type: 'continueObserving' })}>{copy.retryAction}</button>}
          <button className="primary-button" type="button" onClick={() => dispatch({ type: 'nextQuestion' })}>{copy.nextAction}</button>
        </div>
      </section>
    )
  }

  if (state.screen === 'summary') {
    const model = buildRoundSummaryViewModel(state.session, {
      title: copy.summaryTitle, perfect: copy.collectorPerfect, high: copy.collectorHigh,
      mid: copy.collectorMid, low: copy.collectorLow,
    })
    return (
      <section className="page" aria-labelledby="summary-title">
        <p className="section-label">{model.collectorTitle}</p><h1 id="summary-title">{model.title}</h1>
        <div className="summary-score"><span>{copy.scoreLabel}</span><strong>{model.score}</strong></div>
        <dl className="summary-grid"><div><dt>{copy.progressLabel}</dt><dd>{model.totalCount}</dd></div><div><dt>{copy.factsTitle}</dt><dd>{model.correctCount}</dd></div><div><dt>{copy.cluesTitle}</dt><dd>{model.earnedStars}</dd></div></dl>
        <div className="action-stack"><button className="primary-button" type="button" onClick={() => dispatch({ type: 'openCollection' })}>{copy.collectionAction}</button><button className="secondary-button" type="button" onClick={() => dispatch({ type: 'replay' })}>{copy.replayAction}</button></div>
      </section>
    )
  }

  if (state.screen === 'collection') {
    const collectionMap = new Map(state.payload.collection.map(entry => [entry.artifactId, entry]))
    return (
      <section className="page collection-page" aria-labelledby="collection-title">
        <div className="title-row"><h1 id="collection-title">{copy.collectionTitle}</h1><span>{state.payload.collection.length} / {artifacts.length}</span></div>
        {state.payload.collection.length === 0 && <p className="empty-state">{copy.emptyCollection}</p>}
        <ul className="collection-grid">
          {artifacts.map(artifact => {
            const entry = collectionMap.get(artifact.id)
            return <li key={artifact.id}><button className="collection-card" type="button" disabled={!entry} onClick={() => dispatch({ type: 'openArtifact', artifactId: artifact.id })}><span className="collection-figure" aria-hidden="true" /><strong>{entry ? artifact.name : copy.lockedText}</strong><small>{entry ? `${entry.bestStars} / 3` : artifact.periodGroup}</small></button></li>
          })}
        </ul>
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: 'closeCollection' })}>{copy.backAction}</button>
      </section>
    )
  }

  if (state.screen === 'artifactDetail') {
    const artifact = findArtifact(state.artifactId)
    const entry = state.payload.collection.find(item => item.artifactId === state.artifactId)
    if (!artifact || !entry) return <ErrorPanel message={copy.contentMissingMessage} onReset={() => dispatch({ type: 'closeDetail' })} />
    const model = buildArtifactDetailViewModel(artifact, entry, content.content.categories, { verified: copy.verifiedLabel, pending: copy.pendingLabel })
    return (
      <article className="page" aria-labelledby="detail-title">
        <p className="section-label">{model.subtitle}</p><h1 id="detail-title">{model.title}</h1>
        <div className="artifact-stage detail-stage"><div className="placeholder-form" aria-hidden="true"><span /><span /><span /></div><p>{copy.placeholderText}</p></div>
        <p className="tag-line">{model.categoryNames.join(' · ')}</p>
        <section className="fact-card"><h2>{copy.factsTitle}</h2>{model.facts.map(fact => <p key={fact}>{fact}</p>)}</section>
        <dl className="detail-list">
          {model.dimensions && <div><dt>{copy.progressLabel}</dt><dd>{model.dimensions}</dd></div>}
          {model.excavation && <div><dt>{copy.cluesTitle}</dt><dd>{model.excavation}</dd></div>}
          {model.museum && <div><dt>{copy.collectionTitle}</dt><dd>{model.museum}</dd></div>}
          <div><dt>{copy.sourceStatusTitle}</dt><dd>{model.verificationLabel}。{model.sourceNote}</dd></div>
        </dl>
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: 'closeDetail' })}>{copy.backAction}</button>
      </article>
    )
  }

  return <ErrorPanel message={state.message} onReset={resetAfterError} />
}

function ErrorPanel({ message, onReset }: { message: string; onReset: () => void }) {
  return <section className="page error-page" role="alert" aria-labelledby="error-title"><div className="error-mark" aria-hidden="true" /><h1 id="error-title">{copy.errorTitle}</h1><p>{message}</p><button className="primary-button" type="button" onClick={onReset}>{copy.resetAction}</button></section>
}

export default App
