import type { NpcCue } from '../content/schema'
import { DialoguePanel } from './DialoguePanel'
import { XiaomanStage } from './XiaomanStage'

type StorageWarningProps = {
  cue: NpcCue
  backupText: string
  onRetry: () => void
  onContinue: () => void
}

export function StorageWarning({ cue, backupText, onRetry, onContinue }: StorageWarningProps) {
  return (
    <aside className="storage-warning" role="status">
      <XiaomanStage pose={cue.pose} mode="avatar" name={cue.speaker} roleLabel={cue.roleLabel} />
      <DialoguePanel cue={cue} compact />
      <p className="storage-warning__loss-note">关闭页面后，本次进度不会保留。请先展开备份长按选择文字，或直接截图当前页面。</p>
      <details className="storage-warning__backup">
        <summary>展开纯文字备份</summary>
        <textarea aria-label="当前会话纯文字备份" readOnly rows={9} value={backupText} />
      </details>
      <div className="storage-warning__actions">
        <button className="button button--secondary" type="button" onClick={onRetry}>{cue.primaryAction}</button>
        <button className="button button--text" type="button" onClick={onContinue}>{cue.secondaryAction ?? '继续当前会话'}</button>
      </div>
    </aside>
  )
}
