import type { GeneratedChecklist } from '../content/schema'
import { AssetIcon } from './AssetIcon'
import { getCriticalRemaining } from './checklistView'
import { GuidePortrait } from './GuidePortrait'

type CompletionScreenProps = {
  checklist: GeneratedChecklist
  scenarioName: string
  onChecklist: () => void
  onHome: () => void
}

export function CompletionScreen({ checklist, scenarioName, onChecklist, onHome }: CompletionScreenProps) {
  const checked = checklist.entries.filter((entry) => entry.checked).length
  const criticalComplete = getCriticalRemaining(checklist).length === 0
  return (
    <main className="app-shell completion-screen">
      <section className="completion-layout">
        <GuidePortrait variant="completion">
          <p className="eyebrow">路岚已经陪你复核完</p>
          <strong>放心出发吧。</strong>
        </GuidePortrait>
        <div className="completion-paper">
        <span className="completion-stamp"><AssetIcon assetId="icon-completion-stamp" /></span>
        <p className="eyebrow">{scenarioName} · {checked} / {checklist.entries.length}</p>
        <h1>{criticalComplete ? '关键的都带上了。' : '还有关键项没确认。'}</h1>
        <p>{criticalComplete ? '建议项仍留在完整清单，需要时可以回看。一路顺利。' : '可以返回清单继续检查，不必从头开始。'}</p>
        <button className="primary-button" type="button" onClick={onChecklist}>返回完整清单</button>
        <button className="secondary-button" type="button" onClick={onHome}>回到首页</button>
        </div>
      </section>
    </main>
  )
}
