import type { Evidence } from '../content/types'
import { createEvidenceArtifactModel } from './model'
import { EvidencePlateImage } from './EvidencePlateImage'

export function EvidenceThumbnail({ evidence, observedIds }: { evidence: Evidence; observedIds: string[] }) {
  const model = createEvidenceArtifactModel(evidence, observedIds, [])
  return <span className={`evidence-thumbnail palette-${model.palette}`} data-evidence-thumbnail={evidence.id}>
    {model.assetPath || model.fallbackAssetPath
      ? <EvidencePlateImage primarySrc={model.assetPath} fallbackSrc={model.fallbackAssetPath} fallbackAlt={model.fallbackSummary} />
      : <i aria-hidden="true">{evidence.type}</i>}
    <span className="evidence-thumbnail-shade" aria-hidden="true" />
    <span className="evidence-thumbnail-copy">
      <small>{evidence.type}证物</small>
      <b>{model.thumbnailLabel}</b>
      <em className={model.progress.complete ? 'is-complete' : ''}>
        {model.progress.complete ? '已核' : '待核'}
        <small>{model.progress.observed} / {model.progress.total}</small>
      </em>
    </span>
  </span>
}
