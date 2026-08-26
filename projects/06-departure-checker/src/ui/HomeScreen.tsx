import type { SavedChecklist, Scenario } from '../content/schema'
import { AssetIcon } from './AssetIcon'
import { GuidePortrait } from './GuidePortrait'

type HomeScreenProps = {
  scenarios: Scenario[]
  recent?: SavedChecklist
  onSelectScenario: (scenarioId: string) => void
  onContinueRecent: (saved: SavedChecklist) => void
  onShowSaved: () => void
  notice?: string
}

export function HomeScreen({
  scenarios,
  recent,
  onSelectScenario,
  onContinueRecent,
  onShowSaved,
  notice,
}: HomeScreenProps) {
  const recentScenario = recent && scenarios.find((scenario) => scenario.scenarioId === recent.scenarioId)
  const recentCompleted = recent?.items.filter((item) => item.checked).length ?? 0

  return (
    <main className="app-shell home-screen">
      <header className="brand-bar">
        <strong>出门检查官</strong>
        <span className="local-badge">只在本机</span>
      </header>
      <GuidePortrait variant="home">
        <p className="eyebrow">出门前 · 一分钟检查</p>
        <strong className="home-guide-message">容易忘的，<br />我陪你查。</strong>
      </GuidePortrait>
      <section className="home-paper" aria-labelledby="home-title">
        <h1 id="home-title">今天去哪儿？</h1>
        <p className="lede">选一个最接近的场景，生成能解释原因的本地清单。</p>
        {notice && <p className="notice" role="status">{notice}</p>}

        {recent && recentScenario && (
          <button className="recent-card" type="button" onClick={() => onContinueRecent(recent)}>
            <span className="asset-tile"><AssetIcon assetId={recentScenario.iconAssetId} /></span>
            <span><strong>继续：{recent.name}</strong><small>{recentCompleted} / {recent.items.length} 已确认</small></span>
            <span aria-hidden="true">继续</span>
          </button>
        )}

        <div className="section-heading">
          <h2>选择场景</h2>
          <button className="text-button" type="button" onClick={onShowSaved}>最近清单</button>
        </div>
        <div className="scenario-grid">
          {scenarios.map((scenario) => (
            <button
              className="scenario-card"
              type="button"
              key={scenario.scenarioId}
              onClick={() => onSelectScenario(scenario.scenarioId)}
            >
              <span className="asset-tile"><AssetIcon assetId={scenario.iconAssetId} /></span>
              <span><strong>{scenario.name}</strong><small>{scenario.description}</small></span>
            </button>
          ))}
        </div>
        <p className="privacy-note">天气和行程条件由你主动选择；不会调用定位、天气服务或在线 AI。</p>
      </section>
    </main>
  )
}
