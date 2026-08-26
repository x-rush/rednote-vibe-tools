import type { SyntheticEvent } from 'react'
import type { CompanionViewModel } from '../../app/viewV2'
import { AssetIcon } from '../../components/AssetIcon'
import type { StoredReplayV2 } from '../../storage/storageV2'

function fallbackTo(fallbackSrc: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = fallbackSrc
  }
}

export function GuideRecall({ companion, boundaries, page, onClose, onExit }: { companion: CompanionViewModel; boundaries: string[]; page: string; onClose(): void; onExit(): void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-sheet guide-recall-sheet" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header className="guide-recall-head">
          <span><b id="help-title">问{companion.name}</b><small>{companion.role} · {page}</small></span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭帮助">×</button>
        </header>
        <div className="guide-recall-portrait" aria-hidden="true">
          <img src={companion.imageSrc} alt="" width="900" height="1200" onError={fallbackTo(companion.fallbackSrc)} />
        </div>
        <div className="guide-dialogue">
          <p>{companion.invitation}</p>
          {companion.reassurance ? <small>{companion.reassurance}</small> : null}
          <em>{companion.autonomy}</em>
        </div>
        <div className="help-rows">
          <p><b>当前步骤</b><br />{page}</p>
          <p><b>句式提示</b><br />事实—感受—推测（待核对）—需要—可协商请求</p>
          <details className="help-boundaries"><summary>陪伴边界</summary>{boundaries.map((boundary) => <p key={boundary}>{boundary}</p>)}</details>
          <button className="button ghost" type="button" onClick={onExit}>我想安全退出</button>
        </div>
        <div className="guide-recall-actions"><button className="button primary" type="button" onClick={onClose}>回到当前步骤</button></div>
      </section>
    </div>
  )
}

export function ConfirmSheet({ title, body, confirmLabel, onConfirm, onCancel }: { title: string; body: string; confirmLabel: string; onConfirm(): void; onCancel(): void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2><p>{body}</p>
        <div className="button-stack"><button className="button danger" type="button" onClick={onConfirm}>{confirmLabel}</button><button className="button ghost" type="button" onClick={onCancel}>取消</button></div>
      </section>
    </div>
  )
}

export function SavedResults({ items, titleForScenario, onRestore, onDelete }: { items: StoredReplayV2[]; titleForScenario(scenarioId: string): string; onRestore(item: StoredReplayV2): void; onDelete(item: StoredReplayV2): void }) {
  if (items.length === 0) return <p className="empty-note">还没有主动保存的复盘。无痕内容不会出现在这里。</p>
  return (
    <div className="saved-results">
      {items.map((item) => <article key={item.id}><div><strong>{titleForScenario(item.scenarioId)}</strong><time>{new Date(item.savedAt).toLocaleString('zh-CN')}</time></div><div><button type="button" onClick={() => onRestore(item)}>恢复</button><button type="button" onClick={() => onDelete(item)}><AssetIcon name="delete" size={18} />删除</button></div></article>)}
    </div>
  )
}
