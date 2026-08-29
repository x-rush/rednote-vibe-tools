import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { QuestCatalog } from './content/catalog'
import type { CompletedQuest, EarthOnlineContent, QuestPreference, UnsuitableReason } from './content/schema'
import { validateContent } from './content/validate'
import { createPageViewModel } from './app/view-model'
import { appReducer, createInitialAppState, shouldPersistAppState, type AppState } from './app/state'
import { createStorageEnvelope, persistBeforeTransition } from './app/controller'
import { matchQuest } from './domain/matcher'
import { acceptQuest, abandonQuest, completeQuest, createGuildState, offerQuest, setGuideSeen, setSoftAvoidCategory, swapQuest, undoSoftAvoidCategory, type GuildDomainState } from './domain/quests'
import { createIndexedDbAdventureLog, createMemoryAdventureLog, type AdventureLogRepository } from './storage/adventure-log'
import { clearState, loadState, saveState } from './storage/storage'
import { CheckIn } from './ui/CheckIn'
import { GuildFrame, GuildHall } from './ui/GuildFrame'
import { MiraGuide } from './ui/MiraGuide'
import { ActiveQuestView, MatchingRitual, QuestOffer } from './ui/QuestFlow'
import { AdventureLog, AdventurerProfile, BadgeShelf, CategoryCodex, RecoveryPanel, XpReceipt } from './ui/ArchiveViews'
import { AbandonSheet, CompletionConfirm, MiraHelpSheet, UnsuitableSheet } from './ui/FeedbackSheets'
import { assets } from './ui/asset-paths'
import { createInitialUiState, uiReducer } from './ui/state'
import './App.css'

const defaultPreference: QuestPreference = { minutes: 15, energy: 1, environment: 'indoor', social: 'none', spend: 'none', timeOfDay: 'day', location: 'familiar-indoor', goalId: 'relax', excludedConditions: [] }

export type AppProps = { content: EarthOnlineContent; catalog: QuestCatalog; bootstrapError?: 'archive-load' }

