import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { shopContent } from './content'
import type { DailyDecision, DailyResult, GameState, PageState } from './domain/types'
import { createNewGame, openDay, resolveDay } from './engine/simulator'
import { acceptCrisisContract, acknowledgeCrisisScene } from './engine/financial-health'
import { recommendDecision, reuseLastDecision } from './engine/planning'
import { businessCompletionAction, createUiFlow, nextDisplayAfterEvent, nextDisplayAfterOpening, reduceUiFlow } from './state/ui-flow'
import { pendingEventTiming, resolveResumeRoute } from './state/resume-route'
import { buildGameViewModel } from './state/view-model'
import { changeOperatingMode } from './state/decision-edit'
import { newGameLabel } from './state/new-game-copy'
import { decodeSave } from './storage/save-codec'
import { createSavePayload } from './storage/save-payload'
import { IndexedDbSaveRepository } from './storage/indexed-db'
import { clearLauncher, loadLauncher, saveLauncher } from './storage/launcher'
import type { SaveRepository } from './storage/repository'
import { BusinessTicker, GameHeader, GuideCard, LedgerPanel, OpeningSummary, OutcomePanel, PreparationPanel, ShopScene } from './ui/GameUi'
import { EventChoicePanel, EventResultPanel, EventSettlementSummary, EventSituation } from './ui/EventExperience'
import { ActionGroup } from './ui/ActionGroup'
import { ScreenFrame } from './ui/ScreenFrame'
import { AyuanStage } from './ui/AyuanStage'
import { MorningIntel } from './ui/MorningIntel'
import { FinancialCrisis } from './ui/FinancialCrisis'
import { calendarDayForOperatingDay, campaignChapter } from './engine/campaign'
import './App.css'

const { content } = shopContent
const ui = content.ui
type DisplayPage = PageState | 'openingReview' | 'business'

const newDecision = (state: GameState): DailyDecision => ({
  menu: content.drinks
    .filter((product) => state.unlockedProductIds.includes(product.productId))
    .slice(0, 3)
    .map((product) => ({ productId: product.productId, prepare: 4, price: product.basePrice })),
  operatingMode: 'full',
  strategyId: 'player',
})

