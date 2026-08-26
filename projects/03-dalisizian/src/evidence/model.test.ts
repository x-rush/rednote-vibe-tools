import { describe, expect, it } from 'vitest'
import { contentPackage } from '../content'
import { createEvidenceArtifactModel, getEvidenceProgress, getEvidenceResourceNature } from './model'

describe('evidence artifact model', () => {
  it.each(['glyph-timeline', 'lexicon-scroll', 'semantic-map', 'myth-verdict'] as const)(
    'creates a traceable %s model with literal zero progress',
    (template) => {
      const evidence = contentPackage.content.evidence.find((item) => item.visualSpec.template === template)
      if (!evidence) throw new Error(`missing ${template} fixture`)

      const model = createEvidenceArtifactModel(evidence, [], contentPackage.sources)

      expect(model.template).toBe(template)
      expect(model.assetPath).toMatch(/^\.\/assets\/evidence\//)
      expect(model.fallbackAssetPath).toMatch(/^\.\/assets\/evidence\//)
      expect(model.progress).toEqual({ observed: 0, total: 2, complete: false })
      expect(model.sources.every((source) => source.type !== 'F')).toBe(true)
    },
  )

  it('orders and deduplicates observed points according to authored evidence order', () => {
    const evidence = contentPackage.content.evidence.find((item) => item.id === 'evidence-home-early-form')
    if (!evidence) throw new Error('home evidence fixture missing')

    expect(getEvidenceProgress(evidence, ['home-early-form-focus-b', 'bad-id', 'home-early-form-focus-a', 'home-early-form-focus-b'])).toEqual({
      observed: 2,
      total: 2,
      complete: true,
    })
  })

  it.each([
    ['glyph-timeline', '字形演变卷'],
    ['lexicon-scroll', '字书抄录卷'],
    ['semantic-map', '义项勘校卷'],
    ['myth-verdict', '传言核验卷'],
  ] as const)('reads the %s player label from validated content', (template, label) => {
    const evidence = contentPackage.content.evidence.find((item) => item.visualSpec.template === template)
    if (!evidence) throw new Error(`missing ${template} fixture`)

    expect(getEvidenceResourceNature(evidence.visualSpec, contentPackage.meta.evidenceUi)).toBe(label)
  })

  it('keeps a semantic fallback when the visual plate mapping is unavailable', () => {
    const evidence = structuredClone(contentPackage.content.evidence[0])
    evidence.assetId = 'asset-evidence-unmapped'

    const model = createEvidenceArtifactModel(evidence, [], contentPackage.sources)

    expect(model.assetPath).toBeUndefined()
    expect(model.fallbackAssetPath).toBeUndefined()
    expect(model.fallbackSummary).toContain('图形不可用时')
  })
})
