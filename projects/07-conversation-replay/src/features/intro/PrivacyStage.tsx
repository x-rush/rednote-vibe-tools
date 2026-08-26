import type { SyntheticEvent } from 'react'
import type { CompanionViewModel, ScreenSectionV2 } from '../../app/viewV2'

function fallbackTo(fallbackSrc: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = fallbackSrc
  }
}

export function PrivacyStage({
  companion,
  sections,
  primaryLabel,
  secondaryLabel,
  ephemeralDescription,
  localDescription,
  onEphemeral,
  onLocal,
}: {
  companion: CompanionViewModel
  sections: ScreenSectionV2[]
  primaryLabel: string
  secondaryLabel: string
  ephemeralDescription: string
  localDescription: string
  onEphemeral(): void
  onLocal(): void
}) {
  return (
    <>
      <section className="privacy-stage" aria-label={`${companion.name}说明保存方式`}>
        <div className="privacy-stage-copy">
          <span><b>{companion.name}</b><small>{companion.role}</small></span>
          <p>{companion.invitation}</p>
          {companion.reassurance ? <small>{companion.reassurance}</small> : null}
          <em>{companion.autonomy}</em>
        </div>
        <div className="privacy-stage-art" aria-hidden="true">
          <img src={companion.imageSrc} alt="" width="900" height="1200" onError={fallbackTo(companion.fallbackSrc)} />
        </div>
        <div className="privacy-tags">
          {sections.map((section, index) => (
            <article key={section.id}>
              <b>{index + 1}</b>
              <span><strong>{section.title}</strong><small>{section.body}</small></span>
            </article>
          ))}
        </div>
      </section>
      <div className="privacy-mode-cards">
        <button className="privacy-mode primary-mode" type="button" onClick={onEphemeral}>
          <strong>{primaryLabel}</strong><small>{ephemeralDescription}</small>
        </button>
        <button className="privacy-mode local-mode" type="button" onClick={onLocal}>
          <strong>{secondaryLabel}</strong><small>{localDescription}</small>
        </button>
      </div>
    </>
  )
}