function App({ content, catalog, bootstrapError }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => initializeState(content, catalog, bootstrapError))
  const [uiState, uiDispatch] = useReducer(uiReducer, undefined, () => createInitialUiState(prefersReducedMotion(), state.guild.settings.hasSeenGuide || state.page === 'error'))
  const [preference, setPreference] = useState(state.guild.preference)
  const [questActionBusy, setQuestActionBusy] = useState(false)
  const [archiveDegraded, setArchiveDegraded] = useState(false)
  const pendingMatch = useRef<null | (() => void)>(null)
  const temporaryTransition = useRef<null | (() => void)>(null)
  const matchingTimer = useRef<number | undefined>(undefined)
  const helpButton = useRef<HTMLButtonElement>(null)
  const adventureLog = useRef<AdventureLogRepository | null>(null)
  if (adventureLog.current === null) adventureLog.current = typeof indexedDB === 'undefined' ? createMemoryAdventureLog() : createIndexedDbAdventureLog(indexedDB)
  const model = useMemo(() => createPageViewModel(state, content, catalog), [state, content, catalog])
  const activeQuest = state.guild.activeQuest ? catalog.resolve(state.guild.activeQuest.questId, state.guild.activeQuest.questContentVersion) : undefined
  const offeredQuest = state.guild.offeredQuestId ? catalog.activeById.get(state.guild.offeredQuestId) : undefined
  const settledEntry = state.page === 'questComplete' || state.page === 'questAbandoned' ? state.guild.history.at(-1) : undefined
  const settledQuest = settledEntry ? catalog.resolve(settledEntry.questId, settledEntry.questContentVersion) : undefined
  const matchingConditions = useMemo(() => preferenceSummary(preference, content), [preference, content])

  useEffect(() => {
    if (!shouldPersistAppState(state) || uiState.temporaryMode) return
    const envelope = createStorageEnvelope(state.guild, content.contentVersion, new Date().toISOString())
    const saved = saveState(window.localStorage, envelope)
    if (!saved.ok) {
      temporaryTransition.current = () => dispatch({ type: 'RESTORE', payload: envelope.data })
      uiDispatch({ type: 'ENTER_TEMPORARY_MODE' })
      dispatch({ type: 'FAIL', code: 'storage-write', message: content.content.ui.notices.temporary, recoverable: true })
    }
  }, [state, uiState.temporaryMode, content.contentVersion, content.content.ui.notices.temporary])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => uiDispatch({ type: 'SET_REDUCED_MOTION', value: query.matches })
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: uiState.reducedMotion ? 'auto' : 'smooth' })
  }, [state.page, uiState.reducedMotion])

  useEffect(() => () => {
    if (matchingTimer.current !== undefined) window.clearTimeout(matchingTimer.current)
  }, [])

  const issueQuest = (nextPreference: QuestPreference, swapping = false, guildOverride?: GuildDomainState) => {
    if (swapping && !offeredQuest) return
    uiDispatch({ type: 'START_MATCHING' })
    const baseState = { ...(guildOverride ?? state.guild), preference: nextPreference }
    const completed: CompletedQuest[] = baseState.history.filter((entry) => entry.status === 'completed' && entry.completionDate).map((entry) => ({ acceptanceId: entry.acceptanceId, questId: entry.questId, acceptedAt: entry.occurredAt, completedAt: entry.occurredAt, completionDate: entry.completionDate!, xpAwarded: entry.xpAwarded }))
    const result = matchQuest(catalog.active, nextPreference, { seed: baseState.rngState, nowDate: localDateKey(), recentQuestIds: baseState.recentQuestIds, completed, abandoned: baseState.history.filter(({ status }) => status === 'abandoned'), previousCategoryIds: baseState.history.map(({ questCategory }) => questCategory).slice(-2), softAvoidCategoryIds: baseState.settings.softAvoidCategoryIds, copy: content.content.ui.matching })
    const finish = () => {
      uiDispatch({ type: 'END_MATCHING' })
      if (result.kind === 'no-match') { dispatch({ type: 'NO_MATCH', message: content.content.ui.recovery.noMatchTitle, reasons: result.reasons }); return }
      const now = new Date().toISOString()
      const nextGuild = swapping && offeredQuest ? swapQuest(baseState, offeredQuest, result, now) : offerQuest(baseState, result, now)
      if (uiState.temporaryMode) {
        dispatch(swapping
          ? { type: 'QUEST_SWAPPED', state: nextGuild, explanation: result }
          : { type: 'OFFER_CREATED', state: nextGuild, explanation: result })
        return
      }
      const persisted = persistBeforeTransition(window.localStorage, createStorageEnvelope(nextGuild, content.contentVersion, now))
      if (persisted.kind !== 'persisted') {
        temporaryTransition.current = () => dispatch(swapping
          ? { type: 'QUEST_SWAPPED', state: nextGuild, explanation: result }
          : { type: 'OFFER_CREATED', state: nextGuild, explanation: result })
        uiDispatch({ type: 'ENTER_TEMPORARY_MODE' })
        dispatch({ type: 'FAIL', code: 'storage-write', message: content.content.ui.notices.temporary, recoverable: true })
        return
      }
      dispatch(swapping
        ? { type: 'QUEST_SWAPPED', state: nextGuild, explanation: result }
        : { type: 'OFFER_CREATED', state: nextGuild, explanation: result })
    }
    pendingMatch.current = finish
    if (uiState.reducedMotion) { finishPendingMatch(); return }
    matchingTimer.current = window.setTimeout(finishPendingMatch, 720)
  }

  const finishPendingMatch = () => {
    if (matchingTimer.current !== undefined) window.clearTimeout(matchingTimer.current)
    matchingTimer.current = undefined
    const finish = pendingMatch.current
    pendingMatch.current = null
    finish?.()
  }

  const acceptOfferedQuest = () => {
    if (!offeredQuest) return
    setQuestActionBusy(true)
    const now = new Date().toISOString()
    const nextGuild = acceptQuest(state.guild, offeredQuest, now)
    if (uiState.temporaryMode) {
      dispatch({ type: 'QUEST_ACCEPTED', state: nextGuild })
      setQuestActionBusy(false)
      return
    }
    const persisted = persistBeforeTransition(window.localStorage, createStorageEnvelope(nextGuild, content.contentVersion, now))
    if (persisted.kind === 'persisted') dispatch({ type: 'QUEST_ACCEPTED', state: nextGuild })
    else {
      temporaryTransition.current = () => dispatch({ type: 'QUEST_ACCEPTED', state: nextGuild })
      uiDispatch({ type: 'ENTER_TEMPORARY_MODE' })
      dispatch({ type: 'FAIL', code: 'storage-write', message: content.content.ui.notices.temporary, recoverable: true })
    }
    setQuestActionBusy(false)
  }

  const confirmCompletion = () => {
    if (!activeQuest) return
    const now = new Date().toISOString()
    const completeTemporarily = () => {
      const temporaryResult = completeQuest(state.guild, activeQuest, [], now, localDateKey())
      dispatch({ type: 'QUEST_COMPLETED', result: { ...temporaryResult, state: { ...temporaryResult.state, xp: state.guild.xp, streak: state.guild.streak, unlockedBadgeIds: state.guild.unlockedBadgeIds, completedQuestIds: state.guild.completedQuestIds, categoryCompletionCounts: state.guild.categoryCompletionCounts }, awardedXp: 0, newlyUnlockedBadgeIds: [] } })
      uiDispatch({ type: 'CLOSE_SHEET' })
    }
    if (uiState.temporaryMode) {
      completeTemporarily()
      return
    }
    const result = completeQuest(state.guild, activeQuest, content.content.badges, now, localDateKey())
    const persisted = persistBeforeTransition(window.localStorage, createStorageEnvelope(result.state, content.contentVersion, now))
    if (persisted.kind !== 'persisted') { temporaryTransition.current = completeTemporarily; uiDispatch({ type: 'ENTER_TEMPORARY_MODE' }); uiDispatch({ type: 'CLOSE_SHEET' }); dispatch({ type: 'FAIL', code: 'storage-write', message: content.content.ui.notices.temporary, recoverable: true }); return }
    dispatch({ type: 'QUEST_COMPLETED', result })
    uiDispatch({ type: 'CLOSE_SHEET' })
    const entry = result.state.history.at(-1)
    if (entry) void adventureLog.current?.append(entry).catch(() => setArchiveDegraded(true))
  }

  const confirmAbandon = (reason?: UnsuitableReason) => {
    if (!activeQuest) return
    const now = new Date().toISOString()
    const nextGuild = abandonQuest(state.guild, activeQuest, now)
    if (!uiState.temporaryMode) {
      const persisted = persistBeforeTransition(window.localStorage, createStorageEnvelope(nextGuild, content.contentVersion, now))
      if (persisted.kind !== 'persisted') { temporaryTransition.current = () => dispatch({ type: 'QUEST_ABANDONED', state: nextGuild }); uiDispatch({ type: 'ENTER_TEMPORARY_MODE' }); uiDispatch({ type: 'CLOSE_SHEET' }); dispatch({ type: 'FAIL', code: 'storage-write', message: content.content.ui.notices.temporary, recoverable: true }); return }
    }
    dispatch({ type: 'QUEST_ABANDONED', state: nextGuild })
    uiDispatch({ type: 'CLOSE_SHEET' })
    if (!uiState.temporaryMode) {
      const entry = nextGuild.history.at(-1)
      if (entry) void adventureLog.current?.append(entry).catch(() => setArchiveDegraded(true))
      if (reason) void adventureLog.current?.recordFeedback({ questId: activeQuest.questId, category: activeQuest.category, reason, updatedAt: now }).catch(() => setArchiveDegraded(true))
    }
  }

  const currentFeedbackQuest = activeQuest ?? offeredQuest
  const confirmUnsuitable = (reason: UnsuitableReason) => {
    if (!currentFeedbackQuest) return
    const now = new Date().toISOString()
    const nextGuild = setSoftAvoidCategory(state.guild, currentFeedbackQuest.category)
    if (!uiState.temporaryMode) {
      const persisted = persistBeforeTransition(window.localStorage, createStorageEnvelope(nextGuild, content.contentVersion, now))
      if (persisted.kind !== 'persisted') { temporaryTransition.current = () => dispatch({ type: 'GUILD_UPDATED', state: nextGuild }); uiDispatch({ type: 'ENTER_TEMPORARY_MODE' }); uiDispatch({ type: 'CLOSE_SHEET' }); dispatch({ type: 'FAIL', code: 'storage-write', message: content.content.ui.notices.temporary, recoverable: true }); return }
      void adventureLog.current?.recordFeedback({ questId: currentFeedbackQuest.questId, category: currentFeedbackQuest.category, reason, updatedAt: now }).catch(() => setArchiveDegraded(true))
    }
    dispatch({ type: 'GUILD_UPDATED', state: nextGuild })
    uiDispatch({ type: 'CLOSE_SHEET' })
    if (state.page === 'questOffer') issueQuest(nextGuild.preference, true, nextGuild)
  }

  const undoUnsuitable = () => {
    if (!currentFeedbackQuest) return
    const now = new Date().toISOString()
    const nextGuild = undoSoftAvoidCategory(state.guild, currentFeedbackQuest.category)
    if (!uiState.temporaryMode) {
      const persisted = persistBeforeTransition(window.localStorage, createStorageEnvelope(nextGuild, content.contentVersion, now))
      if (persisted.kind !== 'persisted') { temporaryTransition.current = () => dispatch({ type: 'GUILD_UPDATED', state: nextGuild }); uiDispatch({ type: 'ENTER_TEMPORARY_MODE' }); uiDispatch({ type: 'CLOSE_SHEET' }); dispatch({ type: 'FAIL', code: 'storage-write', message: content.content.ui.notices.temporary, recoverable: true }); return }
      void adventureLog.current?.undoFeedback(currentFeedbackQuest.questId, now).catch(() => setArchiveDegraded(true))
    }
    dispatch({ type: 'GUILD_UPDATED', state: nextGuild })
    uiDispatch({ type: 'CLOSE_SHEET' })
  }

  const enterTemporary = () => {
    const transition = temporaryTransition.current
    temporaryTransition.current = null
    transition?.()
  }

  const resetLocalState = () => {
    clearState(window.localStorage)
    void adventureLog.current?.clear().catch(() => setArchiveDegraded(true))
    dispatch({ type: 'RESET', state: createGuildState(defaultPreference) })
  }

  const finishGuide = () => {
    uiDispatch({ type: 'INTRO_SKIP' })
    dispatch({ type: 'GUILD_UPDATED', state: setGuideSeen(state.guild) })
    dispatch({ type: 'OPEN_PREFERENCES' })
  }
  const advanceGuide = () => uiState.introStep === 2 ? finishGuide() : uiDispatch({ type: 'INTRO_NEXT' })
  return (
    <>
      <GuildFrame
        ui={content.content.ui}
        page={state.page}
        level={model.profile?.level ?? 1}
        xp={state.guild.xp}
        hideNavigation={['preferenceSelect', 'questOffer', 'questAccepted', 'questComplete', 'questAbandoned', 'error'].includes(state.page)}
        onNavigate={(page) => dispatch({ type: 'NAVIGATE', page })}
        onHelp={() => uiDispatch({ type: 'OPEN_SHEET', sheet: 'help' })}
        helpButtonRef={helpButton}
      >
        {uiState.temporaryMode && <p className="temporary-banner" role="status"><img src={assets.status('temporary')} alt="" />{content.content.ui.notices.temporary}</p>}
        {uiState.matching.active
          ? <MatchingRitual ui={content.content.ui} conditions={matchingConditions} onSkip={finishPendingMatch} />
          : <>
            {state.page === 'guildHall' && <GuildHall ui={content.content.ui} guild={state.guild} activeQuest={activeQuest} onStart={() => dispatch({ type: 'OPEN_PREFERENCES' })} onContinue={() => dispatch({ type: 'RESUME_ACTIVE' })} />}
            {state.page !== 'guildHall' && <PageHeading model={model} />}
            {state.page === 'preferenceSelect' && <CheckIn content={content} preference={preference} onChange={setPreference} onSubmit={() => issueQuest(preference)} />}
            {state.page === 'questOffer' && offeredQuest && <QuestOffer quest={offeredQuest} categoryName={categoryName(offeredQuest.category, content)} explanation={model.offerExplanation ?? emptyExplanation} ui={content.content.ui} busy={questActionBusy} onAccept={acceptOfferedQuest} onSwap={() => issueQuest(state.guild.preference, true)} onEditPreferences={() => dispatch({ type: 'OPEN_PREFERENCES' })} onUnsuitable={() => uiDispatch({ type: 'OPEN_SHEET', sheet: 'unsuitable' })} />}
            {state.page === 'questAccepted' && activeQuest && state.guild.activeQuest && <ActiveQuestView quest={activeQuest} categoryName={categoryName(activeQuest.category, content)} classic={catalog.isClassic(activeQuest.questId, state.guild.activeQuest.questContentVersion)} ui={content.content.ui} onComplete={() => uiDispatch({ type: 'OPEN_SHEET', sheet: 'complete' })} onAbandon={() => uiDispatch({ type: 'OPEN_SHEET', sheet: 'abandon' })} onUnsuitable={() => uiDispatch({ type: 'OPEN_SHEET', sheet: 'unsuitable' })} />}
            {state.page === 'questComplete' && model.profile && settledQuest && <XpReceipt awardedXp={state.lastAwardedXp} completionText={settledQuest.completionText} profile={model.profile} newBadges={content.content.badges.filter(({ id }) => state.newlyUnlockedBadgeIds.includes(id))} ui={content.content.ui} temporary={uiState.temporaryMode} onLog={() => dispatch({ type: 'NAVIGATE', page: uiState.temporaryMode ? 'guildHall' : 'questHistory' })} onAgain={() => dispatch({ type: 'OPEN_PREFERENCES' })} />}
            {state.page === 'questAbandoned' && <section className="paper-panel return-result"><img src={assets.status('abandoned')} alt="" /><p>{settledQuest?.abandonText ?? content.content.ui.pages.questAbandoned.description}</p><small>{content.content.ui.notices.noPressure}</small><div className="quest-actions"><button className="button button--primary" type="button" onClick={() => dispatch({ type: 'OPEN_PREFERENCES' })}>{content.content.ui.actions.openCheckIn}</button><button className="button button--ghost" type="button" onClick={() => dispatch({ type: 'NAVIGATE', page: 'guildHall' })}>{content.content.ui.actions.backHall}</button></div></section>}
            {state.page === 'adventurerProfile' && model.profile && <AdventurerProfile profile={model.profile} ui={content.content.ui} />}
            {state.page === 'questHistory' && <AdventureLog history={state.guild.history} categories={content.content.categories} filter={uiState.logFilter} ui={content.content.ui} degraded={archiveDegraded} onFilter={(filter) => uiDispatch({ type: 'SET_LOG_FILTER', filter })} />}
            {state.page === 'badgeList' && <div className="collection-stack"><CategoryCodex categories={content.content.categories} goals={content.content.goals} counts={state.guild.categoryCompletionCounts} ui={content.content.ui} /><BadgeShelf badges={content.content.badges} unlockedIds={state.guild.unlockedBadgeIds} categories={content.content.categories} ui={content.content.ui} /></div>}
            {state.page === 'error' && <RecoveryPanel kind={state.error?.code === 'no-match' ? 'no-match' : state.error?.code === 'storage-recovery' ? 'storage' : state.error?.code === 'content' ? 'content' : 'temporary'} ui={content.content.ui} details={state.error?.reasons ?? []} onPrimary={state.error?.code === 'storage-recovery' ? resetLocalState : state.error?.code === 'storage-write' ? enterTemporary : state.error?.code === 'content' ? () => window.location.reload() : () => dispatch({ type: 'OPEN_PREFERENCES' })} />}
          </>}
      </GuildFrame>
      {uiState.introStep !== null && <MiraGuide copy={content.content.ui.intro} step={uiState.introStep} onNext={advanceGuide} onSkip={finishGuide} />}
      {uiState.sheet === 'complete' && activeQuest && <CompletionConfirm questTitle={activeQuest.title} ui={content.content.ui} onConfirm={confirmCompletion} onClose={() => uiDispatch({ type: 'CLOSE_SHEET' })} />}
      {uiState.sheet === 'abandon' && activeQuest && <AbandonSheet questTitle={activeQuest.title} ui={content.content.ui} onConfirm={confirmAbandon} onClose={() => uiDispatch({ type: 'CLOSE_SHEET' })} />}
      {uiState.sheet === 'unsuitable' && currentFeedbackQuest && <UnsuitableSheet questTitle={currentFeedbackQuest.title} ui={content.content.ui} isAvoided={state.guild.settings.softAvoidCategoryIds.includes(currentFeedbackQuest.category)} onConfirm={confirmUnsuitable} onUndo={undoUnsuitable} onClose={() => uiDispatch({ type: 'CLOSE_SHEET' })} />}
      {uiState.sheet === 'help' && <MiraHelpSheet ui={content.content.ui} onClose={() => { uiDispatch({ type: 'CLOSE_SHEET' }); window.setTimeout(() => helpButton.current?.focus(), 0) }} />}
    </>
  )
}

