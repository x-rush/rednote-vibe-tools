import { useState } from 'react'

export type GuidePresenceProps = {
  name: string
  role: string
  line: string
  compact?: boolean
  accent?: boolean
  showAvatar?: boolean
  onOpen?: (trigger: HTMLButtonElement) => void
}

function PresenceContent({ name, role, line, showAvatar = true }: Pick<GuidePresenceProps, 'name' | 'role' | 'line' | 'showAvatar'>) {
  const [failed, setFailed] = useState(false)
  return (
    <>
      {showAvatar && <span className={`guide-avatar${failed ? ' guide-avatar--fallback' : ''}`} aria-hidden="true">
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
      </span>}
      <span className="guide-presence__copy">
        <strong>{role} · {name}</strong>
        <small key={line}>{line}</small>
      </span>
    </>
  )
}

export function GuidePresence({ name, role, line, compact = false, accent = false, showAvatar = true, onOpen }: GuidePresenceProps) {
  const className = `guide-presence${compact ? ' guide-presence--compact' : ''}${showAvatar ? '' : ' guide-presence--no-avatar'}`
  if (onOpen) {
    return (
      <button type="button" className={className} data-state="interactive" data-accent={accent || undefined} onClick={(event) => onOpen(event.currentTarget)} aria-label={`请${name}说明当前卷页`}>
        <PresenceContent name={name} role={role} line={line} showAvatar={showAvatar} />
      </button>
    )
  }
  return (
    <aside className={className} data-state="present" data-accent={accent || undefined} aria-label={`${role}${name}`}>
      <PresenceContent name={name} role={role} line={line} showAvatar={showAvatar} />
    </aside>
  )
}
