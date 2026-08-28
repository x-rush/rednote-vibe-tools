import type { ContentPack } from '../content'
import type { GeneProgress } from '../progression/genes'

export function GeneGraph({ content, progress, onUnlock }: { content: ContentPack; progress: GeneProgress; onUnlock(id: string): void }) {
  return (
    <section className="lab-panel" aria-labelledby="gene-title">
      <header><p className="hatchery-region">{content.ui.labels.geneSamples}: {progress.genePoints}</p><h2 id="gene-title">{content.ui.screens.geneTitle}</h2></header>
      <div className="gene-grid">
        {content.geneNodes.map((node) => {
          const unlocked = node.unlockIds.every((id) => progress.unlockedIds.includes(id))
          const prerequisites = node.requires.every((required) => {
            const dependency = content.geneNodes.find((item) => item.id === required)
            return dependency?.unlockIds.every((id) => progress.unlockedIds.includes(id)) ?? false
          })
          return (
            <article key={node.id} className="gene-node" data-unlocked={unlocked || undefined}>
              <h3>{node.name}</h3><p>{node.unlockIds.map((id) => content.origins.find((item) => item.id === id)?.name ?? content.organelles.find((item) => item.id === id)?.name ?? id).join(' · ')}</p>
              <button type="button" disabled={unlocked || !prerequisites || progress.genePoints < node.cost} onClick={() => onUnlock(node.id)}>
                {unlocked ? content.ui.labels.unlocked : `${content.ui.actions.unlock} · ${node.cost}`}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
