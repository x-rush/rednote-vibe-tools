import type { Quest, UiContent } from '../content/schema'
import type { OfferExplanation } from './state'
import { assets } from './asset-paths'
import { RpgSparkField, RuneField } from './RpgEffects'

type MatchingRitualProps = { ui: UiContent; conditions: string[]; onSkip: () => void }

export function MatchingRitual({ ui, conditions, onSkip }: MatchingRitualProps) {
  return (
    <section className="matching-ritual" aria-live="polite" aria-labelledby="matching-title">
      <RuneField />
      <div className="matching-seal" aria-hidden="true"><img src={assets.prop('notice-pin')} alt="" /></div>
      <p className="eyebrow">{ui.pages.matching.eyebrow}</p>
      <h1 id="matching-title">{ui.pages.matching.title}</h1>
      <div className="condition-tags">{conditions.map((condition) => <span key={condition}>{condition}</span>)}</div>
      <p>{ui.pages.matching.description}</p>
      <button className="text-button" type="button" onClick={onSkip}>{ui.actions.skipMatching}</button>
    </section>
  )
}

type QuestOfferProps = {
  quest: Quest
  categoryName: string
  explanation: OfferExplanation
  ui: UiContent
  busy?: boolean
  onAccept: () => void
  onSwap: () => void
  onEditPreferences: () => void
  onUnsuitable: () => void
}

export function QuestOffer({ quest, categoryName, explanation, ui, busy = false, onAccept, onSwap, onEditPreferences, onUnsuitable }: QuestOfferProps) {
  return (
    <section className="quest-offer">
      {explanation.stage !== 'exact' && <aside className="match-explanation match-explanation--relaxed">
        <div><strong>{ui.quest.labels.relaxed}</strong><ul>{explanation.relaxed.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><strong>{ui.quest.labels.kept}</strong><ul>{ui.quest.neverRelaxed.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </aside>}
      <QuestSheet quest={quest} categoryName={categoryName} ui={ui} reasons={explanation.reasons} />
      <div className="quest-actions">
        <button className="button button--primary button--large" type="button" disabled={busy} onClick={onAccept}>{ui.actions.accept}</button>
        <button className="button button--secondary" type="button" disabled={busy} onClick={onSwap}>{ui.actions.swap}</button>
        <button className="button button--ghost" type="button" disabled={busy} onClick={onEditPreferences}>{ui.actions.editPreferences}</button>
        <button className="text-button" type="button" disabled={busy} onClick={onUnsuitable}>{ui.actions.unsuitable}</button>
      </div>
    </section>
  )
}

type ActiveQuestViewProps = {
  quest: Quest
  categoryName: string
  ui: UiContent
  classic?: boolean
  onComplete: () => void
  onAbandon: () => void
  onUnsuitable: () => void
}

export function ActiveQuestView({ quest, categoryName, ui, classic = false, onComplete, onAbandon, onUnsuitable }: ActiveQuestViewProps) {
  return (
    <section className="active-quest-view">
      <QuestSheet quest={quest} categoryName={categoryName} ui={ui} compact classic={classic} />
      <p className="no-proof"><img src={assets.status('active')} alt="" />{ui.notices.noProof}</p>
      <div className="quest-actions quest-actions--stack">
        <button className="button button--primary button--large" type="button" onClick={onComplete}>{ui.actions.complete}</button>
        <button className="button button--ghost" type="button" onClick={onAbandon}>{ui.actions.abandon}</button>
        <button className="text-button" type="button" onClick={onUnsuitable}>{ui.actions.unsuitable}</button>
      </div>
    </section>
  )
}

function QuestSheet({ quest, categoryName, ui, reasons = [], compact = false, classic = false }: { quest: Quest; categoryName: string; ui: UiContent; reasons?: string[]; compact?: boolean; classic?: boolean }) {
  const environments = quest.environments.map((value) => ui.quest.values.environment[value]).join(' / ')
  return (
    <article className={`quest-sheet${compact ? ' quest-sheet--active' : ''}`} aria-labelledby="quest-title">
      <RpgSparkField />
      <div className="quest-sheet__heading">
        <img src={assets.category(quest.category)} alt="" />
        <div><span>{categoryName}</span><strong>{ui.quest.values.ranks[quest.difficulty]}</strong></div>
        <span className={`quest-tone quest-tone--${quest.tone}`}>{ui.quest.tones[quest.tone]}</span>
      </div>
      <p className="guild-brief">{quest.guildBrief}</p>
      {classic && <span className="classic-quest-label">{ui.quest.labels.classic}</span>}
      <h2 id="quest-title">{quest.title}</h2>
      <p className="quest-description">{quest.description}</p>
      <dl className="quest-facts">
        <Fact label={ui.quest.labels.time} value={ui.checkIn.timeLabels[quest.timeCost]} />
        <Fact label={ui.quest.labels.energy} value={ui.quest.values.energy[quest.energyLevel]} />
        <Fact label={ui.quest.labels.environment} value={environments} />
        <Fact label={ui.quest.labels.social} value={ui.quest.values.social[quest.socialLevel]} />
        <Fact label={ui.quest.labels.budget} value={ui.quest.values.free} />
        <Fact label={ui.quest.labels.xp} value={`${quest.xp} XP`} />
      </dl>
      {reasons.length > 0 && <aside className="recommendation"><strong>{ui.quest.labels.why}</strong><ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></aside>}
      <section className="quest-steps"><h3>{ui.quest.labels.steps}</h3><ol>{quest.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <aside className="exit-rule"><strong>{ui.quest.labels.exit}</strong><p>{quest.abandonRule}</p></aside>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}
