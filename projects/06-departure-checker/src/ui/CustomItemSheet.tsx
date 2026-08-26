import { useState } from 'react'
import type {
  ChecklistCategory,
  ChecklistEntry,
  ChecklistLocation,
  ChecklistPriority,
} from '../content/schema'
import type { CustomItemDraft } from '../app/state'

type CustomItemSheetProps = {
  entry?: ChecklistEntry
  categories: ChecklistCategory[]
  locations: ChecklistLocation[]
  onCancel: () => void
  onSave: (draft: CustomItemDraft) => void
  onDelete?: () => void
}

const priorityOptions: Array<{ value: ChecklistPriority; label: string }> = [
  { value: 'must', label: '必带' },
  { value: 'should', label: '建议' },
  { value: 'optional', label: '可选' },
]

export function CustomItemSheet({
  entry,
  categories,
  locations,
  onCancel,
  onSave,
  onDelete,
}: CustomItemSheetProps) {
  const [label, setLabel] = useState(entry?.label ?? '')
  const [priority, setPriority] = useState<ChecklistPriority>(entry?.priority ?? 'optional')
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? 'category-custom')
  const [locationId, setLocationId] = useState(entry?.locationId ?? 'location-entryway')
  const availableCategories = categories.filter((category) => category.categoryId !== 'category-confirmation')

  return (
    <section className="bottom-sheet custom-sheet" role="dialog" aria-modal="true" aria-labelledby="custom-title">
      <div className="sheet-handle" aria-hidden="true" />
      <p className="eyebrow">{entry ? '编辑自定义项' : '添加自定义项'}</p>
      <h2 id="custom-title">只有你知道，这次不能忘的东西。</h2>
      <label className="field-label"><span>名称 · 最多 30 字</span><input autoFocus value={label} maxLength={30} onChange={(event) => setLabel(event.target.value)} /></label>
      <fieldset className="choice-field"><legend>优先级</legend><div className="chip-options">{priorityOptions.map((option) => <button type="button" className={priority === option.value ? 'active' : ''} aria-pressed={priority === option.value} key={option.value} onClick={() => setPriority(option.value)}>{option.label}</button>)}</div></fieldset>
      <label className="field-label"><span>类别</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{availableCategories.map((category) => <option value={category.categoryId} key={category.categoryId}>{category.label}</option>)}</select></label>
      <label className="field-label"><span>拿取位置</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}>{locations.map((location) => <option value={location.locationId} key={location.locationId}>{location.label}</option>)}</select></label>
      <div className="sheet-actions">
        {entry && onDelete && <button className="danger-button" type="button" onClick={onDelete}>删除</button>}
        <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
        <button className="primary-button" type="button" disabled={!label.trim()} onClick={() => onSave({ label, priority, categoryId, locationId })}>保存到清单</button>
      </div>
    </section>
  )
}
