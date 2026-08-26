import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { contentPackage } from '../content'
import { EvidenceArtifact } from './EvidenceArtifact'
import { EvidenceThumbnail } from './EvidenceThumbnail'

describe('interactive evidence components', () => {
  it.each(contentPackage.content.evidence)('renders $id without the generic placeholder', (evidence) => {
    const html = renderToStaticMarkup(
      <EvidenceArtifact
        evidence={evidence}
        sources={contentPackage.sources}
        observedIds={[]}
        onObserve={() => {}}
        reducedMotion
      />,
    )

    expect(html).toContain(`data-evidence-id="${evidence.id}"`)
    expect(html).toContain(`data-template="${evidence.visualSpec.template}"`)
    expect(html).toContain(evidence.visualSpec.thumbnailLabel)
    expect(html).not.toContain('人工核验资源位')
  })

  it('renders a complete thumbnail seal from observed progress', () => {
    const evidence = contentPackage.content.evidence[0]
    const observedIds = evidence.visualSpec.observationPoints.map((point) => point.id)
    const html = renderToStaticMarkup(<EvidenceThumbnail evidence={evidence} observedIds={observedIds} />)

    expect(html).toContain('已核')
    expect(html).toContain('2 / 2')
  })

  it('uses the evidence-specific fallback when a plate is unavailable', () => {
    const evidence = structuredClone(contentPackage.content.evidence[0])
    evidence.assetId = 'asset-evidence-unmapped'
    const html = renderToStaticMarkup(
      <EvidenceArtifact evidence={evidence} sources={contentPackage.sources} observedIds={[]} onObserve={() => {}} reducedMotion />,
    )

    expect(html).toContain('evidence-artifact-fallback')
    expect(html).toContain(evidence.visualSpec.fallbackSummary)
    expect(html).not.toContain('人工核验资源位')
  })
})
