import type { ContentPack } from '../content'
import { codexCompletion, type CodexProgress } from '../progression/codex'

export function Codex({ content, progress }: { content: ContentPack; progress: CodexProgress }) {
  const entries = [...content.nutrients, ...content.creatures, ...content.events, ...content.bosses]
  const completion = codexCompletion(progress)
  return (
    <section className="lab-panel" aria-labelledby="codex-title">
      <header><p className="hatchery-region">{completion.complete} / {completion.total}</p><h2 id="codex-title">{content.ui.screens.codexTitle}</h2><p>{content.meta.fictionDisclaimer}</p></header>
      <div className="codex-grid">
        {entries.map((entry) => <article key={entry.id} data-state={progress[entry.id] ?? 'unseen'}><strong>{progress[entry.id] ? entry.name : content.ui.labels.unknownEntry}</strong><span>{content.ui.labels[`codex_${progress[entry.id] ?? 'unseen'}`]}</span></article>)}
      </div>
    </section>
  )
}
