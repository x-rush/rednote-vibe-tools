import { useState } from 'react'
import type { ExperienceCopy } from '../../content/types'

export function GuideAvatarButton({ copy, onOpen }: { copy: ExperienceCopy['guide']; onOpen: (trigger: HTMLButtonElement) => void }) {
  const [failed, setFailed] = useState(false)

  return (
    <button type="button" className="guide-avatar-button" onClick={(event) => onOpen(event.currentTarget)} aria-label={`请${copy.name}说明这卷测试`}>
      <span className={`guide-avatar${failed ? ' guide-avatar--fallback' : ''}`} aria-hidden="true">
        {!failed && (
          <img
            src="/assets/sbti/guide/guide-avatar-v1.webp"
            alt=""
            width="160"
            height="160"
            loading="eager"
            decoding="async"
            onError={() => setFailed(true)}
          />
        )}
      </span>
      <span><strong>{copy.role} · {copy.name}</strong><small>三句说明，随时可跳过</small></span>
    </button>
  )
}
