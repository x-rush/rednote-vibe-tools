type GuidePresenceProps = {
  line: string
  onAsk?: () => void
  askLabel: string
  guideName: string
  guideRole: string
  presentation?: 'compact' | 'stage'
}

export function GuidePresence({ line, onAsk, askLabel, guideName, guideRole, presentation = 'compact' }: GuidePresenceProps) {
  const isStage = presentation === 'stage'
  return (
    <aside className={`guide-presence guide-presence--${presentation}`} aria-label={`${guideRole}${guideName}`}>
      <div className="guide-presence__portrait">
        <img
          src={`${import.meta.env.BASE_URL}assets/wuhualu/guide/${isStage ? 'guide-master-v1.webp' : 'guide-avatar-v1.webp'}`}
          alt={isStage ? `${guideRole}${guideName}` : ''}
          width={isStage ? 900 : 160}
          height={isStage ? 1200 : 160}
        />
      </div>
      <div className="guide-presence__dialogue"><p>{guideRole} · {guideName}</p><blockquote>{line}</blockquote>{onAsk && <button type="button" onClick={onAsk}>{askLabel}</button>}</div>
    </aside>
  )
}
