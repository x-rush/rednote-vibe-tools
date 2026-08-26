import { useLayoutEffect } from 'react'
import type { GeneratedChecklist } from '../content/schema'
import { getCriticalRemaining } from './checklistView'
import { GuidePortrait } from './GuidePortrait'
import { resetPageScroll } from './viewport'

type LastMinuteModeProps = {
  checklist: GeneratedChecklist
  onChecked: (entryId: string, checked: boolean) => void
  onExit: () => void
  onComplete: () => void
}

export function LastMinuteMode({ checklist, onChecked, onExit, onComplete }: LastMinuteModeProps) {
  const remaining = getCriticalRemaining(checklist)
  const current = remaining[0]

  useLayoutEffect(() => {
    resetPageScroll(window)
  }, [])

  return (
    <main className="last-minute-screen">
      <header><strong>最后一分钟</strong><button type="button" onClick={onExit}>退出此模式</button></header>
      <section aria-labelledby="last-minute-title">
        <GuidePortrait variant="urgent">
          <p className="eyebrow">没有倒计时</p>
          <h1 id="last-minute-title">{current ? '只看还没完成的关键项' : '关键项已经完成'}</h1>
          <small>慢一点，也来得及。</small>
        </GuidePortrait>
        <p>{current ? `第 1 项 · 还剩 ${remaining.length} 项` : '建议项仍保留在完整清单中。'}</p>
        {remaining.map((entry, index) => (
          <label className={`urgent-row ${index === 0 ? 'current' : ''}`} key={entry.entryId}>
            <input type="checkbox" checked={entry.checked} onChange={(event) => onChecked(entry.entryId, event.target.checked)} />
            <span><strong>{entry.label}</strong><small>{entry.hint}</small></span>
          </label>
        ))}
      </section>
      <footer>
        {current ? <button className="urgent-action" type="button" onClick={() => onChecked(current.entryId, true)}>完成这一项 · 下一项</button> : <button className="urgent-action" type="button" onClick={onComplete}>查看完成结果</button>}
      </footer>
    </main>
  )
}
