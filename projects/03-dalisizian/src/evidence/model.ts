import type { Evidence, EvidenceObservationPoint, EvidenceUiCopy, EvidenceVisualSpec, MythVerdictVisual, SourceRecord } from '../content/types'
import { resolveEvidenceAssetSet } from './assets'

export function getEvidenceResourceNature(visual: EvidenceVisualSpec, uiCopy: EvidenceUiCopy): string {
  return uiCopy.resourceNatureLabels[visual.template]
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
  fallbackAssetPath?: string
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
  const assetSet = resolveEvidenceAssetSet(evidence.assetId)
  return {
    evidenceId: evidence.id,
    title: evidence.title,
    type: evidence.type,
    template: evidence.visualSpec.template,
    palette: evidence.visualSpec.palette,
    thumbnailLabel: evidence.visualSpec.thumbnailLabel,
    completionPrompt: evidence.visualSpec.completionPrompt,
    fallbackSummary: evidence.visualSpec.fallbackSummary,
    assetPath: assetSet?.primary,
    fallbackAssetPath: assetSet?.fallback,
    visualSpec: evidence.visualSpec,
    observationPoints: evidence.visualSpec.observationPoints,
    observedIds: validObservedIds,
    progress: getEvidenceProgress(evidence, validObservedIds),
    sources: sourceRecords.filter((source) => sourceIds.has(source.id) && source.type !== 'F'),
  }
}
