import type { NpcCue, RelationshipContext } from '../content/schema'
import { DialoguePanel } from './DialoguePanel'
import { XiaomanStage } from './XiaomanStage'

type ContextOption = {
  id: RelationshipContext
  label: string
}

type ContextSelectionSceneProps = {
  cue: NpcCue
  eyebrow: string
  title: string
  body: string
  contextHint: string
  options: ContextOption[]
  principlesTitle: string
  principles: string[]
  onSelect: (context: RelationshipContext) => void
  onBack: () => void
}

export function ContextSelectionScene({ cue, eyebrow, title, body, contextHint, options, principlesTitle, principles, onSelect, onBack }: ContextSelectionSceneProps) {
  return (
    <section className="page page--intro" aria-labelledby="intro-title">
      <header className="page-header editorial-header intro-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="intro-title">{title}</h1>
        <p className="supporting-copy">{body}</p>
      </header>
      <div className="intro-grid">
        <aside className="intro-aside">
          <div className="intro-character">
            <div className="intro-character__halo" aria-hidden="true" />
            <XiaomanStage pose={cue.pose} mode="stage" name={cue.speaker} roleLabel={cue.roleLabel} />
            <DialoguePanel cue={cue} compact />
          </div>
        </aside>
        <div className="relationship-options">
          {options.map((option, index) => (
            <button type="button" key={option.id} onClick={() => onSelect(option.id)}>
              <span className="relationship-options__number">0{index + 1}</span>
              <span><strong>{option.label}</strong><small>{contextHint}</small></span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </div>
      <details className="principles intro-principles"><summary>{principlesTitle}<span aria-hidden="true">＋</span></summary><ul>{principles.map((principle) => <li key={principle}>{principle}</li>)}</ul></details>
      <button className="button button--ghost back-link" type="button" onClick={onBack}>返回首页</button>
    </section>
  )
}
