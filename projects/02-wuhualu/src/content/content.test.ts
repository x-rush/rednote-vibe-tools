import { describe, expect, it } from 'vitest'
import content from './content.json'
import { validateContent } from './validate.ts'

describe('production content package', () => {
  it('contains exactly 20 uniquely identified artifacts', () => {
    expect(content.content.artifacts).toHaveLength(20)
    expect(new Set(content.content.artifacts.map(({ id }) => id)).size).toBe(20)
  })

  it('passes runtime production validation', () => {
    expect(validateContent(content).issues).toEqual([])
  })

  it('gives every artifact three ordered text clues and planned fallback assets', () => {
    for (const artifact of content.content.artifacts) {
      expect(artifact.clues.map(({ level }) => level)).toEqual([1, 2, 3])
      expect(artifact.clues.every(({ text }) => text.trim().length > 0)).toBe(true)
      expect(artifact.assetRefs.fallbackAssetId).toMatch(/^asset-[a-z0-9-]+$/)
      expect(artifact.unlockCopy.trim().length).toBeGreaterThan(0)
    }
  })

  it('reports invalid references and unsafe asset IDs with JSON paths', () => {
    const invalid = structuredClone(content)
    invalid.content.artifacts[0].sourceIds = ['source-missing']
    invalid.content.artifacts[0].assetRefs.fullAssetId = 'https://example.com/item.jpg'
    invalid.content.assetManifest.pathPattern = '/absolute/assets/item.webp'
    Object.assign(invalid, { unexpectedRoot: true })

    const paths = validateContent(invalid).issues.map(({ path }) => path)
    expect(paths).toContain('$.content.artifacts[0].sourceIds[0]')
    expect(paths).toContain('$.content.artifacts[0].assetRefs.fullAssetId')
    expect(paths).toContain('$.content.assetManifest.pathPattern')
    expect(paths).toContain('$.unexpectedRoot')
  })

  it('keeps all semantic page copy in the content package', () => {
    const required = [
      'backAction', 'exitAction', 'collectionAction', 'retryAction', 'replayAction',
      'closeAction', 'factsTitle', 'cluesTitle', 'optionsTitle', 'placeholderText',
      'lockedText', 'scoreLabel', 'bestScoreLabel', 'progressLabel', 'sourceStatusTitle',
      'storageCorruptMessage', 'storageVersionMessage', 'storageInvalidMessage', 'contentMissingMessage',
      'verifiedLabel', 'pendingLabel', 'collectorPerfect', 'collectorHigh', 'collectorMid', 'collectorLow',
    ] as const
    for (const key of required) expect(content.content.copy[key].trim().length, key).toBeGreaterThan(0)
  })
})
