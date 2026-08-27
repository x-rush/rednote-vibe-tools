import type { FormEvent, ReactNode } from 'react'
import type { DailyDecision, OperatingMode } from '../domain/types'
import type { BusinessBeatView, GameViewModel } from '../state/view-model'
import { ActionGroup } from './ActionGroup'
import { AyuanStage } from './AyuanStage'
import { EndingPosterPanel } from './EndingPosterPanel'

type Copy = Record<string, string>

export function GameHeader({ view, timeLabel }: { view: GameViewModel; timeLabel?: string }) {
  return <header className="game-header">
    <div className="day-line">
      <span className="campaign-clock"><strong>{view.dayLabel}{timeLabel ? ` · ${timeLabel}` : ''}</strong><small>{view.calendarLabel} · {view.chapterLabel}</small></span>
      <span>{view.weather?.name ?? view.season?.name ?? ''}</span>
    </div>
    <dl className="stat-grid">
      {view.stats.map((stat) => <div key={stat.id} className={`stat stat-${stat.id}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
    </dl>
  </header>
}

export function ShopScene({ phase, alt, caption, customer, weatherId, children }: {
  phase: 'cover' | 'morning' | 'business' | 'event' | 'ending'
  alt: string
  caption: string
  customer?: 'market-worker' | 'merchant' | 'scholar'
  weatherId?: string
  children?: ReactNode
}) {
  return <figure className={`shop-scene phase-${phase}${weatherId ? ` weather-${weatherId}` : ''}`}>
    <img className="scene-image" src="./assets/scenes/shop-base-day.webp" alt={alt} />
    <span className="time-layer" aria-hidden="true" />
    <span className="weather-layer" aria-hidden="true" />
    {customer && <img className={`customer-image customer-${customer}`} src={`./assets/customers/${customer}.webp`} alt="" />}
    <figcaption>{caption}</figcaption>
    <span className="scene-fallback">{caption}</span>
    {children}
  </figure>
}

export function GuideCard({ name, role, children, compact = false }: { name: string; role: string; children: ReactNode; compact?: boolean }) {
  return <aside className={`guide-card${compact ? ' guide-compact' : ''}`}>
    <img src="./assets/guide/ayuan-master.webp" alt={name} />
    <div><strong>{name}</strong><small>{role}</small>{children}</div>
  </aside>
}

export function PreparationPanel({ view, decision, copy, onToggle, onPrepare, onPrice, onOperatingMode, onReuse, onRecommend, onSubmit }: {
  view: GameViewModel
  decision: DailyDecision
  copy: Copy
  onToggle: (productId: string, selected: boolean) => void
  onPrepare: (productId: string, quantity: number) => void
  onPrice: (productId: string, price: number) => void
  onOperatingMode: (mode: OperatingMode) => void
  onReuse?: () => void
  onRecommend?: () => void
  onSubmit: () => void
}) {
  const operatingMode = decision.operatingMode
  const isRest = operatingMode === 'rest'
  const insufficientMoney = !isRest && (view.budget?.remainingMoney ?? 0) < 0
  const energy = view.stats.find((stat) => stat.id === 'energy')?.value ?? 0
  const mustRest = energy === 0 && !isRest
  const canSubmit = !insufficientMoney && !mustRest
  const submit = (event: FormEvent) => { event.preventDefault(); if (canSubmit) onSubmit() }
  return <form className="paper-panel preparation-panel" aria-describedby="selection-rule" onSubmit={submit}>
    <fieldset className="operating-mode-selector">
      <legend>{copy.operatingModeLegend}</legend>
      <div className="operating-mode-grid">
        {view.operatingModes.map((mode) => <label className={`operating-mode-card${mode.id === operatingMode ? ' operating-mode-selected' : ''}`} key={mode.id}>
          <input type="radio" name="operating-mode" value={mode.id} checked={mode.id === operatingMode} disabled={mode.disabled} onChange={() => onOperatingMode(mode.id)} />
          <span><strong>{mode.label}</strong><small>{mode.consequence}</small></span>
        </label>)}
      </div>
    </fieldset>
    {view.ayuanPreparation && <AyuanStage
      variant={isRest ? 'rest' : 'preparation'}
      tone={isRest ? 'positive' : 'neutral'}
      name={view.ayuanPreparation.name}
      role={view.ayuanPreparation.role}
      text={view.ayuanPreparation.text}
    />}
    {view.budget && <dl className="budget-strip">
      <div><dt>{copy.budgetStockLabel}</dt><dd>{view.budget.stockCost}</dd></div>
      <div><dt>{copy.budgetRentLabel}</dt><dd>{view.budget.rentCost}</dd></div>
      <div><dt>{copy.budgetOperatingLabel}</dt><dd>{view.budget.operatingCost}</dd></div>
      <div><dt>{copy.cashAfterOpeningLabel}</dt><dd>{view.budget.cashAfterOpening}</dd></div>
      <div className="budget-projection"><dt>{copy.projectedRangeLabel}</dt><dd>{view.budget.projectedMinimum}–{view.budget.projectedMaximum}</dd></div>
    </dl>}
    {!isRest && <><div className="planning-tools">
      <button type="button" className="secondary-action" disabled={!onReuse} onClick={onReuse}>{copy.reuseYesterdayPlan}</button>
      <button type="button" className="secondary-action" onClick={onRecommend}>{copy.useAyuanPlan}</button>
    </div><p id="selection-rule" className="selection-rule">{copy.preparationHelp}</p>
    <div className="product-list">
      {view.products.map((product) => {
        const entry = decision.menu.find((item) => item.productId === product.productId)
        const forecast = view.productForecasts?.find((item) => item.productId === product.productId)
        const selectionLocked = entry ? decision.menu.length <= 3 : decision.menu.length >= 5
        return <fieldset className={`product-row${entry ? ' product-selected' : ''}`} key={product.productId}>
          <legend>
            <span className="product-heading">
              <label><input type="checkbox" checked={Boolean(entry)} disabled={selectionLocked} onChange={(event) => onToggle(product.productId, event.target.checked)} /> <span>{product.name}</span></label>
              {entry && <span className="product-status">{copy.selectedProductsLabel}</span>}
            </span>
          </legend>
          <img src={product.assetPath} alt={`${product.name}${copy.drinkIllustration}`} loading="lazy" />
          <div className="product-copy"><span>{copy.unitCost} {product.unitCost} · {copy.basePrice} {product.basePrice}</span><small>{copy.inventoryLabel} {product.inventory} · {copy.complexityLabel} {product.complexity}</small>
            {forecast && <div className={`forecast-chip tendency-${forecast.tendency}`}><strong>{copy.demandBandLabel} {forecast.minimum}–{forecast.maximum} {copy.tickerUnit}</strong><span>{forecast.tendencyLabel}</span><small>{forecast.shelfLabel}</small></div>}
          </div>
          {entry && <div className="product-controls">
            <div className="control-field quantity-field">
              <span className="control-label">{copy.preparedQuantity}</span>
              <div className="stepper" aria-label={`${product.name}${copy.preparedQuantity}`}>
                <button type="button" aria-label={`${copy.decreaseLabel}${product.name}${copy.preparedQuantity}`} disabled={entry.prepare <= 0} onClick={() => onPrepare(product.productId, entry.prepare - 1)}>−</button>
                <output>{entry.prepare}</output>
                <button type="button" aria-label={`${copy.increaseLabel}${product.name}${copy.preparedQuantity}`} disabled={entry.prepare >= 12} onClick={() => onPrepare(product.productId, entry.prepare + 1)}>＋</button>
              </div>
            </div>
            <label className="control-field price-field"><span className="control-label">{copy.sellingPrice}</span><input type="number" min={Math.ceil(product.basePrice * .8)} max={Math.floor(product.basePrice * 1.4)} value={entry.price} onChange={(event) => onPrice(product.productId, Number(event.target.value))} /></label>
          </div>}
        </fieldset>
      })}
    </div></>}
    <footer className="preparation-actions">
      {insufficientMoney && <p className="budget-warning" role="alert">{copy.budgetInsufficient}</p>}
      {mustRest && <p className="budget-warning" role="alert">{copy.energyMustRest}</p>}
      <button className="primary-action" type="submit" disabled={!canSubmit}>{isRest ? copy.restDayConfirm : copy.openingSummary}</button>
    </footer>
  </form>
}

export function OpeningSummary({ view, decision, copy, riskConfirmed = false, onRiskConfirmed, onBack, onOpen }: {
  view: GameViewModel
  decision: DailyDecision
  copy: Copy
  riskConfirmed?: boolean
  onRiskConfirmed?: (confirmed: boolean) => void
  onBack: () => void
  onOpen: () => void
}) {
  const operatingMode = decision.operatingMode
  const isRest = operatingMode === 'rest'
  const risk = isRest ? 'safe' : view.budget?.risk ?? 'safe'
  const canOpen = risk !== 'certain-debt' && (risk !== 'possible-debt' || riskConfirmed)
  return <section className="paper-panel opening-summary">
    <p className="section-kicker">{copy.openingSummary}</p>
    <h2>{copy.openShop}</h2>
    <dl className="summary-list">
      {decision.menu.map((entry) => <div key={entry.productId}><dt>{view.products.find((item) => item.productId === entry.productId)?.name ?? entry.productId}</dt><dd>{entry.prepare} {copy.tickerUnit} · {entry.price} {copy.moneyUnit}</dd></div>)}
      <div><dt>{copy.stockCostLabel}</dt><dd>{view.budget?.stockCost ?? 0} {copy.moneyUnit}</dd></div>
      <div><dt>{copy.budgetRentLabel}</dt><dd>{view.budget?.rentCost ?? 0} {copy.moneyUnit}</dd></div>
      {!isRest && <><div><dt>{copy.budgetOperatingLabel}</dt><dd>{view.budget?.operatingCost ?? 0} {copy.moneyUnit}</dd></div><div><dt>{copy.projectedRangeLabel}</dt><dd>{view.budget?.projectedMinimum ?? 0}–{view.budget?.projectedMaximum ?? 0} {copy.moneyUnit}</dd></div></>}
      <div><dt>{copy.operatingModeLegend}</dt><dd>{view.operatingModes.find((mode) => mode.id === operatingMode)?.label ?? operatingMode}</dd></div>
    </dl>
    {!isRest && view.budget && <div className={`opening-risk risk-${risk}`}><strong>{view.budget.riskLabel}</strong>{risk === 'possible-debt' && <label className="check-row"><input type="checkbox" checked={riskConfirmed} onChange={(event) => onRiskConfirmed?.(event.target.checked)} />{copy.riskConfirmLabel}</label>}</div>}
    <ActionGroup layout="split" surface="paper"><button type="button" className="secondary-action" onClick={onBack}>{copy.backToPreparation}</button><button type="button" className="primary-action" disabled={!canOpen} onClick={onOpen}>{isRest ? copy.restDayConfirm : copy.openShop}</button></ActionGroup>
  </section>
}

export function BusinessTicker({ view, stage, visitors, copy, onNext, onSkip, onContinue, concealExactSales = false }: {
  view: GameViewModel
  stage: number
  visitors: number
  copy: Copy
  onNext: () => void
  onSkip: () => void
  onContinue: () => void
  concealExactSales?: boolean
}) {
  const beats: BusinessBeatView[] = view.businessBeats ?? view.ticker.slice(0, 4).map((item, index) => ({ stage: index as 0 | 1 | 2 | 3, kind: 'legacy', count: 0, text: item.text, unit: copy.tickerUnit }))
  const visible = beats.filter((beat) => beat.stage <= stage)
  return <section className="business-ticker scene-followup-panel" aria-live="polite">
    <div><p className="section-kicker">{copy.businessTitle}</p><strong>{concealExactSales ? copy.marketFlowPending : `${visitors} ${copy.visitorsPassed}`}</strong></div>
    {concealExactSales ? <><p>{copy.businessEventPending}</p><button type="button" className="primary-action" onClick={onContinue}>{copy.hearCustomer}</button></> : <><ol className="beat-list">{visible.map((beat) => <li className={`business-beat beat-${beat.stage}`} key={beat.stage}><span>{beat.stage + 1}</span><p>{beat.productName ? `${beat.productName} · ` : ''}{beat.text}{beat.count > 0 ? ` · ${beat.count} ${beat.unit ?? copy.tickerUnit}` : ''}</p></li>)}</ol>
      {stage < 3 ? <ActionGroup layout="split" surface="paper"><button type="button" className="secondary-action" onClick={onSkip}>{copy.quickSettlement}</button><button type="button" className="primary-action" onClick={onNext}>{copy.continueBusiness}</button></ActionGroup> : <button type="button" className="primary-action" onClick={onContinue}>{copy.quickSettlement}</button>}</>}
  </section>
}

export function LedgerPanel({ view, netChange, expanded, copy, onToggle }: { view: GameViewModel; netChange: number; expanded: boolean; copy: Copy; onToggle: () => void }) {
  return <section className="paper-panel ledger-panel">
    <p className="section-kicker">{copy.ledgerTitleV2}</p>
    <p className={`net-change ${netChange < 0 ? 'negative' : 'positive'}`}>{netChange >= 0 ? '+' : ''}{netChange} {copy.moneyUnit}</p>
    <button type="button" className="ledger-toggle" aria-expanded={expanded} onClick={onToggle}>{expanded ? copy.ledgerCollapse : copy.ledgerExpand}</button>
    {expanded && <dl className="ledger-lines">{view.ledger.map((line, index) => <div key={`${line.label}-${index}`}><dt>{line.label}</dt><dd className={line.amount < 0 ? 'negative' : 'positive'}>{line.amount >= 0 ? '+' : ''}{line.amount}</dd></div>)}</dl>}
  </section>
}

export function OutcomePanel({ view, label, copy, onRestart }: { view: GameViewModel; label: string; copy: Copy; onRestart: () => void }) {
  if (!view.outcome) return null
  return <article className="outcome-panel scene-followup-panel">
    <p className="section-kicker">{label}</p>
    <h2>{view.outcome.title}</h2>
    <p>{view.outcome.content}</p>
    <h3>{copy.outcomeRoute}</h3>
    <p>{view.outcome.evaluation}</p>
    <blockquote>{view.outcome.shareText}</blockquote>
    <div className="outcome-actions">
      <EndingPosterPanel model={view.outcome.poster} copy={copy} />
      <button type="button" className="secondary-action" onClick={onRestart}>{copy.restart}</button>
    </div>
  </article>
}
