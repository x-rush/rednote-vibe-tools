import type { SavedChecklist } from '../content/schema'

type OverwriteDialogProps = {
  savedLists: SavedChecklist[]
  selectedId?: string
  onSelect: (id: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function OverwriteDialog({ savedLists, selectedId, onSelect, onCancel, onConfirm }: OverwriteDialogProps) {
  return (
    <section className="modal-dialog overwrite-dialog" role="alertdialog" aria-modal="true" aria-labelledby="overwrite-title">
      <p className="eyebrow">保存新清单</p><h2 id="overwrite-title">最近位置已经满了</h2><p>选择一份要替换的旧记录。未确认前不会修改本机数据。</p>
      <div className="overwrite-options">{savedLists.map((saved) => <label className={selectedId === saved.id ? 'selected' : ''} key={saved.id}><input type="radio" name="overwrite" checked={selectedId === saved.id} onChange={() => onSelect(saved.id)} /><span><strong>{saved.name}</strong><small>{saved.updatedAt.slice(0, 10)} · {saved.items.length} 项</small></span></label>)}</div>
      <p className="inline-notice">只替换这一份实例，不影响内置场景、规则或另外两份记录。</p>
      <div className="split-actions"><button className="secondary-button" type="button" onClick={onCancel}>取消</button><button className="primary-button" type="button" disabled={!selectedId} onClick={onConfirm}>确认覆盖并保存</button></div>
    </section>
  )
}
