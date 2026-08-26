import { useState } from 'react'
import type { EvidenceObservationPoint, MythVerdictVisual } from '../content/types'
import { getMythObservationIdForReveal } from './model'

export function MythVerdictArtifact({ visual, onObserve }: { visual: MythVerdictVisual; points: EvidenceObservationPoint[]; onObserve: (id: string) => void }) {
  const [reveal, setReveal] = useState(0)
  const revealNext = () => {
    const next = Math.min(3, reveal + 1)
    setReveal(next)
    const observationId = getMythObservationIdForReveal(visual, next as 1 | 2 | 3)
    if (observationId) onObserve(observationId)
  }
  return <div className="myth-verdict-artifact">
    <blockquote><span>坊间传闻</span>{visual.claim}</blockquote>
    {reveal >= 1 && <section className="verdict-layer is-supported"><b>材料能证</b>{visual.supports.map((item) => <p key={item}>{item}</p>)}</section>}
    {reveal >= 2 && <section className="verdict-layer is-limited"><b>材料不能证</b>{visual.limits.map((item) => <p key={item}>{item}</p>)}</section>}
    {reveal >= 3 && <section className="verdict-layer is-disputed"><b>仍须保留</b>{visual.disputes.map((item) => <p key={item}>{item}</p>)}</section>}
    {reveal < 3 && <button type="button" className="reveal-evidence" data-observation-id={reveal === 0 ? visual.supportObservationId : reveal === 1 ? visual.limitObservationId : visual.disputeObservationId} onClick={revealNext}>{reveal === 0 ? '揭开材料层' : reveal === 1 ? '查证越界处' : '查看争议范围'}</button>}
  </div>
}
