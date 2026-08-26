import { useState } from 'react'
import type { EvidenceObservationPoint, GlyphTimelineVisual } from '../content/types'

export function GlyphTimelineArtifact({ visual, points, onObserve }: { visual: GlyphTimelineVisual; points: EvidenceObservationPoint[]; onObserve: (id: string) => void }) {
  const [activeId, setActiveId] = useState(visual.stages[0]?.id)
  const activeIndex = Math.max(0, visual.stages.findIndex((stage) => stage.id === activeId))
  const active = visual.stages[activeIndex]
  return <div className="glyph-timeline-artifact">
    <nav aria-label="字形材料阶段">{visual.stages.map((stage, index) => <button key={stage.id} type="button" aria-pressed={stage.id === activeId} onClick={() => { setActiveId(stage.id); const point = points[Math.min(index, points.length - 1)]; if (point) onObserve(point.id) }}><i aria-hidden="true" /><span>{stage.period}</span><b>{stage.label}</b></button>)}</nav>
    {active && <article className="artifact-reading"><span>{active.materialKind === 'structure-diagram' ? '产品结构图' : active.materialKind}</span><h3>{active.label}</h3><p>{active.certainty}</p></article>}
  </div>
}
