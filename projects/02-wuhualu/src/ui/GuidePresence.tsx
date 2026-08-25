type GuidePresenceProps = {
  line: string
  onAsk?: () => void
  askLabel: string
  guideName: string
  guideRole: string
}

export function GuidePresence({ line, onAsk, askLabel, guideName, guideRole }: GuidePresenceProps) {
  return (
    <aside className="guide-presence" aria-label={`${guideRole}${guideName}`}>
      <img src={`${import.meta.env.BASE_URL}assets/wuhualu/guide/guide-avatar-v1.webp`} alt="" width="160" height="160" />
      <div><p>{guideRole} · {guideName}</p><blockquote>{line}</blockquote>{onAsk && <button type="button" onClick={onAsk}>{askLabel}</button>}</div>
    </aside>
  )
}
