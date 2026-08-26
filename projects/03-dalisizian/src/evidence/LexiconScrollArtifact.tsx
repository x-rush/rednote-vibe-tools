import { useState } from 'react'
import type { EvidenceObservationPoint, LexiconScrollVisual } from '../content/types'

export function LexiconScrollArtifact({ visual, points, onObserve }: { visual: LexiconScrollVisual; points: EvidenceObservationPoint[]; onObserve: (id: string) => void }) {
  const [activeId, setActiveId] = useState(visual.entries[0]?.id)
  return <div className="lexicon-scroll-artifact">
    <div className="lexicon-tabs" role="tablist" aria-label="字书条目">{visual.entries.map((entry, index) => <button key={entry.id} type="button" role="tab" aria-selected={entry.id === activeId} onClick={() => { setActiveId(entry.id); const point = points[Math.min(index, points.length - 1)]; if (point) onObserve(point.id) }}>{entry.heading}</button>)}</div>
    {visual.entries.map((entry) => entry.id === activeId && <article key={entry.id} className="artifact-reading lexicon-entry"><span>材料记录</span><p>{entry.originalText}</p><mark>{entry.highlight}</mark><span>案卷释文</span><p>{entry.interpretation}</p></article>)}
  </div>
}
