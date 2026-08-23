import { useEffect, useMemo, useRef, useState } from 'react'
import { shopContent } from './content'
import type { DailyDecision, DailyResult, GameState, PageState, SavePayload } from './domain/types'
import { createNewGame, openDay, resolveDay } from './engine/simulator'
import { buildGameViewModel } from './state/view-model'
import { decodeSave } from './storage/save-codec'
import { IndexedDbSaveRepository } from './storage/indexed-db'
import { clearLauncher, loadLauncher, saveLauncher } from './storage/launcher'
import type { SaveRepository } from './storage/repository'
import './App.css'

const { content } = shopContent
const ui = content.ui

const newDecision = (state: GameState): DailyDecision => ({
  menu: content.drinks.filter((product) => state.unlockedProductIds.includes(product.productId)).slice(0, 3).map((product) => ({ productId: product.productId, prepare: 4, price: product.basePrice })),
  closeEarly: false,
  strategyId: 'player',
})

function App() {
  const [game, setGame] = useState<GameState>()
  const [displayPage, setDisplayPage] = useState<PageState>('landing')
  const [decision, setDecision] = useState<DailyDecision>()
  const [lastResult, setLastResult] = useState<DailyResult>()
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()
  const repository = useRef<SaveRepository>(undefined)
  const previousDay = useRef<GameState>(undefined)

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
        if (recovered.status === 'ok' || recovered.status === 'recovered-previous') {
          setGame(recovered.payload.current)
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

  const view = useMemo(() => game ? buildGameViewModel(game, content) : undefined, [game])

  async function persist(current: GameState, previous?: GameState) {
    if (!repository.current || typeof window === 'undefined') return
    const payload: SavePayload = { schemaVersion: 1, contentVersion: shopContent.contentVersion, id: current.saveId, updatedAt: new Date().toISOString(), current, previousDay: previous }
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
    setDisplayPage('morning')
    void persist(state).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
  }

  function handleOpen() {
    if (!game || !decision) return
    try {
      previousDay.current = game
      const opened = openDay(game, decision, content)
      setGame(opened.state)
      setDisplayPage('opening')
      void persist(opened.state, game).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : ui.errorTitle)
      setDisplayPage('error')
    }
  }

  function handleResolve(choiceId?: string) {
    if (!game) return
    try {
      const result = resolveDay(game, choiceId, content)
      setLastResult(result)
      setGame(result.nextState)
      setDisplayPage('settlement')
      void persist(result.nextState, previousDay.current).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : ui.errorTitle))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : ui.errorTitle)
      setDisplayPage('error')
    }
  }

  function afterSettlement() {
    if (!game) return
    setLastResult(undefined)
    setDecision(newDecision(game))
    setDisplayPage(game.page)
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

  if (loading) return <main className="app-shell"><p>{ui.loading}</p></main>
  if (displayPage === 'error' || error) return <main className="app-shell page-card" aria-labelledby="error-title"><p className="eyebrow">{ui.eyebrow}</p><h1 id="error-title">{ui.errorTitle}</h1><p role="alert">{error}</p><button type="button" onClick={() => { setError(undefined); setDisplayPage('landing') }}>{ui.retryLanding}</button><button className="quiet-button" type="button" onClick={() => void resetProjectData()}>{ui.resetData}</button></main>
  if (displayPage === 'landing') return <main className="app-shell landing" aria-labelledby="landing-title"><p className="eyebrow">{ui.eyebrow}</p><h1 id="landing-title">{ui.landingTitle}</h1><p className="lead">{ui.landingLead}</p>{notice && <p className="notice" role="status">{notice}</p>}<div className="action-stack">{game && <button type="button" onClick={() => setDisplayPage('continueGame')}>{ui.continueGame}</button>}<button type="button" onClick={() => setDisplayPage('newGame')}>{ui.newGame}</button></div><p className="supporting-copy">{ui.saveNotice}</p><button className="text-button" type="button" onClick={() => void resetProjectData()}>{ui.resetData}</button></main>
  if (displayPage === 'newGame') return <main className="app-shell page-card" aria-labelledby="new-game-title"><p className="eyebrow">{ui.eyebrow}</p><h1 id="new-game-title">{ui.newGame}</h1><p>{ui.newShopWarning}</p><button type="button" onClick={() => setDisplayPage('tutorial')}>{ui.beginIntroduction}</button></main>
  if (displayPage === 'tutorial') return <main className="app-shell page-card" aria-labelledby="tutorial-title"><p className="eyebrow">{ui.eyebrow}</p><h1 id="tutorial-title">{ui.tutorialTitle}</h1><p>{ui.tutorialBody}</p><button type="button" onClick={beginNewGame}>{ui.beginBusiness}</button></main>
  if (displayPage === 'continueGame' && game) return <main className="app-shell page-card" aria-labelledby="continue-title"><p className="eyebrow">{view?.dayLabel}</p><h1 id="continue-title">{ui.continueGame}</h1><p>{ui.resumePrompt}</p><button type="button" onClick={() => setDisplayPage(game.page)}>{ui.resumeNow}</button></main>
  if (!game || !view || !decision) return <main className="app-shell"><p>{ui.noSave}</p></main>

  const header = <header className="shop-header"><div><p className="eyebrow">{view.dayLabel}</p><h1>{view.title}</h1></div><dl className="stat-grid">{view.stats.map((stat) => <div key={stat.id}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></header>
  if (displayPage === 'morning') return <main className="app-shell">{header}<section className="page-card"><h2>{ui.morningTitle}</h2><p>{ui.saveNotice}</p><button type="button" onClick={() => setDisplayPage('preparation')}>{ui.goPreparation}</button></section></main>
  if (displayPage === 'preparation') return <main className="app-shell">{header}<form className="page-card" onSubmit={(event) => { event.preventDefault(); handleOpen() }}><h2>{ui.preparationTitle}</h2><p>{ui.preparationHelp}</p><div className="product-list">{view.products.map((product) => {
    const entry = decision.menu.find((item) => item.productId === product.productId)
    return <fieldset key={product.productId} className="product-row"><legend><label><input type="checkbox" checked={Boolean(entry)} onChange={(event) => setDecision((current) => current && ({ ...current, menu: event.target.checked ? [...current.menu, { productId: product.productId, prepare: 4, price: product.basePrice }] : current.menu.filter((item) => item.productId !== product.productId) }))} /> {product.name}</label></legend><p>{ui.unitCost}：{product.unitCost} · {ui.basePrice}：{product.basePrice}</p>{entry && <div className="input-pair"><label>{ui.preparedQuantity}<input type="number" min="0" max="12" value={entry.prepare} onChange={(event) => setDecision((current) => current && ({ ...current, menu: current.menu.map((item) => item.productId === product.productId ? { ...item, prepare: Number(event.target.value) } : item) }))} /></label><label>{ui.sellingPrice}<input type="number" min={Math.ceil(product.basePrice * .8)} max={Math.floor(product.basePrice * 1.4)} value={entry.price} onChange={(event) => setDecision((current) => current && ({ ...current, menu: current.menu.map((item) => item.productId === product.productId ? { ...item, price: Number(event.target.value) } : item) }))} /></label></div>}</fieldset>
  })}</div><label className="check-row"><input type="checkbox" checked={decision.closeEarly} onChange={(event) => setDecision({ ...decision, closeEarly: event.target.checked })} /> {ui.closeEarly}</label><button type="submit">{ui.openShop}</button></form></main>
  if (displayPage === 'opening' && game.pendingOpening) return <main className="app-shell">{header}<section className="page-card"><h2>{ui.openShop}</h2><dl className="summary-list"><div><dt>{ui.visitors}</dt><dd>{game.pendingOpening.visitors}</dd></div><div><dt>{ui.day}</dt><dd>{game.pendingOpening.dayContext.day}</dd></div></dl><button type="button" onClick={() => setDisplayPage(game.pendingOpening?.selectionKind === 'none' ? 'settlement' : 'event')}>{game.pendingOpening.selectionKind === 'none' ? ui.settleNoEvent : ui.viewEvent}</button></section></main>
  if (displayPage === 'event' && view.event) return <main className="app-shell">{header}<article className="page-card event-card" aria-labelledby="event-title"><p className="eyebrow">{ui.eventTitle}</p><h2 id="event-title">{view.event.title}</h2><p>{view.event.content}</p><p className="asset-slot">{ui.assetPlaceholder}：{view.event.assetId}</p><p>{ui.choiceLocked}</p><div className="choice-grid">{view.event.choices.map((choice) => <button type="button" key={choice.choiceId} onClick={() => handleResolve(choice.choiceId)}><span>{choice.text}</span><small>{choice.impactTags.join(' / ')}</small></button>)}</div></article></main>
  if (displayPage === 'settlement') return <main className="app-shell">{header}<section className="page-card" aria-labelledby="settlement-title"><h2 id="settlement-title">{ui.settlementTitle}</h2>{!lastResult && <><p>{ui.noEvent}</p><button type="button" onClick={() => handleResolve()}>{ui.settleNoEvent}</button></>}{lastResult && <><p>{ui.visitors}：{lastResult.visitors}</p>{game.negativeProfitStreak >= 3 && <p className="notice">{ui.lossWarning}</p>}<div className="table-wrap"><table><thead><tr><th>{ui.ledgerItem}</th><th>{ui.ledgerAmount}</th></tr></thead><tbody>{lastResult.ledger.map((line, index) => <tr key={`${line.labelId}-${index}`}><td>{line.labelId}</td><td className={line.amount < 0 ? 'negative' : 'positive'}>{line.amount}</td></tr>)}</tbody></table></div><h3>{ui.salesSummary}</h3><div className="table-wrap"><table><thead><tr><th>{ui.ledgerItem}</th><th>{ui.prepared}</th><th>{ui.demand}</th><th>{ui.sold}</th><th>{ui.unsold}</th></tr></thead><tbody>{lastResult.sales.map((sale) => <tr key={sale.productId}><td>{content.drinks.find((item) => item.productId === sale.productId)?.name}</td><td>{sale.prepared}</td><td>{sale.demand}</td><td>{sale.sold}</td><td>{sale.unsold}</td></tr>)}</tbody></table></div><button type="button" onClick={afterSettlement}>{game.page === 'bankruptcy' || game.page === 'finalEnding' ? ui.viewOutcome : ui.nextDay}</button></>}</section></main>
  if (displayPage === 'milestone') return <main className="app-shell">{header}<section className="page-card"><h2>{ui.milestoneTitle}</h2><p>{ui.completedDayPrefix}{game.day - 1}{ui.completedDaySuffix}</p><button type="button" onClick={() => { const next = { ...game, page: 'morning' as const }; setGame(next); setDisplayPage('morning'); setDecision(newDecision(next)) }}>{ui.nextDay}</button></section></main>
  if (displayPage === 'bankruptcy' || displayPage === 'finalEnding') {
    const ending = content.endings.find((item) => item.endingId === game.currentEndingId)
    return <main className="app-shell">{header}<article className="page-card ending-card"><p className="eyebrow">{displayPage === 'bankruptcy' ? ui.bankruptcyTitle : ui.endingTitle}</p><h2>{ending?.title}</h2><p>{ending?.content}</p><h3>{ui.endingEvaluation}</h3><p>{ending?.evaluation}</p><h3>{ui.endingShare}</h3><blockquote>{ending?.shareText}</blockquote><p className="asset-slot">{ui.assetPlaceholder}：{ending?.assetId}</p><button type="button" onClick={() => setDisplayPage('newGame')}>{ui.restart}</button></article></main>
  }
  return <main className="app-shell"><p>{ui.noSave}</p></main>
}

export default App
