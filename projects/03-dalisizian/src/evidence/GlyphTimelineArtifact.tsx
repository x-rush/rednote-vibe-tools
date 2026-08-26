import { useState } from 'react'
import type { EvidenceObservationPoint, GlyphTimelineVisual } from '../content/types'

const materialLabels: Record<GlyphTimelineVisual['stages'][number]['materialKind'], string> = {
  'structure-diagram': '构件勘校',
  'database-rendering': '公版字形摹本',
  rubbing: '旧拓摹本',
  'manual-tracing': '人工摹写',
}

export function GlyphTimelineArtifact({ visual, onObserve }: { visual: GlyphTimelineVisual; points: EvidenceObservationPoint[]; onObserve: (id: string) => void }) {
  const [activeId, setActiveId] = useState(visual.stages[0]?.id)
  const activeIndex = Math.max(0, visual.stages.findIndex((stage) => stage.id === activeId))
  const active = visual.stages[activeIndex]
  return <div className="glyph-timeline-artifact">
    <nav aria-label="字形材料阶段">{visual.stages.map((stage) => <button key={stage.id} type="button" data-observation-id={stage.observationId} aria-pressed={stage.id === activeId} onClick={() => { setActiveId(stage.id); onObserve(stage.observationId) }}><i aria-hidden="true" /><span>{stage.period}</span><b>{stage.label}</b></button>)}</nav>
    {active && <article className="artifact-reading"><span>{materialLabels[active.materialKind]}</span><h3>{active.label}</h3><p>{active.certainty}</p></article>}
  </div>
}
