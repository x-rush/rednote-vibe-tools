import type { ContentPack } from '../content'
import { codexCompletion, type CodexProgress } from '../progression/codex'
import { assetPath } from '../content/assets'

export function Codex({ content, progress, onClose }: { content: ContentPack; progress: CodexProgress; onClose: () => void }) {
  const entries = [...content.nutrients, ...content.creatures, ...content.events, ...content.bosses]
  const completion = codexCompletion(progress)
  return (
    <section className="lab-panel" aria-labelledby="codex-title">
      <button className="game-overlay__secondary lab-detail__back" type="button" onClick={onClose}>{content.ui.actions.backToLab}</button>
      <header><p className="hatchery-region">{completion.complete} / {completion.total}</p><h2 id="codex-title">{content.ui.screens.codexTitle}</h2><p>{content.meta.fictionDisclaimer}</p></header>
      <div className="codex-grid">
        {entries.map((entry) => { const image = assetPath(entry.id) ?? assetPath(`${entry.id}:body`); return <article key={entry.id} data-state={progress[entry.id] ?? 'unseen'}>{image && <img className="content-icon" src={image} alt="" />}<strong>{progress[entry.id] ? entry.name : content.ui.labels.unknownEntry}</strong><span>{content.ui.labels[`codex_${progress[entry.id] ?? 'unseen'}`]}</span></article> })}
      </div>
    </section>
  )
}
