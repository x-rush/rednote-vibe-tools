import { useEffect, useMemo, useReducer, useState } from 'react'
import rawContent from './content/content.json'
import { parseContent } from './content/validate'
import { buildScreenViewModelV2, type CompanionViewModel, type ScreenOptionV2 } from './app/viewV2'
import { buildReplayResultV2, filterScenarioCatalog, resolveScenario, type ReplayDraftV2 } from './domain/replay'
import type { CommunicationGoal, RelationshipType } from './domain/types'
import { createInitialReplayStateV2, replayReducerV2, type ReplayPageV2, type ReplayStateV2 } from './state/replayStateV2'
import { STORAGE_KEY } from './storage/storage'
import { STORAGE_KEY_V2, createStoragePayloadV2, restoreStorageV2, saveLocalStateV2, type StorageReferenceIndexV2, type StoredReplayV2 } from './storage/storageV2'
import { QuietShell } from './components/QuietShell'
import { ChoiceGrid } from './components/ChoiceGrid'
import { CompanionNote } from './components/CompanionNote'
import { ChiyanGuide } from './features/intro/ChiyanGuide'
import { LandingHero } from './features/intro/LandingHero'
import { PrivacyStage } from './features/intro/PrivacyStage'
import { StepRail } from './features/replay/StepRail'
import { SentenceDesk } from './features/replay/SentenceDesk'
import { toggleLimitedSelection } from './features/replay/replayInteraction'
import { BeforeAfter, PracticeBoard, ReplayCard, ToneEditor } from './features/result/ResultViews'
import { downloadReplayCard } from './features/result/exportReplayCard'
import { ConfirmSheet, GuideRecall, SavedResults } from './features/system/SystemViews'
import './App.css'

const contentLoad = (() => {
  try { return { content: parseContent(rawContent), error: undefined } }
  catch (error) { return { content: undefined, error: error instanceof Error ? error.message : '内容包未能读取' } }
})()

function buildReferences(): StorageReferenceIndexV2 {
  const content = contentLoad.content
  if (!content) return { scenarioIds: new Set(), feelingIds: new Set(), inferenceExpressionIds: new Set(), needIds: new Set(), factOptionIds: new Set(), requestOptionIds: new Set(), practiceOptionIds: new Set(), practiceReplyIds: new Set() }
  return {
    scenarioIds: new Set(content.content.scenarios.map(({ scenarioId }) => scenarioId)),
    feelingIds: new Set(content.content.feelings.map(({ id }) => id)),
    inferenceExpressionIds: new Set(content.content.choices.filter(({ kind }) => kind === 'original-expression').map(({ id }) => id)),
    needIds: new Set(content.content.needs.map(({ id }) => id)),
    factOptionIds: new Set(content.content.scenarios.flatMap(({ replay }) => replay.factOptions.map(({ id }) => id))),
    requestOptionIds: new Set(content.content.scenarios.flatMap(({ replay }) => replay.requestOptions.map(({ id }) => id))),
    practiceOptionIds: new Set(content.content.scenarios.flatMap(({ replay }) => replay.practiceOptions.map(({ id }) => id))),
    practiceReplyIds: new Set(content.content.scenarios.flatMap(({ replay }) => replay.practiceOptions.flatMap(({ replyOptions }) => replyOptions.map(({ id }) => id)))),
  }
}

function resumePage(draft: ReplayDraftV2): ReplayPageV2 {
  if (!draft.relationshipType) return 'relationship'
  if (!draft.communicationGoal) return 'goal'
  if (!draft.scenarioId) return 'scenario'
  if (draft.conflictLevel === 'safety') return 'safety'
  if (draft.factOptionIds.length === 0) return 'fact'
  if (draft.feelingIds.length === 0) return 'feeling'
  if (draft.inferenceExpressionIds.length === 0) return 'inference'
  if (draft.needIds.length === 0) return 'need'
  if (!draft.requestOptionId) return 'request'
  return 'draft'
}

