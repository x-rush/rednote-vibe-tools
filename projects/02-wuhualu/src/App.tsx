import { useEffect, useReducer, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import rawContent from './content/content.json'
import { parseContent } from './content/validate.ts'
import type { Artifact, ArtifactSetDefinition, GuideLines, NarrativeChapterId, StorySectionId } from './content/types.ts'
import { buildNarrativeJournalModel, guidePresentationForScreen, pageScrollScope, shouldShowExitAction } from './app/page-model.ts'
import { buildArtifactDetailViewModel, buildRoundSummaryViewModel } from './game/view-models.ts'
import { buildSetCollectionViewModel } from './game/catalog.ts'
import { formatRecentArtifactResponse, pickGuideLine } from './narrative/narrative.ts'
import { appReducer, createInitialState, type AppAction, type AppState, type PlayState } from './state/game-state.ts'
import { clearStorage, loadStorage, saveStorage } from './storage/storage.ts'
import { ArchiveOptions } from './ui/ArchiveOptions.tsx'
import { ArchiveTransfer } from './ui/ArchiveTransfer.tsx'
import { ArtifactEditorialDetail } from './ui/ArtifactEditorialDetail.tsx'
import { ArtifactStory } from './ui/ArtifactStory.tsx'
import { ClueSealRail } from './ui/ClueSealRail.tsx'
import { GuidePresence } from './ui/GuidePresence.tsx'
import { GuidePortraitCard } from './ui/GuidePortraitCard.tsx'
import { MemoryChallenge } from './ui/MemoryChallenge.tsx'
import { NarrativeInterlude } from './ui/NarrativeInterlude.tsx'
import { NarrativeJournal } from './ui/NarrativeJournal.tsx'
import { NarrativePrologue } from './ui/NarrativePrologue.tsx'
import { RevealCabinet } from './ui/RevealCabinet.tsx'
import { SpotlightStage } from './ui/SpotlightStage.tsx'
import { SetCollection } from './ui/SetCollection.tsx'
import { filterPlayableArtifacts, findIncompletePlayableArtifactIds } from './ui/artifact-assets.ts'
import { APP_ICON_URL } from './ui/brand-assets.ts'
import { buildObservationViewModel } from './ui/experience-view-model.ts'
import { buildStoryViewModel } from './ui/story-view-model.ts'
import './App.css'

const content = parseContent(rawContent)
const artifacts = content.content.artifacts
const sets = content.content.sets
const playableArtifacts = filterPlayableArtifacts(artifacts)
const incompletePlayableArtifactIds = findIncompletePlayableArtifactIds(artifacts)
const candidates = content.content.distractorCandidates
const copy = content.content.copy
const narrative = content.content.narrative
const validArtifactIds = new Set(artifacts.map(({ id }) => id))
const guideProps = { guideName: copy.guideName, guideRole: copy.guideRole, askLabel: copy.guideAskAction }
const memoryCopy = {
  eyebrow: copy.memoryEyebrow, title: copy.memoryTitle, submit: copy.memorySubmitAction,
  correct: copy.memoryCorrect, incorrect: copy.memoryIncorrect, archive: copy.memoryArchiveAction,
}

function findArtifact(id: string): Artifact | undefined { return artifacts.find(artifact => artifact.id === id) }
function findSet(id: Artifact['setId']): ArtifactSetDefinition {
  const set = sets.find(item => item.id === id)
  if (!set) throw new Error(`missing artifact set ${id}`)
  return set
}

function initialAppState(bootstrap: ReturnType<typeof loadStorage>): AppState {
  const state = createInitialState(bootstrap.payload)
  if (incompletePlayableArtifactIds.length > 0) return appReducer(state, { type: 'dataError', message: copy.contentMissingMessage })
  if (bootstrap.recovery === 'corrupt-json') return appReducer(state, { type: 'dataError', message: copy.storageCorruptMessage })
  if (bootstrap.recovery === 'unsupported-schema') return appReducer(state, { type: 'dataError', message: copy.storageVersionMessage })
  if (bootstrap.recovery === 'invalid-payload') return appReducer(state, { type: 'dataError', message: copy.storageInvalidMessage })
  return state
}

function contextualGuideLine(state: AppState): string {
  if (!('questions' in state)) return copy.guideHomeLine
  const question = state.questions[state.session.index]
  const artifact = state.artifacts.find(item => item.id === question.artifactId)
  if (!artifact) return copy.contentMissingMessage
  const lines: GuideLines = artifact.experienceV2.guideLines
  const phase = state.screen === 'wrongReview'
    ? 'incorrect'
    : state.screen === 'reveal' || state.screen === 'story' || state.screen === 'memory'
      ? 'correct'
      : state.screen === 'archive' || state.screen === 'setComplete'
        ? 'archived'
        : (state.session.caseProgress?.openedClueIds.length ?? 0) > 0
          ? 'clueOpened'
          : 'beforeObservation'
  return pickGuideLine(lines[phase], state.session.seed, artifact.id, phase)
}

function recentNarrativeResponse(state: Extract<AppState, { screen: 'narrativeInterlude' }>): string | null {
  if (state.chapterId !== 'act-3') return null
  const entry = state.payload.collection.at(-1)
  const artifact = entry ? findArtifact(entry.artifactId) : undefined
  if (!artifact?.experienceV2) return null
  const progress = state.payload.artifactProgress.find(item => item.artifactId === artifact.id)
  const observedId = progress?.observedSpotIds[0]
  const evidence = artifact.experienceV2.observationSpots.find(spot => spot.id === observedId)?.label ?? artifact.summary
  return formatRecentArtifactResponse(narrative.recentArtifactResponseTemplate, artifact.name, evidence)
}

function App() {
  const [bootstrap] = useState(() => loadStorage(window.localStorage, validArtifactIds, content.contentVersion))
  const [guideOpen, setGuideOpen] = useState(false)
  const guideButtonRef = useRef<HTMLButtonElement>(null)
  const allowPersistence = useRef(!['corrupt-json', 'unsupported-schema', 'invalid-payload'].includes(bootstrap.recovery ?? ''))
  const [state, dispatch] = useReducer(appReducer, bootstrap, initialAppState)
  const scrollScope = pageScrollScope(state)

  useEffect(() => { if (allowPersistence.current) saveStorage(window.localStorage, state.payload) }, [state.payload])
  useEffect(() => { window.scrollTo(0, 0) }, [scrollScope])
  const resetAfterError = () => { clearStorage(window.localStorage); allowPersistence.current = true; dispatch({ type: 'recover' }) }
  const closeGuide = () => {
    setGuideOpen(false)
    window.requestAnimationFrame(() => guideButtonRef.current?.focus())
  }

  return (
    <main className="app-shell">
      <header className="brand-bar">
        <div className="brand-identity"><img className="brand-icon" src={APP_ICON_URL} alt="" width="1024" height="1024" /><div><p className="eyebrow">{copy.brand}</p><p className="brand-subtitle">{copy.subtitle}</p></div></div>
        <div className="header-actions">
          <button ref={guideButtonRef} className="guide-avatar-button" type="button" aria-label={`向${copy.guideRole}${copy.guideName}求助`} onClick={() => setGuideOpen(true)}><img src={`${import.meta.env.BASE_URL}assets/wuhualu/guide/guide-avatar-v1.webp`} alt="" width="160" height="160" /><span>问{copy.guideName}</span></button>
          {shouldShowExitAction(state.screen) && <button className="text-button" type="button" onClick={() => dispatch({ type: 'exitRound' })}>{copy.exitAction}</button>}
        </div>
      </header>
      <Screen state={state} dispatch={dispatch} resetAfterError={resetAfterError} />
      {guideOpen && <GuideHelpSheet line={contextualGuideLine(state)} onClose={closeGuide} />}
    </main>
  )
}

function GuideHelpSheet({ line, onClose }: { line: string; onClose: () => void }) {
  const sheetRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose()
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')].filter(element => !element.hasAttribute('disabled'))
      if (focusable.length === 0) return event.preventDefault()
      const first = focusable[0]
      const last = focusable.at(-1) ?? first
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', handleKeyDown); sheetRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', handleKeyDown) }
  }, [onClose])
  return <div className="guide-overlay" role="presentation" onClick={onClose}><section ref={sheetRef} className="guide-sheet" role="dialog" aria-modal="true" aria-label={`与${copy.guideRole}${copy.guideName}对话`} tabIndex={-1} onClick={event => event.stopPropagation()}><button className="guide-sheet__close" type="button" aria-label={copy.closeAction} onClick={onClose}>×</button><GuidePresence line={line} presentation="stage" {...guideProps} /><div className="guide-sheet__controls"><p>{copy.guideHelpBody}</p><button className="primary-button" type="button" onClick={onClose}>{copy.guideReturnAction}</button></div></section></div>
}

