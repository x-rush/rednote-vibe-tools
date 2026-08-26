import { useState, type CSSProperties } from 'react'
import type { Evidence, EvidenceUiCopy, SourceRecord } from '../content/types'
import { createEvidenceArtifactModel, getEvidenceResourceNature } from './model'
import { resolveEvidenceGlyphAsset } from './assets'
import { GlyphTimelineArtifact } from './GlyphTimelineArtifact'
import { EvidencePlateImage } from './EvidencePlateImage'
import { LexiconScrollArtifact } from './LexiconScrollArtifact'
import { MythVerdictArtifact } from './MythVerdictArtifact'
import { SemanticMapArtifact } from './SemanticMapArtifact'
import './evidence.css'

export type EvidenceArtifactProps = {
  evidence: Evidence
  sources: SourceRecord[]
  observedIds: string[]
  onObserve: (observationId: string) => void
  reducedMotion: boolean
  uiCopy: EvidenceUiCopy
}

export function EvidenceArtifact({ evidence, sources, observedIds, onObserve, reducedMotion, uiCopy }: EvidenceArtifactProps) {
  const model = createEvidenceArtifactModel(evidence, observedIds, sources)
  const template = model.visualSpec
  const glyphStages = template.template === 'glyph-timeline'
    ? template.stages.flatMap((stage) => {
        const path = stage.glyphAssetId ? resolveEvidenceGlyphAsset(stage.glyphAssetId) : undefined
        return path ? [{ path, stage }] : []
      })
    : []
  const glyphName = model.thumbnailLabel.split('·')[0]
  const [activeObservationId, setActiveObservationId] = useState<string | undefined>(undefined)
  const activeObservation = model.observationPoints.find((point) => point.id === activeObservationId)
  const observe = (observationId: string) => {
    setActiveObservationId(observationId)
    onObserve(observationId)
  }
  return <section className={`evidence-artifact palette-${model.palette} ${reducedMotion ? 'is-reduced-motion' : ''}`} data-evidence-id={evidence.id} data-template={model.template}>
    <header className="evidence-artifact-heading"><div><span>{evidence.type}证物 · CASE EVIDENCE</span><h2>{model.thumbnailLabel}</h2></div><strong className={model.progress.complete ? 'is-complete' : ''}>{model.progress.complete ? '已核' : `${model.progress.observed} / ${model.progress.total}`}</strong></header>
    <div className="evidence-plate">
      <EvidencePlateImage primarySrc={model.assetPath} fallbackSrc={model.fallbackAssetPath} fallbackAlt={model.fallbackSummary} />
      {glyphStages.length > 0 && <div className="glyph-facsimile-layer">{glyphStages.map(({ path, stage }) => <figure key={stage.id}><img src={path} alt={`${glyphName}字${stage.period}字形摹本`} decoding="async" /><figcaption>{stage.period}</figcaption></figure>)}</div>}
      <div className="evidence-hotspots" aria-label="证物观察点">{model.observationPoints.map((point, index) => <button key={point.id} type="button" data-observation-id={point.id} className={model.observedIds.includes(point.id) ? 'is-observed' : ''} style={{ '--point-x': `${point.anchor.x}%`, '--point-y': `${point.anchor.y}%` } as CSSProperties} aria-label={`观察：${point.title}`} onClick={() => observe(point.id)}><i aria-hidden="true">{model.observedIds.includes(point.id) ? '✓' : index + 1}</i><span>{point.title}</span></button>)}</div>
    </div>
    <div className="evidence-template-body">
      {template.template === 'glyph-timeline' && <GlyphTimelineArtifact visual={template} points={model.observationPoints} onObserve={observe} />}
      {template.template === 'lexicon-scroll' && <LexiconScrollArtifact visual={template} points={model.observationPoints} onObserve={observe} />}
      {template.template === 'semantic-map' && <SemanticMapArtifact visual={template} points={model.observationPoints} onObserve={observe} />}
      {template.template === 'myth-verdict' && <MythVerdictArtifact visual={template} points={model.observationPoints} onObserve={observe} />}
    </div>
    {activeObservation && <aside className="evidence-observation-detail" role="status"><span>观察记录 · {activeObservation.title}</span><p>{activeObservation.body}</p><small>此观察点引用 {activeObservation.sourceIds.length} 项非虚构来源；可证范围以来源说明为准。</small></aside>}
    <footer className="evidence-artifact-footer"><div><b>{getEvidenceResourceNature(template, uiCopy)}</b><p>{model.progress.complete ? model.completionPrompt : model.fallbackSummary}</p></div><span>{model.sources.length} 项可追溯来源</span></footer>
  </section>
}