function initialBootstrap(): { state: ReplayStateV2; savedResults: StoredReplayV2[]; message?: string } {
  const initial = createInitialReplayStateV2()
  const content = contentLoad.content
  if (!content || typeof window === 'undefined') return { state: initial, savedResults: [] }
  const raw = window.localStorage.getItem(STORAGE_KEY_V2) ?? window.localStorage.getItem(STORAGE_KEY)
  const restored = restoreStorageV2(raw, buildReferences(), content.contentVersion)
  if (restored.status === 'corrupt' || restored.status === 'future-version') return { state: { ...initial, page: 'recovery', message: restored.message }, savedResults: [], message: restored.message }
  const draft = restored.payload.data.draft
  return {
    state: draft ? { ...initial, page: resumePage(draft), saveMode: restored.payload.data.saveMode, draft } : { ...initial, saveMode: restored.payload.data.saveMode },
    savedResults: restored.payload.data.savedResults,
    message: restored.message,
  }
}

function PageIntro({ eyebrow, title, lead, companion, showCompanion = true }: { eyebrow: string; title: string; lead: string; companion: CompanionViewModel; showCompanion?: boolean }) {
  return <><header className="page-intro" data-anchor><p className="eyebrow">{eyebrow}</p><h1 id="screen-title">{title}</h1><p className="lead">{lead}</p></header>{showCompanion ? <CompanionNote companion={companion} /> : null}</>
}

function LayerPicker({ screen, initial, max, icon, onContinue }: { screen: ReturnType<typeof buildScreenViewModelV2>; initial: string[]; max: number; icon: 'fact' | 'need'; onContinue(ids: string[]): void }) {
  const [selected, setSelected] = useState(initial)
  return <><ChoiceGrid options={screen.options} selected={selected} icon={icon} onChoose={(option) => setSelected((current) => toggleLimitedSelection(current, option.id, max))} /><button className="button primary full-button" type="button" disabled={selected.length === 0} onClick={() => onContinue(selected)}>{screen.primaryLabel}</button></>
}

function FeelingPicker({ screen, initial, initialIntensity, onContinue }: { screen: ReturnType<typeof buildScreenViewModelV2>; initial: string[]; initialIntensity?: 'light' | 'clear' | 'strong'; onContinue(ids: string[], intensity: 'light' | 'clear' | 'strong'): void }) {
  const [selected, setSelected] = useState(initial)
  const [intensity, setIntensity] = useState<'light' | 'clear' | 'strong'>(initialIntensity ?? 'clear')
  return <>
    <ChoiceGrid options={screen.options} selected={selected} icon="feeling" onChoose={(option) => setSelected((current) => toggleLimitedSelection(current, option.id, 2))} />
    <fieldset className="intensity-field"><legend>感受强度 · 只帮助选词</legend>{([['light', '轻微'], ['clear', '明显'], ['strong', '很强烈']] as const).map(([value, label]) => <button className={intensity === value ? 'is-selected' : ''} type="button" key={value} onClick={() => setIntensity(value)}>{label}</button>)}</fieldset>
    <p className="margin-note"><b>没有好坏分数</b><br />很强烈不代表反应过度，轻微也不代表事情不重要。</p>
    <button className="button primary full-button" type="button" disabled={selected.length === 0} onClick={() => onContinue(selected, intensity)}>{screen.primaryLabel}</button>
  </>
}

function InferenceStep({ fact, options, initial, onContinue }: { fact?: string; options: ScreenOptionV2[]; initial: string[]; onContinue(ids: string[]): void }) {
  const [selected, setSelected] = useState(initial)
  return <><SentenceDesk fact={fact} inferences={options} selected={selected} onChange={setSelected} /><button className="button primary full-button" type="button" disabled={selected.length === 0} onClick={() => onContinue(selected)}>确认推测</button></>
}

