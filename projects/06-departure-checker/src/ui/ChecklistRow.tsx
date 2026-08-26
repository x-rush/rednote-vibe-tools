import type { ChecklistEntry } from '../content/schema'
import { AssetIcon } from './AssetIcon'

type ChecklistRowProps = {
  entry: ChecklistEntry
  categoryAssetId?: string
  onChecked: (entryId: string, checked: boolean) => void
  onDetail: (entryId: string) => void
  onEditCustom?: (entryId: string) => void
}

export function ChecklistRow({
  entry,
  categoryAssetId,
  onChecked,
  onDetail,
  onEditCustom,
}: ChecklistRowProps) {
  return (
    <li className={`checklist-row ${entry.checked ? 'is-checked' : ''}`}>
      <label className="checklist-control">
        <input
          type="checkbox"
          checked={entry.checked}
          onChange={(event) => onChecked(entry.entryId, event.target.checked)}
        />
        <span className="asset-tile small" aria-hidden="true">
          {categoryAssetId && <AssetIcon assetId={categoryAssetId} />}
        </span>
        <span className="entry-copy"><strong>{entry.label}</strong><small>{entry.reasons[0]}</small></span>
      </label>
      <div className="row-actions">
        <button className="text-button" type="button" onClick={() => onDetail(entry.entryId)}>解释</button>
        {entry.custom && onEditCustom && <button className="text-button" type="button" onClick={() => onEditCustom(entry.entryId)}>编辑</button>}
      </div>
    </li>
  )
}
