import type { ChecklistDiff } from './checklistView'

type ConditionDiffSheetProps = {
  diff: ChecklistDiff
  onCancel: () => void
  onConfirm: () => void
}

export function ConditionDiffSheet({ diff, onCancel, onConfirm }: ConditionDiffSheetProps) {
  const addedSuffix = diff.added.length > 3 ? `等 ${diff.added.length} 项` : ''
  const removedSuffix = diff.removed.length > 3 ? `等 ${diff.removed.length} 项` : ''

  return (
    <section className="bottom-sheet diff-sheet" role="dialog" aria-modal="true" aria-labelledby="diff-title">
      <div className="sheet-handle" aria-hidden="true" />
      <p className="eyebrow">重算结果</p>
      <h2 id="diff-title">清单会这样变化</h2>
      <div className="diff-counts">
        <span><strong>+{diff.added.length}</strong>新增</span>
        <span><strong>−{diff.removed.length}</strong>移除</span>
        <span><strong>{diff.preservedCheckedIds.length}</strong>保留勾选</span>
      </div>
      {diff.added.length > 0 && <p><strong>新增：</strong>{diff.added.slice(0, 3).map((entry) => entry.label).join('、')}{addedSuffix}</p>}
      {diff.removed.length > 0 && <p><strong>移除：</strong>{diff.removed.slice(0, 3).map((entry) => entry.label).join('、')}{removedSuffix}</p>}
      <p className="inline-notice">自定义项不会自动删除；仍存在的项目保留勾选。</p>
      <div className="split-actions"><button className="secondary-button" type="button" onClick={onCancel}>返回修改</button><button className="primary-button" type="button" onClick={onConfirm}>确认更新</button></div>
    </section>
  )
}
