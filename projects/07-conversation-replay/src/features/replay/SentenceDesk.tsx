import { useState } from 'react'
import { AssetIcon } from '../../components/AssetIcon'
import type { ScreenOptionV2 } from '../../app/viewV2'

export function SentenceDesk({
  fact,
  inferences,
  selected,
  onChange,
}: {
  fact?: string
  inferences: ScreenOptionV2[]
  selected: string[]
  onChange(ids: string[]): void
}) {
  const [announcement, setAnnouncement] = useState('')
  const move = (option: ScreenOptionV2) => {
    const next = selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [option.id]
    onChange(next)
    setAnnouncement(next.includes(option.id) ? `已移到推测：${option.label}` : `已撤回推测：${option.label}`)
  }
  return (
    <div className="sentence-desk">
      <section className="desk-column" aria-labelledby="fact-column-title">
        <h2 id="fact-column-title"><AssetIcon name="fact" />事实</h2>
        {fact ? <div className="semantic-slip fact-slip">{fact}</div> : <p className="empty-note">返回上一步选择事实。</p>}
      </section>
      <div className="desk-arrow" aria-hidden="true">→</div>
      <section className="desk-column inference-column" aria-labelledby="inference-column-title">
        <h2 id="inference-column-title"><AssetIcon name="inference" />推测</h2>
        {inferences.map((option) => (
          <article className={`semantic-slip inference-slip${selected.includes(option.id) ? ' is-moved' : ''}`} key={option.id}>
            <p>{option.label}</p>
            <button type="button" onClick={() => move(option)}>{selected.includes(option.id) ? '撤回' : '移到推测'}</button>
          </article>
        ))}
      </section>
      <p className="margin-note" data-anchor><b>移动不是否定感受</b><br />它只是把无法直接观察的动机判断留到核对环节。</p>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  )
}
