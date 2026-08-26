import type { SyntheticEvent } from 'react'
import type { CompanionViewModel } from '../../app/viewV2'

function fallbackTo(fallbackSrc: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = fallbackSrc
  }
}

export function LandingHero({
  companion,
  beforeText,
  afterText,
}: {
  companion: CompanionViewModel
  beforeText: string
  afterText: string
}) {
  return (
    <section className="landing-hero" aria-label={`${companion.name}的编辑工作台`}>
      <div className="landing-revision" aria-label="表达修订示例">
        <p className="landing-revision-before"><span>原表达</span><s>{beforeText}</s></p>
        <p className="landing-revision-after"><span>更可核对</span><b>{afterText}</b></p>
      </div>
      <div className="landing-hero-art" aria-hidden="true">
        <img src={companion.imageSrc} alt="" width="900" height="1200" onError={fallbackTo(companion.fallbackSrc)} />
      </div>
      <aside className="landing-hero-note">
        <span><b>{companion.name}</b><small>{companion.role}</small></span>
        <p>{companion.invitation}</p>
        {companion.reassurance ? <small>{companion.reassurance}</small> : null}
        <em>{companion.autonomy}</em>
      </aside>
    </section>
  )
}
