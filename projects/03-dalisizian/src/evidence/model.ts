import type { Evidence, EvidenceObservationPoint, EvidenceVisualSpec, MythVerdictVisual, SourceRecord } from '../content/types'
import { resolveEvidenceAsset } from './assets'

const evidenceResourceNatureByTemplate: Record<EvidenceVisualSpec['template'], string> = {
  'glyph-timeline': '产品重构 · 构件结构示意图',
  'lexicon-scroll': '产品重构 · 字书材料排版',
  'semantic-map': '产品重构 · 语义关系图',
  'myth-verdict': '产品重构 · 证据边界对照图',
}

export function getEvidenceResourceNature(visual: EvidenceVisualSpec): string {
  return evidenceResourceNatureByTemplate[visual.template]
}

export function getMythObservationIdForReveal(visual: MythVerdictVisual, reveal: 1 | 2 | 3): string | undefined {
  return reveal === 1 ? visual.supportObservationId : reveal === 2 ? visual.limitObservationId : visual.disputeObservationId
}

export type EvidenceProgress = {
  observed: number
  total: number
  complete: boolean
}

export type EvidenceArtifactModel = {
  evidenceId: string
  title: string
  type: Evidence['type']
  template: EvidenceVisualSpec['template']
  palette: EvidenceVisualSpec['palette']
  thumbnailLabel: string
  completionPrompt: string
  fallbackSummary: string
  assetPath?: string
  visualSpec: EvidenceVisualSpec
  observationPoints: EvidenceObservationPoint[]
  observedIds: string[]
  progress: EvidenceProgress
  sources: SourceRecord[]
}

function getObservedIds(evidence: Evidence, observedIds: string[]): string[] {
  const observed = new Set(observedIds)
  return evidence.visualSpec.observationPoints.map((point) => point.id).filter((id) => observed.has(id))
}

export function getEvidenceProgress(evidence: Evidence, observedIds: string[]): EvidenceProgress {
  const observed = getObservedIds(evidence, observedIds).length
  const total = evidence.visualSpec.observationPoints.length
  return { observed, total, complete: total > 0 && observed === total }
}

export function createEvidenceArtifactModel(
  evidence: Evidence,
  observedIds: string[],
  sourceRecords: SourceRecord[],
): EvidenceArtifactModel {
  const validObservedIds = getObservedIds(evidence, observedIds)
  const sourceIds = new Set(evidence.sourceIds)
  return {
    evidenceId: evidence.id,
    title: evidence.title,
    type: evidence.type,
    template: evidence.visualSpec.template,
    palette: evidence.visualSpec.palette,
    thumbnailLabel: evidence.visualSpec.thumbnailLabel,
    completionPrompt: evidence.visualSpec.completionPrompt,
    fallbackSummary: evidence.visualSpec.fallbackSummary,
    assetPath: resolveEvidenceAsset(evidence.assetId),
    visualSpec: evidence.visualSpec,
    observationPoints: evidence.visualSpec.observationPoints,
    observedIds: validObservedIds,
    progress: getEvidenceProgress(evidence, validObservedIds),
    sources: sourceRecords.filter((source) => sourceIds.has(source.id) && source.type !== 'F'),
  }
}