type ScreenProps = { state: AppState; dispatch: Dispatch<AppAction>; resetAfterError: () => void }

function Screen({ state, dispatch, resetAfterError }: ScreenProps) {
  if (state.screen === 'landing') {
    const hasSession = Boolean(state.payload.currentSession)
    return <section className="page hero-page" aria-labelledby="landing-title"><div className="landing-heading"><img className="museum-mark" src={APP_ICON_URL} alt="" width="1024" height="1024" /><div><p className="section-label">{copy.subtitle}</p><h1 id="landing-title">{copy.landingTitle}</h1></div></div><p className="lead">{copy.landingBody}</p><GuidePortraitCard variant="landing" imageSrc={`${import.meta.env.BASE_URL}assets/wuhualu/guide/guide-master-v1.webp`} imageAlt={copy.guideLandingImageAlt} guideName={copy.guideName} guideRole={copy.guideRole} line={copy.guideHomeLine} /><dl className="stats-row"><div><dt>{copy.progressLabel}</dt><dd>{state.payload.collection.length} / {artifacts.length}</dd></div><div><dt>{copy.bestScoreLabel}</dt><dd>{state.payload.bestScore}</dd></div></dl><div className="action-stack">{hasSession && <button className="primary-button" type="button" onClick={() => dispatch({ type: 'resumeRound', artifacts: playableArtifacts, candidates })}>{copy.continueAction}</button>}<button className={hasSession ? 'secondary-button' : 'primary-button'} type="button" onClick={() => dispatch({ type: 'showIntro' })}>{copy.startAction}</button><button className="text-button wide" type="button" onClick={() => dispatch({ type: 'openCollection' })}>{copy.collectionAction}</button></div></section>
  }

  if (state.screen === 'intro') return <section className="page intro-page" aria-labelledby="intro-title"><p className="section-label">01 · {copy.subtitle}</p><h1 id="intro-title">{copy.introTitle}</h1><GuidePortraitCard variant="intro" imageSrc={`${import.meta.env.BASE_URL}assets/wuhualu/guide/guide-master-v1.webp`} imageAlt={copy.guideIntroImageAlt} guideName={copy.guideName} guideRole={copy.guideRole} line={copy.guideIntroLine} /><NarrativePrologue fictionLabel={narrative.fictionLabel} beats={narrative.prologue} /><p className="lead intro-lead">{copy.introBody}</p><ol className="intro-steps"><li><span>01</span><div><strong>{copy.introObserveTitle}</strong><p>{copy.introObserveBody}</p></div></li><li><span>02</span><div><strong>{copy.introClueTitle}</strong><p>{copy.introClueBody}</p></div></li><li><span>03</span><div><strong>{copy.introArchiveTitle}</strong><p>{copy.introArchiveBody}</p></div></li></ol><button className="primary-button" type="button" onClick={() => dispatch({ type: 'showModeSelect' })}>{copy.introAction}</button></section>

  if (state.screen === 'modeSelect') {
    const journal = buildNarrativeJournalModel(narrative, state.payload.collection.length, state.payload.seenNarrativeIds, state.payload.deferredNarrativeIds)
    const openJournal = (chapterId: NarrativeChapterId) => dispatch(journal.pendingId === chapterId
      ? { type: 'openPendingNarrative', narrative: narrative.chapters }
      : { type: 'replayNarrative', narrative: narrative.chapters, chapterId })
    return <section className="page" aria-labelledby="mode-title"><p className="section-label">02 · {copy.taskBoardLabel}</p><h1 id="mode-title">{copy.modeTitle}</h1><div className="mode-grid"><button className="mode-card" type="button" onClick={() => dispatch({ type: 'startRound', seed: `daily-${new Date().toISOString().slice(0, 10)}`, artifacts: playableArtifacts, candidates, recentArtifactIds: state.payload.recentArtifactIds })}><span className="mode-index">A</span><strong>{copy.dailyMode}</strong><span>固定五柜 · {content.meta.updatedAt}</span></button><button className="mode-card" type="button" onClick={() => dispatch({ type: 'startRound', seed: `practice-${Date.now()}`, artifacts: playableArtifacts, candidates, recentArtifactIds: state.payload.recentArtifactIds })}><span className="mode-index">B</span><strong>{copy.practiceMode}</strong><span>本期可探索 {playableArtifacts.length} 件</span></button></div><NarrativeJournal narrative={narrative} model={journal} onOpen={openJournal} /><GuidePresence line={copy.guideTaskLine} {...guideProps} /></section>
  }

  if (state.screen === 'narrativeInterlude') {
    const chapter = narrative.chapters.find(item => item.id === state.chapterId)
    if (!chapter) return <ErrorPanel message={copy.contentMissingMessage} onReset={resetAfterError} />
    return <NarrativeInterlude chapter={chapter} fictionLabel={narrative.fictionLabel} recentResponse={recentNarrativeResponse(state)} replay={state.replay} continueLabel={narrative.continueActionLabel} deferLabel={narrative.deferActionLabel} onComplete={() => dispatch({ type: 'completeNarrative' })} onDefer={() => dispatch({ type: 'deferNarrative' })} />
  }

  if (['observation', 'clueSelect', 'answering', 'wrongReview', 'reveal', 'story', 'memory', 'archive', 'setComplete'].includes(state.screen)) return <PlayExperience key={'questions' in state ? state.questions[state.session.index]?.artifactId : state.screen} state={state as PlayState} dispatch={dispatch} />

  if (state.screen === 'summary') {
    const model = buildRoundSummaryViewModel(state.session, { title: copy.summaryTitle, perfect: copy.collectorPerfect, high: copy.collectorHigh, mid: copy.collectorMid, low: copy.collectorLow })
    return <section className="page" aria-labelledby="summary-title"><p className="section-label">{model.collectorTitle}</p><h1 id="summary-title">{model.title}</h1><div className="summary-score"><span>{copy.scoreLabel}</span><strong>{model.score}</strong></div><dl className="summary-grid"><div><dt>完成卷宗</dt><dd>{model.totalCount}</dd></div><div><dt>辨认正确</dt><dd>{model.correctCount}</dd></div><div><dt>所得星数</dt><dd>{model.earnedStars}</dd></div></dl><div className="action-stack"><button className="primary-button" type="button" onClick={() => dispatch({ type: 'openCollection' })}>{copy.collectionAction}</button><button className="secondary-button" type="button" onClick={() => dispatch({ type: 'replay' })}>{copy.replayAction}</button></div></section>
  }

  if (state.screen === 'collection') return <CollectionScreen state={state} dispatch={dispatch} />

  if (state.screen === 'artifactDetail') {
    const artifact = findArtifact(state.artifactId); const entry = state.payload.collection.find(item => item.artifactId === state.artifactId)
    if (!artifact) return <ErrorPanel message={copy.contentMissingMessage} onReset={() => dispatch({ type: 'closeDetail' })} />
    if (!entry) return <article className="page locked-detail"><p className="section-label">{copy.lockedDetailEyebrow}</p><h1>{artifact.name}</h1><div className="locked-detail-slot" role="img" aria-label={`${artifact.name}档案尚未解锁`}><span aria-hidden="true" /></div><p>{findSet(artifact.setId).description}</p><p>{copy.lockedDetailBody}</p><button className="secondary-button" type="button" onClick={() => dispatch({ type: 'closeDetail' })}>{copy.backAction}</button></article>
    const model = buildArtifactDetailViewModel(
      artifact,
      entry,
      content.content.categories,
      { verified: copy.verifiedLabel, pending: copy.pendingLabel },
      { artifacts, sources: content.sources },
    )
    return <ArtifactEditorialDetail model={model} copy={copy} onBack={() => dispatch({ type: 'closeDetail' })} />
  }
  if (state.screen === 'error') return <ErrorPanel message={state.message} onReset={resetAfterError} />
  return null
}