function PageHeading({ model }: { model: ReturnType<typeof createPageViewModel> }) {
  return <header className="page-heading"><p className="eyebrow">{model.eyebrow}</p><h1>{model.title}</h1><p>{model.description}</p></header>
}

function initializeState(content: EarthOnlineContent, catalog: QuestCatalog, bootstrapError?: AppProps['bootstrapError']): AppState {
  const validation = validateContent(content, 'production')
  const base = createGuildState(defaultPreference)
  if (bootstrapError) return { ...createInitialAppState(base), page: 'error', error: { code: 'content', message: content.content.ui.recovery.contentTitle, recoverable: true } }
  if (!validation.ok) return { ...createInitialAppState(base), page: 'error', error: { code: 'content', message: content.content.ui.recovery.contentTitle, recoverable: false } }
  const loaded = loadState(window.localStorage, catalog)
  if (loaded.status === 'ok') return { ...createInitialAppState(base), guild: { ...base, ...loaded.envelope.data, categoryCompletionCounts: deriveCategoryCounts(loaded.envelope.data) }, page: loaded.envelope.data.activeQuest ? 'questAccepted' : loaded.envelope.data.offeredQuestId ? 'questOffer' : 'guildHall' }
  if (loaded.status === 'corrupt' || loaded.status === 'future-version') return { ...createInitialAppState(base), page: 'error', error: { code: 'storage-recovery', message: content.content.ui.recovery.storageTitle, recoverable: true } }
  return createInitialAppState(base)
}

