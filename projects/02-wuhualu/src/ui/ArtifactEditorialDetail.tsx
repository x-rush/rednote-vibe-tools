import type { ArtifactDetailViewModel, ContentCopy } from '../content/types.ts'
import { ArtifactMedia } from './ArtifactMedia.tsx'

type DetailCopy = Pick<ContentCopy,
  | 'backAction'
  | 'detailArchiveTitle'
  | 'detailChapterFormTitle'
  | 'detailChapterJourneyTitle'
  | 'detailChapterWorldTitle'
  | 'detailDimensionsLabel'
  | 'detailEvidenceTitle'
  | 'detailEyebrow'
  | 'detailExcavationLabel'
  | 'detailHookLabel'
  | 'detailMuseumLabel'
  | 'detailNarrativeTitle'
  | 'detailRelatedTitle'
  | 'detailSourcesTitle'
  | 'factsTitle'
  | 'sourceStatusTitle'
  | 'storySourceLevelSuffix'
>

type ArtifactEditorialDetailProps = {
  model: ArtifactDetailViewModel
  copy: DetailCopy
  onBack: () => void
}

export function ArtifactEditorialDetail({ model, copy, onBack }: ArtifactEditorialDetailProps) {
  const editorial = model.editorial
  const chapterTitles = editorial ? {
    'form-and-craft': copy.detailChapterFormTitle,
    'lived-world': copy.detailChapterWorldTitle,
    'journey-to-now': copy.detailChapterJourneyTitle,
  } : null

  return (
    <article className="artifact-detail-editorial" aria-labelledby="detail-title">
      <header className="detail-hero">
        <div className="detail-hero__heading">
          <p className="section-label">{copy.detailEyebrow}</p>
          <h1 id="detail-title">{model.title}</h1>
          <p className="detail-hero__subtitle">{model.subtitle}</p>
        </div>
        <ArtifactMedia artifactId={model.id} artifactName={model.title} role="reveal" showNature className="detail-hero__media" />
        <div className="detail-hero__tags">
          {model.categoryNames.map(name => <span key={name}>{name}</span>)}
        </div>
      </header>

      {editorial ? (
        <>
          <section className="detail-hook" aria-labelledby="detail-hook-title">
            <p id="detail-hook-title">{copy.detailHookLabel}</p>
            <blockquote>{editorial.hook}</blockquote>
          </section>

          <section className="detail-evidence" aria-labelledby="detail-evidence-title">
            <header className="detail-section-heading">
              <span aria-hidden="true">01</span>
              <h2 id="detail-evidence-title">{copy.detailEvidenceTitle}</h2>
            </header>
            <ol className="detail-evidence-grid">
              {editorial.evidence.map((evidence, index) => (
                <li className="detail-evidence-card" key={evidence.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{evidence.label}</strong>
                  <p>{evidence.note}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="detail-narrative" aria-labelledby="detail-narrative-title">
            <header className="detail-section-heading">
              <span aria-hidden="true">02</span>
              <h2 id="detail-narrative-title">{copy.detailNarrativeTitle}</h2>
            </header>
            <div className="detail-chapters">
              {editorial.chapters.map((chapter, index) => (
                <article className="detail-chapter" key={chapter.id}>
                  <header>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <h3>{chapterTitles?.[chapter.id]}</h3>
                  </header>
                  <div className="detail-chapter__body">
                    {chapter.sections.map(section => (
                      <section key={section.id}>
                        <h4>{section.title}</h4>
                        <p>{section.body}</p>
                      </section>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-archive" aria-labelledby="detail-archive-title">
            <header className="detail-section-heading">
              <span aria-hidden="true">03</span>
              <h2 id="detail-archive-title">{copy.detailArchiveTitle}</h2>
            </header>
            <dl className="detail-archive-grid">
              {model.dimensions && <div><dt>{copy.detailDimensionsLabel}</dt><dd>{model.dimensions}</dd></div>}
              {model.excavation && <div><dt>{copy.detailExcavationLabel}</dt><dd>{model.excavation}</dd></div>}
              {model.museum && <div><dt>{copy.detailMuseumLabel}</dt><dd>{model.museum}</dd></div>}
              <div><dt>{copy.sourceStatusTitle}</dt><dd>{model.verificationLabel}。{model.sourceNote}</dd></div>
            </dl>
          </section>

          {editorial.related.length > 0 && (
            <section className="detail-related" aria-labelledby="detail-related-title">
              <h2 id="detail-related-title">{copy.detailRelatedTitle}</h2>
              <div className="detail-related-shelf">
                {editorial.related.map(item => <article key={item.artifactId}><h3>{item.name}</h3><p>{item.reason}</p></article>)}
              </div>
            </section>
          )}

          <footer className="detail-sources">
            <h2>{copy.detailSourcesTitle}</h2>
            <ul>
              {editorial.sources.map(source => (
                <li key={source.id} data-source-id={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                  <span>{source.level} {copy.storySourceLevelSuffix}</span>
                </li>
              ))}
            </ul>
          </footer>
        </>
      ) : (
        <section className="fact-card"><h2>{copy.factsTitle}</h2>{model.facts.map(fact => <p key={fact}>{fact}</p>)}</section>
      )}

      <button className="secondary-button detail-back" type="button" onClick={onBack}>{copy.backAction}</button>
    </article>
  )
}
