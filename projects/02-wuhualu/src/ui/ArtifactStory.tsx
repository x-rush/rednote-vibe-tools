import type { StorySectionId } from '../content/types.ts'
import type { StoryViewModel } from './story-view-model.ts'

type ArtifactStoryProps = {
  model: StoryViewModel
  readIds: readonly StorySectionId[]
  onSectionRead: (id: StorySectionId) => void
  legacyPendingLabel: string
  copy: { eyebrow: string; navLabel: string; sectionPrefix: string; sourcesLabel: string; sourceLevelSuffix: string; readAction: string; readDone: string }
}

export function ArtifactStory({ model, readIds, onSectionRead, legacyPendingLabel, copy }: ArtifactStoryProps) {
  if (model.kind === 'legacy') {
    return (
      <article className="artifact-story legacy-story" aria-labelledby="story-title">
        <p className="section-label">{legacyPendingLabel}</p>
        <h1 id="story-title">{model.title}</h1>
        {model.facts.map(fact => <p key={fact}>{fact}</p>)}
        <small>{model.sourceNote}</small>
      </article>
    )
  }
  return (
    <article className="artifact-story" aria-labelledby="story-title">
      <p className="section-label">{copy.eyebrow}</p>
      <h1 id="story-title">{model.title}</h1>
      <p className="story-hook">{model.hook}</p>
      <nav className="story-index" aria-label={copy.navLabel}>
        {model.sections.map((section, index) => <a key={section.id} href={`#story-${section.id}`} className={readIds.includes(section.id) ? 'read' : ''}>{index + 1}</a>)}
      </nav>
      <div className="story-sections">
        {model.sections.map((section, index) => {
          const read = readIds.includes(section.id)
          return (
            <section key={section.id} id={`story-${section.id}`} tabIndex={-1}>
              <p className="story-number">{copy.sectionPrefix} {index + 1} 札</p>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <details><summary>{copy.sourcesLabel} · {section.sources.length}</summary><ul>{section.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span>{source.level} {copy.sourceLevelSuffix}</span></li>)}</ul></details>
              <button className={read ? 'read-button done' : 'read-button'} type="button" onClick={() => onSectionRead(section.id)}>{read ? copy.readDone : copy.readAction}</button>
            </section>
          )
        })}
      </div>
    </article>
  )
}