function App() {
  const [bootstrap] = useState(initialBootstrap)
  const [state, dispatch] = useReducer(replayReducerV2, bootstrap.state)
  const [savedResults, setSavedResults] = useState(bootstrap.savedResults)
  const [statusMessage, setStatusMessage] = useState(bootstrap.message ?? '')
  const [pendingSave, setPendingSave] = useState<StoredReplayV2>()
  const [pendingDelete, setPendingDelete] = useState<StoredReplayV2>()
  const [savingReplayCard, setSavingReplayCard] = useState(false)
  const content = contentLoad.content
  const screen = useMemo(() => content ? buildScreenViewModelV2(state, content, savedResults) : undefined, [content, savedResults, state])
  const result = useMemo(() => {
    if (!content || !['draft', 'practice', 'comparison', 'result', 'exit', 'recovery'].includes(state.page)) return undefined
    try { return buildReplayResultV2(state.draft, content) } catch { return undefined }
  }, [content, state.draft, state.page])

  useEffect(() => {
    if (!content || state.saveMode !== 'local') return
    try { saveLocalStateV2(window.localStorage, createStoragePayloadV2({ contentVersion: content.contentVersion, saveMode: 'local', draft: state.draft, savedResults })) }
    catch { queueMicrotask(() => setStatusMessage(content.content.intro.system.localSaveFailure)) }
  }, [content, savedResults, state.draft, state.saveMode])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [state.page])

  if (!content || !screen) return <main className="content-error"><h1>内容包未能读取</h1><p>请重新打开页面，原本机数据不会被静默覆盖。</p><pre>{contentLoad.error}</pre></main>
  const intro = content.content.intro
  const scenario = (() => { try { return resolveScenario(state.draft, content) } catch { return undefined } })()

  const chooseScenario = (option: ScreenOptionV2) => {
    const selected = option.id === 'scenario-unsure' ? filterScenarioCatalog(content.content.scenarios, state.draft)[0] ?? resolveScenario(state.draft, content) : content.content.scenarios.find(({ scenarioId }) => scenarioId === option.id)
    if (selected) dispatch({ type: 'SET_SCENARIO', scenarioId: selected.scenarioId, safety: selected.safetyLevel === 'safety' })
  }
  const commitSave = (entry: StoredReplayV2) => {
    setSavedResults((current) => [entry, ...current.filter(({ id }) => id !== entry.id)].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 3))
    dispatch({ type: 'SET_SAVE_MODE', mode: 'local' }); setStatusMessage(content.content.intro.system.localSaveSuccess); setPendingSave(undefined)
  }
  const saveCurrent = () => {
    if (!result || !state.draft.scenarioId) return
    const entry: StoredReplayV2 = { id: `save-${Date.now()}`, savedAt: new Date().toISOString(), scenarioId: result.scenarioId, draft: state.draft }
    if (savedResults.length >= 3) setPendingSave(entry); else commitSave(entry)
  }
  const exportCard = async () => {
    if (!result || savingReplayCard) return
    setSavingReplayCard(true)
    setStatusMessage(content.content.intro.replayCard.savingLabel)
    const copy = content.content.intro.replayCard
    const outcome = await downloadReplayCard({
      title: result.scenarioTitle,
      facts: result.layers.facts,
      feelings: result.layers.feelings,
      inferences: result.layers.inferences,
      needs: result.layers.needs,
      request: result.layers.request,
      selectedText: result.selectedText,
    }, copy)
    const messageByStatus = {
      saved: copy.savedMessage,
      unavailable: copy.unavailableMessage,
      'generation-failed': copy.generationFailedMessage,
      'write-failed': copy.writeFailedMessage,
      'permission-failed': copy.permissionFailedMessage,
    } as const
    setStatusMessage(messageByStatus[outcome.status])
    setSavingReplayCard(false)
  }

  let body
  if (state.page === 'guide') body = <ChiyanGuide companion={screen.companion} title={screen.title} lead={screen.lead} step={state.guideStep} primaryLabel={screen.primaryLabel} secondaryLabel={screen.secondaryLabel ?? '跳过引导'} onNext={() => dispatch({ type: 'NEXT_GUIDE' })} onSkip={() => dispatch({ type: 'SKIP_GUIDE' })} />
  else if (state.page === 'landing') body = <section className="paper-page cover-page"><PageIntro {...screen} showCompanion={false} /><LandingHero companion={screen.companion} beforeText={intro.landing.beforeText} afterText={intro.landing.afterText} /><div className="privacy-note"><b>{intro.landing.privacyNoteTitle}</b><br />{intro.landing.privacyNoteBody}</div><div className="button-stack"><button className="button primary" type="button" onClick={() => dispatch({ type: 'START' })}>{screen.primaryLabel}</button><button className="button ghost" type="button" onClick={() => dispatch({ type: 'SHOW_SAVED' })}>{screen.secondaryLabel}</button></div></section>
  else if (state.page === 'privacy') body = <section className="paper-page privacy-page"><PageIntro {...screen} showCompanion={false} /><PrivacyStage companion={screen.companion} sections={intro.privacy.sections} primaryLabel={intro.privacy.primaryLabel} secondaryLabel={intro.privacy.secondaryLabel} ephemeralDescription={intro.privacy.ephemeralDescription} localDescription={intro.privacy.localDescription} onEphemeral={() => dispatch({ type: 'CHOOSE_MODE', mode: 'ephemeral' })} onLocal={() => dispatch({ type: 'CHOOSE_MODE', mode: 'local' })} /></section>
  else if (state.page === 'relationship' || state.page === 'goal' || state.page === 'scenario') body = <section className="paper-page"><PageIntro {...screen} /><ChoiceGrid options={screen.options} onChoose={(option) => state.page === 'relationship' ? dispatch({ type: 'SET_RELATIONSHIP', value: option.value as RelationshipType }) : state.page === 'goal' ? dispatch({ type: 'SET_GOAL', value: option.value as CommunicationGoal }) : chooseScenario(option)} /></section>
  else if (state.page === 'fact') body = <section className="paper-page"><StepRail current={1} /><PageIntro {...screen} /><LayerPicker key={`fact-${scenario?.scenarioId}`} screen={screen} initial={state.draft.factOptionIds} max={2} icon="fact" onContinue={(ids) => dispatch({ type: 'SET_FACTS', ids })} /></section>
  else if (state.page === 'feeling') body = <section className="paper-page"><StepRail current={2} /><PageIntro {...screen} /><FeelingPicker key={`feeling-${scenario?.scenarioId}`} screen={screen} initial={state.draft.feelingIds} initialIntensity={state.draft.feelingIntensity} onContinue={(ids, intensity) => dispatch({ type: 'SET_FEELINGS', ids, intensity })} /></section>
  else if (state.page === 'inference') body = <section className="paper-page"><StepRail current={3} /><PageIntro {...screen} /><InferenceStep fact={scenario?.replay.factOptions.find(({ id }) => state.draft.factOptionIds.includes(id))?.label} options={screen.options} initial={state.draft.inferenceExpressionIds} onContinue={(ids) => dispatch({ type: 'SET_INFERENCES', ids })} /></section>
  else if (state.page === 'need') body = <section className="paper-page"><StepRail current={4} /><PageIntro {...screen} /><LayerPicker key={`need-${scenario?.scenarioId}`} screen={screen} initial={state.draft.needIds} max={2} icon="need" onContinue={(ids) => dispatch({ type: 'SET_NEEDS', ids })} /></section>
  else if (state.page === 'request') body = <section className="paper-page"><StepRail current={5} /><PageIntro {...screen} /><ChoiceGrid options={screen.options} selected={state.draft.requestOptionId ? [state.draft.requestOptionId] : []} icon="request" onChoose={(option) => dispatch({ type: 'SET_REQUEST', id: option.id })} /><p className="margin-note"><b>{intro.system.requestNoteTitle}</b><br />{intro.system.requestNoteBody}</p></section>
  else if (state.page === 'draft') body = <section className="paper-page"><PageIntro {...screen} /><ToneEditor result={result} copy={intro} edits={state.draft.limitedEdits} onTone={(tone) => dispatch({ type: 'SET_TONE', tone })} onEdit={(tone, text) => dispatch({ type: 'SET_EDIT', tone, text })} onPractice={() => dispatch({ type: 'START_PRACTICE' })} onCompare={() => dispatch({ type: 'SHOW_COMPARISON' })} /></section>
  else if (state.page === 'practice') body = <section className="paper-page"><PageIntro {...screen} /><PracticeBoard copy={intro} prompts={(scenario?.replay.practiceOptions ?? []).map(({ id, label, replyOptions }) => ({ id, label, replies: replyOptions }))} onComplete={(optionId, replyId) => dispatch({ type: 'SET_PRACTICE', optionId, replyId })} /></section>
  else if (state.page === 'comparison') body = <section className="paper-page"><PageIntro {...screen} /><BeforeAfter result={result} copy={intro} onNext={() => dispatch({ type: 'SHOW_RESULT' })} /></section>
  else if (state.page === 'result') body = <section className="paper-page result-page"><PageIntro {...screen} /><ReplayCard result={result} copy={intro} /><div className="button-stack"><button className="button primary" type="button" onClick={saveCurrent}>{screen.primaryLabel}</button><button className="button secondary" type="button" onClick={exportCard} disabled={savingReplayCard}>{savingReplayCard ? intro.replayCard.savingLabel : intro.replayCard.saveLabel}</button><button className="button ghost" type="button" onClick={() => dispatch({ type: 'RESTART' })}>{screen.secondaryLabel}</button></div></section>
  else if (state.page === 'saved') body = <section className="paper-page"><PageIntro {...screen} /><SavedResults items={savedResults} titleForScenario={(scenarioId) => content.content.scenarios.find((item) => item.scenarioId === scenarioId)?.title ?? intro.system.unnamedScenario} onRestore={(item) => dispatch({ type: 'RESTORE_DRAFT', draft: item.draft })} onDelete={setPendingDelete} /><button className="button ghost full-button" type="button" onClick={() => dispatch({ type: 'RESTART' })}>{screen.primaryLabel}</button></section>
  else if (state.page === 'exit') body = <section className="paper-page"><PageIntro {...screen} /><ul className="exit-list">{intro.system.exitItems.map((item) => <li key={item}>{item}</li>)}</ul><div className="button-stack"><button className="button primary" type="button" onClick={() => dispatch({ type: 'BACK' })}>{screen.primaryLabel}</button><button className="button danger" type="button" onClick={() => dispatch({ type: 'RESTART' })}>{screen.secondaryLabel}</button></div></section>
  else if (state.page === 'safety') body = <section className="paper-page safety-page"><PageIntro {...screen} />{screen.sections.map((section) => <article className="safety-box" key={section.id}><h2>{section.title}</h2>{Array.isArray(section.body) ? section.body.map((item) => <p key={item}>{item}</p>) : <p>{section.body}</p>}</article>)}<div className="button-stack"><button className="button danger" type="button" onClick={() => dispatch({ type: 'RESTART' })}>{screen.primaryLabel}</button><button className="button ghost" type="button" onClick={() => dispatch({ type: 'BACK' })}>{screen.secondaryLabel}</button></div></section>
  else body = <section className="paper-page"><PageIntro {...screen} /><div className="recovery-note"><b>{intro.system.recoveryMemoryTitle}</b><br />{intro.system.recoveryMemoryBody}</div><div className="button-stack"><button className="button primary" type="button" onClick={() => state.saveMode === 'local' && saveLocalStateV2(window.localStorage, createStoragePayloadV2({ contentVersion: content.contentVersion, saveMode: 'local', draft: state.draft, savedResults }))}>{screen.primaryLabel}</button><button className="button ghost" type="button" onClick={() => dispatch({ type: 'BACK' })}>{screen.secondaryLabel}</button></div></section>

  return <QuietShell canGoBack={state.page !== 'landing'} saveMode={state.saveMode} onBack={() => dispatch({ type: 'BACK' })} onSaved={() => dispatch({ type: 'SHOW_SAVED' })} onHelp={() => dispatch({ type: 'OPEN_HELP' })}>
    {body}
    {statusMessage ? <p className="status-message" role="status">{statusMessage}</p> : null}
    {state.helpOpen ? <GuideRecall companion={screen.companion} boundaries={content.content.npc.boundaries} page={screen.eyebrow || screen.title} onClose={() => dispatch({ type: 'CLOSE_HELP' })} onExit={() => { dispatch({ type: 'CLOSE_HELP' }); dispatch({ type: 'SHOW_EXIT' }) }} /> : null}
    {pendingSave ? <ConfirmSheet title="最近三份已经存满" body={`继续保存会替换最旧的“${savedResults.at(-1)?.scenarioId ?? '复盘'}”。其他记录与当前内存不会被删除。`} confirmLabel="确认覆盖并保存" onConfirm={() => commitSave(pendingSave)} onCancel={() => setPendingSave(undefined)} /> : null}
    {pendingDelete ? <ConfirmSheet title="删除这份本机复盘？" body="只删除这一份记录；当前正在整理的内容不会被清除。" confirmLabel="确认删除" onConfirm={() => { setSavedResults((items) => items.filter(({ id }) => id !== pendingDelete.id)); setPendingDelete(undefined) }} onCancel={() => setPendingDelete(undefined)} /> : null}
  </QuietShell>
}

export default App
