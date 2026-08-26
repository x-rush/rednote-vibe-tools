import type { NpcCue } from '../content/schema'

type DialoguePanelProps = {
  cue: NpcCue
  onPrimary?: () => void
  onSecondary?: () => void
  onSkip?: () => void
  compact?: boolean
}

export function DialoguePanel({ cue, onPrimary, onSecondary, onSkip, compact = false }: DialoguePanelProps) {
  return (
    <div className={`dialogue-panel${compact ? ' dialogue-panel--compact' : ''}`}>
      <p className="dialogue-panel__speaker"><strong>{cue.speaker}</strong><span>{cue.roleLabel}</span></p>
      <p className="dialogue-panel__text">{cue.text}</p>
      {!compact && (onPrimary || onSecondary || onSkip) && (
        <div className="dialogue-panel__actions">
          {onPrimary && <button className="button button--primary" type="button" onClick={onPrimary}>{cue.primaryAction}</button>}
          {onSecondary && cue.secondaryAction && <button className="button button--ghost" type="button" onClick={onSecondary}>{cue.secondaryAction}</button>}
          {onSkip && cue.skippable && <button className="button button--text" type="button" onClick={onSkip}>跳过这段引子</button>}
        </div>
      )}
    </div>
  )
}
