import type {
  ChecklistCategory,
  ChecklistLocation,
  GeneratedChecklist,
} from '../content/schema'
import type { ChecklistViewMode } from './checklistView'
import { getCriticalRemaining, groupChecklist } from './checklistView'
import { AssetIcon } from './AssetIcon'
import { ChecklistRow } from './ChecklistRow'
import { GuidePortrait } from './GuidePortrait'
import { LocationRouteView } from './LocationRouteView'

const viewLabels: Record<ChecklistViewMode, string> = {
  priority: '重要程度',
  category: '物品类别',
  location: '空间巡视',
}

type ChecklistWorkspaceProps = {
  scenarioName: string
  conditionLabels: string[]
  checklist: GeneratedChecklist
  viewMode: ChecklistViewMode
  categories: ChecklistCategory[]
  locations: ChecklistLocation[]
  notice?: string
  onSetView: (mode: ChecklistViewMode) => void
  onChecked: (entryId: string, checked: boolean) => void
  onDetail: (entryId: string) => void
  onEditCustom: (entryId?: string) => void
  onEditConditions: () => void
  onReset: () => void
  onHelp: () => void
  onLastMinute: () => void
  onSave: () => void
  onShowSaved: () => void
}

export function ChecklistWorkspace({
  scenarioName,
  conditionLabels,
  checklist,
  viewMode,
  categories,
  locations,
  notice,
  onSetView,
  onChecked,
  onDetail,
  onEditCustom,
  onEditConditions,
  onReset,
  onHelp,
  onLastMinute,
  onSave,
  onShowSaved,
}: ChecklistWorkspaceProps) {
  const groups = groupChecklist(checklist, viewMode, categories, locations)
  const categoryAssets = new Map(categories.map((category) => [category.categoryId, category.iconAssetId]))
  const remainingCritical = getCriticalRemaining(checklist).length
  const checkedCount = checklist.entries.filter((entry) => entry.checked).length

  return (
    <main className="app-shell checklist-screen">
      <header className="checklist-summary">
        <div className="summary-copy">
          <div className="summary-topline"><span>{scenarioName}</span><span>路岚陪你复核</span></div>
          <div className="condition-chips">
            {conditionLabels.slice(0, 3).map((label) => <span key={label}>{label}</span>)}
          </div>
          <h1>必带还剩 {remainingCritical} 项</h1>
          <div className="summary-meta"><span>已完成 {checkedCount} / {checklist.entries.length}</span><button type="button" onClick={onEditConditions}>修改条件</button></div>
        </div>
        <GuidePortrait variant="summary" interactive onActivate={onHelp} />
      </header>
      {notice && <p className="notice" role="status">{notice}</p>}
      <nav className="view-tabs" aria-label="清单查看方式">
        {(Object.keys(viewLabels) as ChecklistViewMode[]).map((mode) => (
          <button
            type="button"
            className={viewMode === mode ? 'active' : ''}
            aria-pressed={viewMode === mode}
            key={mode}
            onClick={() => onSetView(mode)}
          >{viewLabels[mode]}</button>
        ))}
      </nav>
      <div className="checklist-tools">
        <button className="text-button" type="button" onClick={() => onEditCustom()}>添加自定义项</button>
        <button className="text-button" type="button" onClick={onReset}>全部重置</button>
      </div>

      {viewMode === 'location' ? (
        <LocationRouteView
          checklist={checklist}
          categories={categories}
          locations={locations}
          onChecked={onChecked}
          onDetail={onDetail}
          onEditCustom={(entryId) => onEditCustom(entryId)}
        />
      ) : groups.map((group) => (
        <section className="checklist-group" key={group.id} aria-labelledby={`group-${group.id}`}>
          <header>
            <span className="group-name">
              {group.iconAssetId && <span className="asset-tile small"><AssetIcon assetId={group.iconAssetId} /></span>}
              <h2 id={`group-${group.id}`}>{group.label}</h2>
            </span>
            <small>{group.entries.filter((entry) => entry.checked).length} / {group.entries.length}</small>
          </header>
          <ul className="entry-list">
            {group.entries.map((entry) => (
              <ChecklistRow
                key={entry.entryId}
                entry={entry}
                categoryAssetId={categoryAssets.get(entry.categoryId)}
                onChecked={onChecked}
                onDetail={onDetail}
                onEditCustom={(entryId) => onEditCustom(entryId)}
              />
            ))}
          </ul>
        </section>
      ))}

      <section className="workspace-actions" aria-label="清单操作">
        <div className="split-actions">
          <button className="secondary-button" type="button" onClick={onShowSaved}>最近清单</button>
          <button className="secondary-button" type="button" onClick={onSave}>保存</button>
        </div>
        <button className="primary-button last-minute-entry" type="button" onClick={onLastMinute}>进入最后一分钟</button>
      </section>
    </main>
  )
}