function PlayExperience({ state, dispatch }: { state: PlayState; dispatch: Dispatch<AppAction> }) {
  const question = state.questions[state.session.index]
  const artifact = state.artifacts.find(item => item.id === question.artifactId)
  if (!artifact) return <ErrorPanel message={copy.contentMissingMessage} onReset={() => dispatch({ type: 'recover' })} />
  const progress = state.session.caseProgress; const openedIds = progress?.openedClueIds ?? []
  const eliminatedId = progress?.eliminatedOptionId ?? null
  const observation = buildObservationViewModel(artifact, openedIds, copy.observationInstruction)
  const selectedId = state.screen === 'answering' ? state.selectedOptionId : progress?.selectedOptionId ?? null
  const story = buildStoryViewModel(artifact, artifacts, content.sources)

  if (state.screen === 'observation' || state.screen === 'clueSelect' || state.screen === 'answering') return <section className="page case-page" aria-labelledby="case-title"><div className="progress-line"><span>卷宗 {state.session.index + 1} / {state.questions.length}</span><progress value={state.session.index + 1} max={state.questions.length} /></div><p className="section-label">{copy.observationEyebrow}</p><h1 id="case-title">{copy.observationTitle}</h1><SpotlightStage artifact={artifact} spots={observation.spots} foundIds={progress?.observedSpotIds ?? []} instruction={observation.instruction} copy={{ guideLabel: copy.observationGuideLabel, firstPrompt: copy.observationGuideFirst, continuePrompt: copy.observationGuideContinue, completePrompt: copy.observationGuideComplete, markerLabel: copy.observationMarkerLabel, progressLabel: copy.observationProgressLabel, askLabel: copy.guideAskAction }} onDiscover={spotId => dispatch({ type: 'discoverSpot', spotId })} onAsk={eliminatedId ? undefined : () => dispatch({ type: 'askGuide' })} /><ClueSealRail seals={observation.clueSeals} onOpen={clueId => dispatch({ type: 'openClue', clueId })} copy={{ label: copy.clueBoxLabel, title: copy.clueBoxTitle, firstFree: copy.clueFirstFree, openPrefix: copy.clueOpenPrefix, starBand: copy.clueStarBand }} /><ArchiveOptions options={question.options} selectedId={selectedId} eliminatedId={eliminatedId} onSelect={optionId => dispatch({ type: 'selectOption', optionId })} onConfirm={() => dispatch({ type: 'submitAnswer', answeredAt: new Date().toISOString() })} copy={{ prompt: copy.archivePrompt, eliminated: copy.guideEliminated, stampAction: copy.archiveStampAction, sealCharacter: copy.archiveSealCharacter }} /></section>

  if (state.screen === 'wrongReview') return <section className="page wrong-review"><p className="section-label">{copy.wrongReviewEyebrow}</p><h1>{copy.wrongReviewTitle}</h1><GuidePresence line={pickGuideLine(artifact.experienceV2.guideLines.incorrect, state.session.seed, artifact.id, 'incorrect')} presentation={guidePresentationForScreen('wrongReview')} {...guideProps} /><div className="fact-card"><p>{artifact.wrongAnswerExplanation}</p></div><button className="primary-button" type="button" onClick={() => dispatch({ type: 'continueToReveal' })}>{copy.wrongReviewAction}</button></section>
  if (state.screen === 'reveal') return <section className="page"><RevealCabinet artifact={artifact} result={state.result} /><GuidePresence line={pickGuideLine(artifact.experienceV2.guideLines.correct, state.session.seed, artifact.id, 'correct')} presentation={guidePresentationForScreen('reveal')} {...guideProps} /><button className="primary-button" type="button" onClick={() => dispatch({ type: 'openStory' })}>{copy.revealStoryAction}</button></section>

  if (state.screen === 'story') {
    const readIds = progress?.storyReadSections ?? []; const allRead = readIds.length === story.sections.length
    return <section className="page"><ArtifactStory model={story} readIds={readIds} onSectionRead={(sectionId: StorySectionId) => dispatch({ type: 'markStorySectionRead', sectionId })} copy={{ eyebrow: copy.storyEyebrow, navLabel: copy.storyNavLabel, sectionPrefix: copy.storySectionPrefix, sourcesLabel: copy.storySourcesLabel, sourceLevelSuffix: copy.storySourceLevelSuffix, readAction: copy.storyReadAction, readDone: copy.storyReadDone }} />{allRead ? <MemoryChallenge challenge={artifact.experienceV2.memoryChallenge} answeredId={null} onAnswer={optionId => dispatch({ type: 'answerMemory', optionId })} onArchive={() => undefined} copy={memoryCopy} /> : <p className="reading-gate">{copy.readingGate}</p>}</section>
  }
  if (state.screen === 'memory') return <section className="page"><MemoryChallenge challenge={artifact.experienceV2.memoryChallenge} answeredId={progress?.memoryAnswerId ?? null} onAnswer={() => undefined} onArchive={() => dispatch({ type: 'archiveArtifact', artifacts, archivedAt: new Date().toISOString() })} copy={memoryCopy} /></section>
  if (state.screen === 'archive') {
    const set = findSet(artifact.setId); const position = artifacts.filter(item => item.setId === artifact.setId && item.timelineOrder <= artifact.timelineOrder).length; const guideLine = pickGuideLine(artifact.experienceV2.guideLines.archived, state.session.seed, artifact.id, 'archived')
    return <section className="page"><ArchiveTransfer artifact={artifact} set={set} position={position} related={story.related} guideLine={guideLine} onNext={() => dispatch({ type: 'nextQuestion', narrative: narrative.chapters })} relatedTitle={copy.archiveRelatedTitle} nextAction={copy.archiveNextAction} guide={{ name: copy.guideName, role: copy.guideRole, askAction: copy.guideAskAction }} /></section>
  }
  if (state.screen === 'setComplete') { const set = findSet(state.completedSetId); return <section className="page set-complete"><p className="section-label">{copy.setCompleteEyebrow}</p><div className="set-seal" aria-hidden="true">{set.sealLabel}</div><h1>{set.name}</h1><p>{set.description}</p><GuidePresence line={pickGuideLine(set.guideCompleteLines, state.session.seed, set.id, 'setComplete')} presentation={guidePresentationForScreen('setComplete')} {...guideProps} /><button className="primary-button" type="button" onClick={() => dispatch({ type: 'leaveSetComplete', narrative: narrative.chapters })}>{copy.setCompleteAction}</button></section> }
  return <ErrorPanel message={copy.contentMissingMessage} onReset={() => dispatch({ type: 'recover' })} />
}

