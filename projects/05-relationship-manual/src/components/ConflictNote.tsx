import type { NpcCue } from '../content/schema'
import { DialoguePanel } from './DialoguePanel'
import { XiaomanStage } from './XiaomanStage'

type ConflictNoteProps = {
  cue: NpcCue
  onAdopt: () => void
  onPreserve: () => void
  onClose: () => void
}

export function ConflictNote({ cue, onAdopt, onPreserve, onClose }: ConflictNoteProps) {
  return (
    <aside className="conflict-note" aria-label="小满的合并建议">
      <XiaomanStage pose={cue.pose} mode="avatar" name={cue.speaker} roleLabel={cue.roleLabel} />
      <DialoguePanel cue={cue} compact />
      <div className="conflict-note__actions">
        <button className="button button--secondary" type="button" onClick={onAdopt}>{cue.primaryAction}</button>
        <button className="button button--ghost" type="button" onClick={onPreserve}>{cue.secondaryAction ?? '保留原选择'}</button>
        <button className="button button--text" type="button" onClick={onClose}>稍后决定</button>
      </div>
    </aside>
  )
}