function deriveCategoryCounts(payload: ReturnType<typeof createStorageEnvelope>['data']): GuildDomainState['categoryCompletionCounts'] { const result: GuildDomainState['categoryCompletionCounts'] = {}; for (const entry of payload.history) if (entry.status === 'completed') result[entry.questCategory] = (result[entry.questCategory] ?? 0) + 1; return result }
const emptyExplanation: import('./ui/state').OfferExplanation = { score: 0, stage: 'exact', reasons: [], relaxed: [] }
function categoryName(categoryId: EarthOnlineContent['content']['categories'][number]['id'], content: EarthOnlineContent): string { return content.content.categories.find(({ id }) => id === categoryId)?.name ?? categoryId }
function preferenceSummary(value: QuestPreference, content: EarthOnlineContent): string[] {
  const copy = content.content.ui.checkIn
  const goal = content.content.goals.find(({ id }) => id === value.goalId)?.name
  return [copy.timeLabels[value.minutes], copy.energyLabels[value.energy - 1], copy.environmentLabels[value.environment], copy.socialLabels[value.social], goal, copy.dayPartLabels[value.timeOfDay]].filter((item): item is string => Boolean(item))
}
function localDateKey(date = new Date()): string { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}` }
function prefersReducedMotion(): boolean { return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches }

export default App
