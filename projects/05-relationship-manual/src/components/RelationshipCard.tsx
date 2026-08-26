import { getCardSectionArtwork } from '../app/presentation'
import sensitiveIcon from '../assets/art/sensitive.svg'
import type { RelationshipCardViewModel } from '../content/schema'

const ROLE_LABELS = {
  need: '我的需要',
  trigger: '容易卡住的时刻',
  action: '可以这样做',
  repair: '一起修复',
} as const

type RelationshipCardProps = {
  card: RelationshipCardViewModel
  compact: boolean
}

export function RelationshipCard({ card, compact }: RelationshipCardProps) {
  return (
    <article className={`manual-card${compact ? ' manual-card--compact' : ''}`} aria-label={`${card.title}卡片`}>
      <span className="manual-card__fold" aria-hidden="true" />
      <header className="manual-card__header">
        <div className="manual-card__meta"><p className="manual-card__context">{card.relationshipLabel}</p><span>{compact ? '简洁分享版' : '完整本地版'}</span></div>
        <h2>{card.title}</h2>
        <p className="manual-card__summary">{card.shareSummary}</p>
      </header>
      <div className="manual-card__sections">
        {card.sections.map((section, sectionIndex) => {
          const artwork = getCardSectionArtwork(section.sectionId)
          return (
            <section className={`manual-section${section.sensitive ? ' manual-section--sensitive' : ''}`} key={section.sectionId} aria-labelledby={`card-${section.sectionId}`}>
              <header>
                <span className="manual-section__icon"><img src={artwork.iconUrl} alt="" /></span>
                <span><small>{String(sectionIndex + 1).padStart(2, '0')} / {artwork.shortLabel}</small><h3 id={`card-${section.sectionId}`}>{section.title}</h3></span>
                {section.sensitive && <span className="manual-section__sensitive"><img src={sensitiveIcon} alt="" />敏感</span>}
              </header>
              <div className="manual-section__paragraphs">{section.paragraphs.map((paragraph, index) => (
                <div className={`manual-paragraph manual-paragraph--${section.paragraphRoles[index] ?? 'need'}`} key={`${section.sectionId}-${index}`}>
                  <span>{ROLE_LABELS[section.paragraphRoles[index] ?? 'need']}</span>
                  <p>{paragraph}</p>
                </div>
              ))}</div>
            </section>
          )
        })}
      </div>
      <footer className="manual-card__footer"><span>RELATIONSHIP MANUAL</span><p>{card.disclaimer}</p></footer>
    </article>
  )
}
