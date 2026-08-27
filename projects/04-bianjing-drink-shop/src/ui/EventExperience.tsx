import type { EventResolutionView, EventView } from '../state/view-model'
import { actorAssetPath } from './actor-assets'

export function EventSituation({ event, eyebrow, continueLabel, onContinue }: {
  event: EventView
  eyebrow: string
  continueLabel: string
  onContinue: () => void
}) {
  const assetPath = actorAssetPath(event.scene.actorRole)
  return <article className="paper-panel event-experience scene-followup-panel event-situation" aria-labelledby="event-situation-title">
    <p className="section-kicker">{eyebrow}</p>
    <h2 id="event-situation-title">{event.title}</h2>
    <p className="event-scene-identity">
      <span>{event.scene.timingLabel}</span>
      <span>{event.scene.locationLabel}</span>
      <span>{event.scene.actorLabel}</span>
    </p>
    <div className={`event-character-stage${assetPath ? '' : ' event-character-stage-text-only'}`}>
      {assetPath && <img
        className="event-actor"
        src={assetPath}
        alt={`${event.scene.actorLabel} · ${event.scene.locationLabel}`}
      />}
      <p className="event-body">{event.content}</p>
    </div>
    <button type="button" className="primary-action" onClick={onContinue}>{continueLabel}</button>
  </article>
}

export function EventChoicePanel({
  event,
  selectedChoiceId,
  isSubmitting,
  selectedLabel,
  confirmLabel,
  onSelect,
  onConfirm,
}: {
  event: EventView
  selectedChoiceId?: string
  isSubmitting: boolean
  selectedLabel: string
  confirmLabel: string
  onSelect: (choiceId: string) => void
  onConfirm: () => void
}) {
  return <article className="paper-panel event-experience scene-followup-panel event-choice-panel" aria-labelledby="event-choice-title">
    <h2 id="event-choice-title">{event.title}</h2>
    <p className="event-body">{event.content}</p>
    <div className="choice-grid">{event.choices.map((choice) => {
      const selected = choice.choiceId === selectedChoiceId
      return <button
        type="button"
        key={choice.choiceId}
        aria-pressed={selected}
        disabled={isSubmitting}
        onClick={() => onSelect(choice.choiceId)}
      >
        <strong>{choice.text}</strong>
        <small>{choice.impactHints.map((hint) => hint.text).join(' · ')}</small>
        {selected && <span>{selectedLabel}</span>}
      </button>
    })}</div>
    <button
      type="button"
      className="primary-action"
      disabled={!selectedChoiceId || isSubmitting}
      aria-busy={isSubmitting}
      onClick={onConfirm}
    >{confirmLabel}</button>
  </article>
}

export function EventResultPanel({ resolution, acknowledgeLabel, onAcknowledge }: {
  resolution: EventResolutionView
  acknowledgeLabel: string
  onAcknowledge: () => void
}) {
  return <article className="paper-panel event-experience scene-followup-panel event-result-panel" aria-labelledby="event-result-title">
    <p className="section-kicker">{resolution.choiceText}</p>
    <h2 id="event-result-title">{resolution.title}</h2>
    <p className="event-body">{resolution.resultText}</p>
    {resolution.deltas.length > 0 && <dl className="event-deltas">
      {resolution.deltas.map((delta) => <div key={delta.id}>
        <dt>{delta.label}</dt>
        <dd className={delta.value < 0 ? 'negative' : 'positive'}>{delta.value > 0 ? '+' : ''}{delta.value}</dd>
      </div>)}
    </dl>}
    {resolution.modifierDetails.length > 0 && <ul className="event-modifiers">
      {resolution.modifierDetails.map((modifier) => <li key={modifier.label}>{modifier.label} · {modifier.remainingText}</li>)}
    </ul>}
    {resolution.chainStatusLabel && <p className="chain-status" role="status">{resolution.chainTitle ? `${resolution.chainTitle} · ` : ''}{resolution.chainStatusLabel}</p>}
    <button type="button" className="primary-action" onClick={onAcknowledge}>{acknowledgeLabel}</button>
  </article>
}

export function EventSettlementSummary({ resolution, title, chainLabel }: {
  resolution: EventResolutionView
  title: string
  chainLabel: string
}) {
  return <section className="paper-panel event-settlement-summary" aria-labelledby="event-settlement-title">
    <p className="section-kicker">{title}</p>
    <h2 id="event-settlement-title">{resolution.title}</h2>
    <p>{resolution.resultText}</p>
    {resolution.deltas.length > 0 && <dl className="event-deltas">{resolution.deltas.map((delta) => <div key={delta.id}>
      <dt>{delta.label}</dt><dd className={delta.value < 0 ? 'negative' : 'positive'}>{delta.value > 0 ? '+' : ''}{delta.value}</dd>
    </div>)}</dl>}
    {resolution.modifierDetails.length > 0 && <ul className="event-modifiers">{resolution.modifierDetails.map((modifier) => <li key={modifier.label}>{modifier.label} · {modifier.remainingText}</li>)}</ul>}
    {resolution.chainStatusLabel && <p className="chain-status" role="status">{chainLabel} · {resolution.chainTitle ?? resolution.eventId} · {resolution.chainStatusLabel}</p>}
  </section>
}
