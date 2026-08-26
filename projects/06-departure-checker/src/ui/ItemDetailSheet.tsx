import type { ChecklistEntry } from '../content/schema'
import { AssetIcon } from './AssetIcon'

type ItemDetailSheetProps = {
  entry?: ChecklistEntry
  categoryLabel?: string
  categoryAssetId?: string
  locationLabel?: string
  onClose: () => void
}

const priorityLabels = { must: '必带', should: '建议携带', optional: '视情况携带' } as const

export function ItemDetailSheet({
  entry,
  categoryLabel,
  categoryAssetId,
  locationLabel,
  onClose,
}: ItemDetailSheetProps) {
  return (
    <section className="bottom-sheet detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div className="sheet-handle" aria-hidden="true" />
      {entry ? <>
        <div className="detail-heading">
          <span className="asset-tile">{categoryAssetId && <AssetIcon assetId={categoryAssetId} />}</span>
          <div><p className="eyebrow">{priorityLabels[entry.priority]} · {categoryLabel} · {locationLabel}</p><h2 id="detail-title">{entry.label}</h2></div>
        </div>
        <p className="detail-hint">{entry.hint}</p>
        <h3>为什么会出现？</h3>
        <ul className="reason-list">{entry.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        {entry.officialNoticeRequired && <p className="official-note">相关要求请以运营方、机构或场地方正式通知为准。</p>}
      </> : <h2 id="detail-title">该项目已不在当前清单中</h2>}
      <button className="primary-button" type="button" onClick={onClose}>知道了，回到清单</button>
    </section>
  )
}
