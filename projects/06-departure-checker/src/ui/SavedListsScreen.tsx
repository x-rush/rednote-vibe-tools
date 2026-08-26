import type { SavedChecklist, Scenario } from '../content/schema'
import { AssetIcon } from './AssetIcon'
import { GUIDE_ASSETS } from './assets'

type SavedListsScreenProps = {
  savedLists: SavedChecklist[]
  scenarios: Scenario[]
  onHome: () => void
  onContinue: (saved: SavedChecklist) => void
  onCopy: (saved: SavedChecklist) => void
  onDelete: (saved: SavedChecklist) => void
  onCreate: () => void
}

export function SavedListsScreen({
  savedLists,
  scenarios,
  onHome,
  onContinue,
  onCopy,
  onDelete,
  onCreate,
}: SavedListsScreenProps) {
  return (
    <main className="app-shell saved-screen">
      <header className="page-header"><button className="back-button" type="button" onClick={onHome}>返回首页</button><p>最多保留 3 份</p></header>
      <div className="compact-guide-heading">
        <img src={GUIDE_ASSETS.avatar} alt="" />
        <div><p className="eyebrow">路岚替你记在这台设备</p><h1>最近出过的门</h1></div>
      </div>
      {savedLists.length === 0 ? <section className="empty-panel"><h2>还没有最近清单</h2><p>完成一次出门检查后，可以把结构化状态保存到本机。</p><button className="primary-button" type="button" onClick={onCreate}>选择场景</button></section> : <ul className="saved-list">{savedLists.map((saved) => {
        const scenario = scenarios.find((item) => item.scenarioId === saved.scenarioId)
        const checked = saved.items.filter((item) => item.checked).length
        return <li className="saved-card" key={saved.id}>
          <span className="asset-tile">{scenario && <AssetIcon assetId={scenario.iconAssetId} />}</span>
          <div className="saved-copy"><strong>{saved.name}</strong><small>{checked} / {saved.items.length} · {saved.updatedAt.slice(0, 10)}</small></div>
          <div className="saved-actions"><button type="button" onClick={() => onContinue(saved)}>继续</button><button type="button" onClick={() => onCopy(saved)}>复制重算</button><button className="danger" type="button" onClick={() => onDelete(saved)}>删除</button></div>
        </li>
      })}</ul>}
      {savedLists.length > 0 && <button className="primary-button page-action" type="button" onClick={onCreate}>创建新清单</button>}
    </main>
  )
}
