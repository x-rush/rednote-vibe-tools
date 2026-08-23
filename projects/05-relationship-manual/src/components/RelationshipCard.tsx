import type { RelationshipCardViewModel } from '../content/schema'

type RelationshipCardProps = {
  card: RelationshipCardViewModel
  compact: boolean
}

export function RelationshipCard({ card, compact }: RelationshipCardProps) {
  return (
    <article className={`manual-card${compact ? ' manual-card--compact' : ''}`} aria-label={`${card.title}卡片`}>
      <header className="manual-card__header">
        <p className="manual-card__context">{card.relationshipLabel}</p>
        <h2>{card.title}</h2>
        <p className="manual-card__summary">{card.shareSummary}</p>
      </header>
      <div className="manual-card__sections">
        {card.sections.map((section) => (
          <section className="manual-section" key={section.sectionId} aria-labelledby={`card-${section.sectionId}`}>
            <h3 id={`card-${section.sectionId}`}>{section.title}</h3>
            {section.paragraphs.map((paragraph, index) => <p key={`${section.sectionId}-${index}`}>{paragraph}</p>)}
          </section>
        ))}
      </div>
      <footer className="manual-card__footer">{card.disclaimer}</footer>
    </article>
  )
}
