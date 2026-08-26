import type { SyntheticEvent } from 'react'
import type { CompanionViewModel } from '../app/viewV2'

function fallbackTo(fallbackSrc: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = fallbackSrc
  }
}

export function CompanionNote({ companion }: { companion: CompanionViewModel }) {
  return (
    <aside className={`companion-note pose-${companion.pose}${companion.featured ? ' is-featured' : ''}`} aria-label={`${companion.name}的当前提示`}>
      <div className="companion-art" aria-hidden="true">
        <img
          src={companion.imageSrc}
          alt=""
          width="180"
          height="240"
          onError={fallbackTo(companion.fallbackSrc)}
        />
      </div>
      <div className="companion-copy">
        <span className="companion-identity"><b>{companion.name}</b><small>{companion.role}</small></span>
        <p>{companion.invitation}</p>
        {companion.reassurance ? <p className="companion-reassurance">{companion.reassurance}</p> : null}
        <small className="companion-autonomy">{companion.autonomy}</small>
      </div>
    </aside>
  )
}