function App() {
  const [game, setGame] = useState<GameState>()
  const [displayPage, setDisplayPage] = useState<DisplayPage>('landing')
  const [decision, setDecision] = useState<DailyDecision>()
  const [lastResult, setLastResult] = useState<DailyResult>()
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string>()
  const [riskConfirmed, setRiskConfirmed] = useState(false)
  const [error, setError] = useState<string>()
  const [uiFlow, dispatchUi] = useReducer(reduceUiFlow, undefined, createUiFlow)
  const repository = useRef<SaveRepository>(undefined)
  const previousDay = useRef<GameState>(undefined)
  const resolving = useRef(false)

  useEffect(() => {
    document.title = shopContent.meta.title
    let cancelled = false
    async function restore() {
      if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        if (!cancelled) { setError(ui.errorTitle); setLoading(false) }
        return
      }
      repository.current = new IndexedDbSaveRepository()
      const launcher = loadLauncher(window.localStorage)
      if (!launcher.activeSaveId) { if (!cancelled) setLoading(false); return }
      try {
        const stored = await repository.current.load(launcher.activeSaveId)
        if (!stored || cancelled) { setLoading(false); return }
        const recovered = decodeSave(JSON.stringify(stored), content)
        if (recovered.status === 'ok' || recovered.status === 'migrated' || recovered.status === 'recovered-previous') {
          setGame(recovered.payload.current)
          previousDay.current = recovered.payload.previousDay
          setDecision(newDecision(recovered.payload.current))
          if (recovered.status === 'recovered-previous') setNotice(ui.recoveredPrevious)
        } else setError(recovered.reason)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : ui.errorTitle)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void restore()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.getElementById('screen-root')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [displayPage, error, loading])

  const view = useMemo(
    () => game ? buildGameViewModel(game, content, { decision, result: lastResult }) : undefined,
    [decision, game, lastResult],
  )
  const reusableDecision = useMemo(() => game ? reuseLastDecision(game, content) : undefined, [game])
  const newShopLabel = newGameLabel(Boolean(game), {
    firstOpening: ui.firstOpening,
    startAnotherShop: ui.startAnotherShop,
  })

  function reviseDecision(transform: (current: DailyDecision) => DailyDecision) {
    setRiskConfirmed(false)
    setDecision((current) => current ? transform(current) : current)
  }

  async function persist(current: GameState, previous?: GameState) {
    if (!repository.current || typeof window === 'undefined') return
    const payload = createSavePayload(current, previous)
    await repository.current.save(payload)
    saveLauncher(window.localStorage, { activeSaveId: current.saveId, settings: loadLauncher(window.localStorage).settings })
  }

  function beginNewGame() {
    const saveId = game ? `${game.saveId}-next` : 'save-local-1'
    const state = createNewGame(`seed-${saveId}`, saveId, content)
    setGame(state)
    setDecision(newDecision(state))
    setLastResult(undefined)
    setNotice(undefined)
    setRiskConfirmed(false)
    dispatchUi({ type: 'tutorial-skip' })
    dispatchUi({ type: 'reset-day' })
    setDisplayPage('morning')
    void persist(state).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
  }

  function showNewGame() {
    dispatchUi({ type: 'tutorial-restart' })
    setDisplayPage('newGame')
  }

  function handleOpen() {
    if (!game || !decision) return
    try {
      previousDay.current = game
      const opened = openDay(game, decision, content)
      const timing = pendingEventTiming(opened.state, content)
      const route = nextDisplayAfterOpening(decision.operatingMode, timing)
      if (route === 'settlement') {
        const result = resolveDay(opened.state, undefined, content)
        setLastResult(result)
        setGame(result.nextState)
        dispatchUi({ type: 'reset-day' })
        setDisplayPage('settlement')
        void persist(result.nextState, game).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
        return
      }
      setGame(opened.state)
      dispatchUi({ type: 'reset-day' })
      if (timing) dispatchUi({ type: 'event-open', timing })
      setDisplayPage(route)
      void persist(opened.state, game).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : ui.errorTitle)
      setDisplayPage('error')
    }
  }

  function handleResolve(choiceId?: string) {
    if (!game || resolving.current) return
    resolving.current = true
    dispatchUi({ type: 'submit-start' })
    try {
      const resolvesEvent = game.pendingOpening?.selectionKind !== 'none'
      const result = resolveDay(game, choiceId, content)
      setLastResult(result)
      setGame(result.nextState)
      if (resolvesEvent) {
        dispatchUi({ type: 'event-resolved' })
        setDisplayPage('event')
      } else setDisplayPage('settlement')
      void persist(result.nextState, previousDay.current).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : ui.errorTitle)
      setDisplayPage('error')
    } finally {
      resolving.current = false
      dispatchUi({ type: 'submit-end' })
    }
  }

  function afterSettlement() {
    if (!game) return
    setLastResult(undefined)
    setDecision(newDecision(game))
    setRiskConfirmed(false)
    dispatchUi({ type: 'reset-day' })
    setDisplayPage(game.page)
  }

  function acceptContract(contractId: string) {
    if (!game || resolving.current) return
    resolving.current = true
    dispatchUi({ type: 'crisis-submit-start' })
    try {
      const accepted = acceptCrisisContract(game, contractId, content).state
      setGame(accepted)
      setDisplayPage('financialCrisis')
      void persist(accepted, game).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : ui.errorTitle)
      setDisplayPage('error')
    } finally {
      resolving.current = false
      dispatchUi({ type: 'crisis-submit-end' })
    }
  }

  function acknowledgeContractScene() {
    if (!game?.pendingContractScene) return
    const next = acknowledgeCrisisScene(game)
    setGame(next)
    setDecision(newDecision(next))
    setLastResult(undefined)
    setRiskConfirmed(false)
    setDisplayPage(next.page)
    void persist(next, game).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
  }

  function resumeGame() {
    if (!game) return
    const route = resolveResumeRoute(game, content)
    if (route.eventTiming) dispatchUi({ type: 'event-open', timing: route.eventTiming })
    setDisplayPage(route.displayPage)
  }

  function showPendingEvent() {
    if (!game) return
    const timing = pendingEventTiming(game, content)
    if (!timing) {
      setDisplayPage('settlement')
      return
    }
    dispatchUi({ type: 'event-open', timing })
    setDisplayPage('event')
  }

  async function resetProjectData() {
    if (typeof window === 'undefined' || !window.confirm(ui.resetConfirm)) return
    await repository.current?.clear()
    clearLauncher(window.localStorage)
    setGame(undefined)
    setDecision(undefined)
    setLastResult(undefined)
    setNotice(undefined)
    setError(undefined)
    setDisplayPage('landing')
  }

  if (loading) return <ScreenFrame key="loading" className="loading-screen" surface="dark"><p className="section-kicker">{ui.eyebrow}</p><p>{ui.loading}</p></ScreenFrame>

  if (displayPage === 'error' || error) return <ScreenFrame key="error" className="recovery-screen" labelledBy="error-title" surface="dark">
    <p className="section-kicker">{ui.recoveryTitle}</p>
    <h1 id="error-title">{ui.errorTitle}</h1>
    <GuideCard name={ui.guideName} role={ui.guideRole} compact><p role="alert">{error}</p><p>{ui.recoveryLoss}</p></GuideCard>
    <ActionGroup layout="split" surface="dark"><button type="button" className="secondary-action" onClick={() => { setError(undefined); setDisplayPage('landing') }}>{ui.retryLanding}</button><button type="button" className="primary-action" onClick={() => void resetProjectData()}>{ui.resetData}</button></ActionGroup>
  </ScreenFrame>

  if (displayPage === 'landing') return <ScreenFrame key={displayPage} className="cover-shell" labelledBy="landing-title" surface="dark">
    <div className="cover-copy"><p className="section-kicker">{ui.coverEnglishLabel}</p><h1 id="landing-title">{ui.landingTitle}</h1><p className="cover-promise">{ui.coverPromise}</p><p>{ui.coverSubtitle}</p></div>
    <ShopScene phase="cover" alt={ui.shopAltCover} caption={ui.morningSceneCaption}><span className="shop-banner">{ui.viewShop}</span></ShopScene>
    {notice && <p className="notice" role="status">{notice}</p>}
    <ActionGroup layout="stack" surface="dark">{game && <button className="primary-action" type="button" onClick={resumeGame}>{ui.continueGame}</button>}<button className={game ? 'secondary-action' : 'primary-action'} type="button" onClick={showNewGame}>{newShopLabel}</button></ActionGroup>
    <p className="supporting-copy">{ui.localSaveLine}</p>
    <button className="text-button" type="button" onClick={() => void resetProjectData()}>{ui.resetData}</button>
  </ScreenFrame>

  if (displayPage === 'newGame') return <ScreenFrame key={displayPage} className="intro-shell" labelledBy="new-game-title" surface="dark">
    <p className="section-kicker">{ui.eyebrow}</p><h1 id="new-game-title">{newShopLabel}</h1><p>{ui.newShopWarning}</p>
    <button className="primary-action" type="button" onClick={() => setDisplayPage('tutorial')}>{ui.beginIntroduction}</button>
  </ScreenFrame>

  if (displayPage === 'tutorial') {
    const guideSteps = [ui.guideStepOne, ui.guideStepTwo, ui.guideStepThree]
    return <ScreenFrame key={displayPage} className="guide-screen" labelledBy="tutorial-title" surface="dark">
      <p className="section-kicker">{ui.tutorialTitle}</p><h1 id="tutorial-title">{ui.coverPromise}</h1>
      <AyuanStage variant="tutorial" tone="neutral" name={ui.guideName} role={ui.guideRole} text={guideSteps[uiFlow.tutorialStep]}><div className="guide-dots" aria-hidden="true">{guideSteps.map((_, index) => <i key={index} className={index === uiFlow.tutorialStep ? 'active' : ''} />)}</div></AyuanStage>
      <ActionGroup layout="split" surface="dark"><button type="button" className="secondary-action" onClick={beginNewGame}>{ui.guideSkip}</button><button type="button" className="primary-action" onClick={() => uiFlow.tutorialStep < 2 ? dispatchUi({ type: 'tutorial-next' }) : beginNewGame()}>{uiFlow.tutorialStep < 2 ? ui.guideNext : ui.beginBusiness}</button></ActionGroup>
    </ScreenFrame>
  }

  if (!game || !view || !decision) return <ScreenFrame key="no-save" surface="dark"><p>{ui.noSave}</p></ScreenFrame>

  if (displayPage === 'morning') return <ScreenFrame key={displayPage} className="game-screen morning-screen" labelledBy="morning-title" surface="dark">
    <GameHeader view={view} timeLabel={ui.timeMorning} />
    <ShopScene phase="morning" alt={ui.shopAltMorning} caption={ui.morningSceneCaption} weatherId={view.weather?.id} />
    {view.morningIntel && <MorningIntel intel={view.morningIntel} name={ui.guideName} role={ui.guideRole} hint={ui.morningHint} copy={ui} onContinue={() => setDisplayPage('preparation')} />}
  </ScreenFrame>

  if (displayPage === 'preparation') return <ScreenFrame key={displayPage} className="game-screen" labelledBy="preparation-title" surface="dark">
    <GameHeader view={view} timeLabel={ui.timeMorning} />
    <div className="screen-heading"><p className="section-kicker">{ui.preparationBudget}</p><h1 id="preparation-title">{ui.preparationTitle}</h1></div>
    <PreparationPanel
      view={view}
      decision={decision}
      copy={ui}
      onToggle={(productId, selected) => reviseDecision((current) => ({ ...current, menu: selected ? [...current.menu, { productId, prepare: 4, price: content.drinks.find((item) => item.productId === productId)?.basePrice ?? 1 }] : current.menu.filter((item) => item.productId !== productId) }))}
      onPrepare={(productId, quantity) => reviseDecision((current) => ({ ...current, menu: current.menu.map((item) => item.productId === productId ? { ...item, prepare: quantity } : item) }))}
      onPrice={(productId, price) => reviseDecision((current) => ({ ...current, menu: current.menu.map((item) => item.productId === productId ? { ...item, price } : item) }))}
      onOperatingMode={(operatingMode) => reviseDecision((current) => changeOperatingMode(current, operatingMode, newDecision(game).menu))}
      onReuse={reusableDecision ? () => { setDecision(reusableDecision); setRiskConfirmed(false) } : undefined}
      onRecommend={() => {
        if (game.dayForecast) { setDecision(recommendDecision(game, game.dayForecast, content)); setRiskConfirmed(false) }
      }}
      onSubmit={() => setDisplayPage('openingReview')}
    />
  </ScreenFrame>

  if (displayPage === 'openingReview') return <ScreenFrame key={displayPage} className="game-screen" surface="dark">
    <GameHeader view={view} timeLabel={ui.timeMorning} />
    <OpeningSummary view={view} decision={decision} copy={ui} riskConfirmed={riskConfirmed} onRiskConfirmed={setRiskConfirmed} onBack={() => setDisplayPage('preparation')} onOpen={handleOpen} />
    <p className="notice">{ui.openingLocked}</p>
  </ScreenFrame>

  if (displayPage === 'business' && (game.pendingOpening || lastResult)) {
    const customers: Array<'market-worker' | 'merchant' | 'scholar'> = ['market-worker', 'merchant', 'scholar']
    const eventTiming = pendingEventTiming(game, content)
    const visitors = game.pendingOpening?.visitors ?? lastResult?.visitors ?? 0
    const completeBusiness = () => {
      const completion = businessCompletionAction(Boolean(lastResult), game.pendingOpening?.selectionKind ?? 'none')
      if (completion === 'event') showPendingEvent()
      else if (completion === 'resolve') handleResolve()
      else setDisplayPage('settlement')
    }
    return <ScreenFrame key={displayPage} className="business-screen" surface="dark">
      <GameHeader view={view} timeLabel={[ui.timeMorning, ui.timeNearNoon, ui.timeAfternoon, ui.timeDusk][uiFlow.businessStage]} />
      <ShopScene phase="business" alt={ui.shopAltBusiness} caption={ui.businessSceneCaption} customer={customers[Math.min(2, uiFlow.businessStage)]} weatherId={view.weather?.id} />
      <BusinessTicker
        view={view}
        stage={uiFlow.businessStage}
        visitors={visitors}
        copy={ui}
        concealExactSales={!lastResult && eventTiming === 'business'}
        onNext={() => {
          if (!lastResult && eventTiming === 'business' && uiFlow.businessStage >= 1) showPendingEvent()
          else dispatchUi({ type: 'business-next' })
        }}
        onSkip={completeBusiness}
        onContinue={completeBusiness}
      />
    </ScreenFrame>
  }

  if (displayPage === 'event') {
    const eventPanel = uiFlow.eventStage === 'result' && view.eventResolution
      ? <EventResultPanel
          resolution={view.eventResolution}
          acknowledgeLabel={ui.acknowledgeEventResult}
          onAcknowledge={() => {
            dispatchUi({ type: 'event-acknowledge' })
            setDisplayPage(lastResult?.operatingMode === 'rest' ? 'settlement' : nextDisplayAfterEvent(uiFlow.eventTiming ?? 'closing'))
          }}
        />
      : view.event && uiFlow.eventStage === 'situation'
        ? <EventSituation
            event={view.event}
            eyebrow={view.event.isChain ? ui.chainClue : ui.eventScene}
            continueLabel={ui.considerEventChoices}
            onContinue={() => dispatchUi({ type: 'event-show-choices' })}
          />
        : view.event
          ? <EventChoicePanel event={view.event} selectedChoiceId={uiFlow.selectedChoiceId} isSubmitting={uiFlow.isSubmitting} selectedLabel={ui.selectedChoice} confirmLabel={ui.confirmChoice} onSelect={(choiceId) => dispatchUi({ type: 'select-choice', choiceId })} onConfirm={() => handleResolve(uiFlow.selectedChoiceId)} />
          : undefined
    if (eventPanel) return <ScreenFrame key={`${displayPage}-${uiFlow.eventStage}`} className="event-screen" surface="dark">
      <GameHeader view={view} timeLabel={view.event?.scene.timingLabel ?? ui.timeDusk} />
      <ShopScene phase="event" alt={ui.shopAltEvent} caption={ui.eventSceneCaption} weatherId={view.weather?.id} />
      {eventPanel}
    </ScreenFrame>
  }

  if (displayPage === 'settlement') return <ScreenFrame key={displayPage} className="settlement-screen" labelledBy={lastResult ? 'settlement-title' : undefined} surface="dark">
    <GameHeader view={view} timeLabel={ui.timeNight} />
    {!lastResult && <section className="paper-panel"><p>{ui.noEvent}</p><button className="primary-action" type="button" onClick={() => handleResolve()}>{ui.settleNoEvent}</button></section>}
    {lastResult && <>
      <div className="screen-heading"><p className="section-kicker">{ui.settlementTitle}</p><h1 id="settlement-title">{lastResult.moneyDelta >= 0 ? ui.settlementPositive : ui.settlementNegative}</h1><dl className="demand-funnel-summary"><div><dt>{ui.footTrafficLabel}</dt><dd>{view.demandSummary?.footTraffic ?? lastResult.visitors}</dd></div><div><dt>{ui.buyersLabel}</dt><dd>{view.demandSummary?.buyers ?? 0}</dd></div><div><dt>{ui.unservedLabel}</dt><dd>{view.demandSummary?.unserved ?? 0}</dd></div></dl></div>
      {game.negativeProfitStreak >= 3 && <p className="notice">{ui.lossWarning}</p>}
      {view.chainInterruptions.map((interruption) => <aside className="notice chain-interruption" role="status" key={interruption.chainId}>
        <strong>{interruption.statusLabel} · {interruption.title}</strong>
        <p>{interruption.text}</p>
      </aside>)}
      {view.eventResolution && <EventSettlementSummary resolution={view.eventResolution} title={ui.eventSettlementTitle} chainLabel={ui.chainProgressLabel} />}
      <LedgerPanel view={view} netChange={lastResult.moneyDelta} expanded={uiFlow.ledgerExpanded} copy={ui} onToggle={() => dispatchUi({ type: 'toggle-ledger' })} />
      {view.settlementInsight && <AyuanStage
        variant="settlement"
        tone={['profitable', 'rested'].includes(view.settlementInsight.reason) ? 'positive' : 'warning'}
        name={view.settlementInsight.name}
        role={view.settlementInsight.role}
        text={view.settlementInsight.text}
      />}
      <details className="settlement-details paper-panel"><summary>{ui.settlementDetails}</summary>
        {view.demandBreakdown && <section className="demand-loss-panel" aria-labelledby="loss-title"><h2 id="loss-title">{ui.settlementCauseLabel}</h2><dl className="loss-grid"><div><dt>{ui.buyersLabel}</dt><dd>{view.demandBreakdown.potentialBuyers}</dd></div><div><dt>{ui.servedCustomersLabel}</dt><dd>{view.demandBreakdown.servedCustomers}</dd></div>{view.demandBreakdown.losses.map((loss) => <div key={loss.id}><dt>{loss.label}</dt><dd>{loss.count}</dd></div>)}</dl></section>}
        {lastResult.sales.length > 0 && <section className="sales-grid" aria-labelledby="sales-title"><h2 id="sales-title">{ui.salesSummary}</h2>{lastResult.sales.map((sale) => <article key={sale.productId}><strong>{content.drinks.find((item) => item.productId === sale.productId)?.name}</strong><dl><div><dt>{ui.prepared}</dt><dd>{sale.prepared}</dd></div><div><dt>{ui.demand}</dt><dd>{sale.demand}</dd></div><div><dt>{ui.sold}</dt><dd>{sale.sold}</dd></div><div><dt>{ui.stockoutLabel}</dt><dd>{sale.stockoutLost ?? Math.max(0, sale.demand - sale.sold)}</dd></div><div><dt>{ui.unsold}</dt><dd>{sale.unsold}</dd></div></dl></article>)}</section>}
      </details>
      <button className="primary-action" type="button" onClick={afterSettlement}>{game.page === 'bankruptcy' || game.page === 'finalEnding' ? ui.viewOutcome : ui.nextDay}</button>
    </>}
  </ScreenFrame>

  if (displayPage === 'financialCrisis' && view.financialCrisis) return <ScreenFrame key={displayPage} className="crisis-screen" labelledBy={view.financialCrisis.pendingScene ? 'crisis-scene-title' : 'crisis-title'} surface="dark">
    <GameHeader view={view} timeLabel={ui.timeMorning} />
    <FinancialCrisis crisis={view.financialCrisis} copy={ui} isSubmitting={uiFlow.isSubmitting} onAccept={acceptContract} onAcknowledge={acknowledgeContractScene} />
  </ScreenFrame>

  if (displayPage === 'milestone') {
    const completedOperatingDay = Math.max(1, game.operatingDay - 1)
    const completedCalendarDay = calendarDayForOperatingDay(completedOperatingDay, content.balance.campaign)
    const completedChapter = campaignChapter(completedOperatingDay, content.balance.campaign)
    return <ScreenFrame key={displayPage} className="milestone-screen" labelledBy="milestone-title" surface="dark">
      <GameHeader view={view} />
      <section className="milestone-card"><p className="section-kicker">{ui.milestoneTitle} · {completedChapter?.title}</p><div className="milestone-day">{completedOperatingDay}<small> / {content.balance.campaign.operatingDays.length}</small></div><h1 id="milestone-title">{ui.completedOperatingDayPrefix}{completedOperatingDay}{ui.completedOperatingDaySuffix}</h1><p>{ui.milestoneCalendarPrefix}{completedCalendarDay}{ui.milestoneCalendarSuffix}</p><p>{ui.milestoneChapterLead}</p><button className="primary-action" type="button" onClick={() => { const next = { ...game, page: 'morning' as const }; setGame(next); setDecision(newDecision(next)); setDisplayPage('morning') }}>{ui.nextDay}</button></section>
    </ScreenFrame>
  }

  if (displayPage === 'bankruptcy' || displayPage === 'finalEnding') return <ScreenFrame key={displayPage} className="outcome-screen" surface="dark">
    <GameHeader view={view} />
    <ShopScene phase="ending" alt={ui.shopAltEnding} caption={ui.endingSceneCaption} customer="merchant" />
    <OutcomePanel view={view} label={displayPage === 'bankruptcy' ? ui.bankruptcyTitle : ui.endingTitle} copy={ui} onRestart={showNewGame} />
  </ScreenFrame>

  return <ScreenFrame key="fallback" surface="dark"><p>{ui.noSave}</p></ScreenFrame>
}

export default App
