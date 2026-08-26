import { useState } from 'react'
import type { EvidenceObservationPoint, SemanticMapVisual } from '../content/types'

export function SemanticMapArtifact({ visual, points, onObserve }: { visual: SemanticMapVisual; points: EvidenceObservationPoint[]; onObserve: (id: string) => void }) {
  const [activeId, setActiveId] = useState(visual.nodes[0]?.id)
  const activeNode = visual.nodes.find((node) => node.id === activeId)
  const activeEdge = visual.edges.find((edge) => edge.id === activeId)
  return <div className="semantic-map-artifact">
    <div className="semantic-nodes" aria-label="语义节点">{visual.nodes.map((node, index) => <button key={node.id} type="button" aria-pressed={node.id === activeId} onClick={() => { setActiveId(node.id); const point = points[Math.min(index, points.length - 1)]; if (point) onObserve(point.id) }}>{node.label}</button>)}</div>
    <div className="semantic-edges" aria-label="证据关系">{visual.edges.map((edge, index) => <button key={edge.id} type="button" className={`strength-${edge.strength}`} aria-pressed={edge.id === activeId} onClick={() => { setActiveId(edge.id); const point = points[Math.min(index, points.length - 1)]; if (point) onObserve(point.id) }}><i aria-hidden="true">{edge.strength === 'blocked' ? '×' : '→'}</i>{edge.label}</button>)}</div>
    <article className="artifact-reading"><span>{activeEdge ? (activeEdge.strength === 'blocked' ? '不可直接跨越' : '关系证据') : '语义节点'}</span><h3>{activeNode?.label ?? activeEdge?.label}</h3><p>{activeNode?.detail ?? activeEdge?.label}</p></article>
  </div>
}
