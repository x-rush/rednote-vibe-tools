import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { contentPackage } from '../content'
import { EvidenceArtifact } from './EvidenceArtifact'
import { EvidenceThumbnail } from './EvidenceThumbnail'
import { getMythObservationIdForReveal } from './model'

describe('interactive evidence components', () => {
  it.each(contentPackage.content.evidence)('renders $id without the generic placeholder', (evidence) => {
    const expectedVolumeLabel = contentPackage.meta.evidenceUi.resourceNatureLabels[evidence.visualSpec.template]
    const html = renderToStaticMarkup(
      <EvidenceArtifact
        evidence={evidence}
        sources={contentPackage.sources}
        observedIds={[]}
        onObserve={() => {}}
        reducedMotion
        uiCopy={contentPackage.meta.evidenceUi}
      />,
    )

    expect(html).toContain(`data-evidence-id="${evidence.id}"`)
    expect(html).toContain(`data-template="${evidence.visualSpec.template}"`)
    expect(html).toContain(evidence.visualSpec.thumbnailLabel)
    expect(html).not.toContain('人工核验资源位')
    expect(html).not.toContain('产品结构图')
    expect(html).not.toContain('产品释文')
    expect(html).not.toContain('ORIGINAL MATERIAL')
    expect(html).not.toContain('产品重构')
    expect(html).toContain(expectedVolumeLabel)
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
      <EvidenceArtifact evidence={evidence} sources={contentPackage.sources} observedIds={[]} onObserve={() => {}} reducedMotion uiCopy={contentPackage.meta.evidenceUi} />,
    )

    expect(html).toContain('evidence-artifact-fallback')
    expect(html).toContain(evidence.visualSpec.fallbackSummary)
    expect(html).not.toContain('人工核验资源位')
  })

  it('uses the complete AI plate without a duplicate glyph overlay', () => {
    const evidence = contentPackage.content.evidence.find((item) => item.id === 'evidence-home-early-form')
    if (!evidence) throw new Error('home early-form fixture missing')
    const html = renderToStaticMarkup(
      <EvidenceArtifact evidence={evidence} sources={contentPackage.sources} observedIds={[]} onObserve={() => {}} reducedMotion uiCopy={contentPackage.meta.evidenceUi} />,
    )

    expect(html).toContain('asset-evidence-home-early-form-v3.webp')
    expect(html).not.toContain('glyph-facsimile-layer')
  })

  it.each(contentPackage.content.evidence.filter((item) => item.visualSpec.template === 'myth-verdict'))(
    'only completes $id after the dispute boundary is revealed',
    (evidence) => {
      const visual = evidence.visualSpec
      if (visual.template !== 'myth-verdict') throw new Error('myth fixture missing')
      expect(getMythObservationIdForReveal(visual, 1)).toBe(visual.observationPoints[0].id)
      expect(getMythObservationIdForReveal(visual, 2)).toBeUndefined()
      expect(getMythObservationIdForReveal(visual, 3)).toBe(visual.observationPoints[1].id)
    },
  )
})