function CollectionScreen({ state, dispatch }: { state: Extract<AppState, { screen: 'collection' }>; dispatch: Dispatch<AppAction> }) {
  const groups = buildSetCollectionViewModel(artifacts, state.payload.collection, sets)
  const journal = buildNarrativeJournalModel(narrative, state.payload.collection.length, state.payload.seenNarrativeIds, state.payload.deferredNarrativeIds)
  return <section className="page collection-page" aria-labelledby="collection-title"><div className="title-row"><div><p className="section-label">20 件物华 · 本期可探索 {playableArtifacts.length} 件</p><h1 id="collection-title">{copy.collectionTitle}</h1></div><span>{state.payload.collection.length} / {artifacts.length}</span></div>{state.payload.collection.length === 0 && <p className="empty-state">{copy.emptyCollection}</p>}<NarrativeJournal narrative={narrative} model={journal} onOpen={chapterId => dispatch({ type: 'replayNarrative', narrative: narrative.chapters, chapterId })} /><SetCollection groups={groups} onOpenArtifact={artifactId => dispatch({ type: 'openArtifact', artifactId })} /><button className="secondary-button" type="button" onClick={() => dispatch({ type: 'closeCollection' })}>{copy.backAction}</button></section>
}

function ErrorPanel({ message, onReset }: { message: string; onReset: () => void }) { return <section className="page error-page" role="alert" aria-labelledby="error-title"><div className="error-mark" aria-hidden="true" /><h1 id="error-title">{copy.errorTitle}</h1><p>{message}</p><button className="primary-button" type="button" onClick={onReset}>{copy.resetAction}</button></section> }

export default App
