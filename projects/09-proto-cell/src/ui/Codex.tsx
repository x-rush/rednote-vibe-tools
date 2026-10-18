import type { ContentPack } from '../content'
import { codexCompletion, type CodexProgress } from '../progression/codex'
import { assetPath } from '../content/assets'

export function Codex({ content, progress, onClose }: { content: ContentPack; progress: CodexProgress; onClose: () => void }) {
  const entries = [...content.nutrients, ...content.creatures, ...content.events, ...content.bosses]
  const completion = codexCompletion(progress)
  const notes = new Map<string, ContentPack['ecosystems'][number]['enemyNotes'][number]>(content.ecosystems.flatMap((ecosystem) => ecosystem.enemyNotes.map((note) => [note.creatureId, note] as const)))
  return (
    <section className="lab-panel" aria-labelledby="codex-title">
      <button className="game-overlay__secondary lab-detail__back" type="button" onClick={onClose}>{content.ui.actions.backToLab}</button>
      <header><p className="hatchery-region">{completion.complete} / {completion.total}</p><h2 id="codex-title">{content.ui.screens.codexTitle}</h2><p>{content.meta.fictionDisclaimer}</p></header>
      <div className="codex-grid">
        {entries.map((entry) => { const note = notes.get(entry.id); const image = assetPath(entry.id) ?? assetPath(`${entry.id}:body`); return <article key={entry.id} data-state={progress[entry.id] ?? 'unseen'}>{image && <img className="content-icon" src={image} alt="" />}<strong>{progress[entry.id] ? entry.name : content.ui.labels.unknownEntry}</strong><span>{content.ui.labels[`codex_${progress[entry.id] ?? 'unseen'}`]}</span>{progress[entry.id] && note && <div className="codex-behavior"><b>{note.title}</b><p>{note.behavior}</p><p>{note.weakness}</p></div>}</article> })}
      </div>
    </section>
  )
}
