import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import rawContent from '../content/content.json'
import assetManifest from '../../public/assets/asset-manifest.json'
import { isCompleteArtifact } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { filterPlayableArtifacts, findIncompletePlayableArtifactIds, getRuntimeArtifactAssets, playableArtifactIds, selectClueAsset } from './artifact-assets.ts'
import { resolveGuideAsset } from './guide-assets.ts'

function readWebpDimensions(bytes: Buffer): [number, number] {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')
  const chunk = bytes.toString('ascii', 12, 16)
  if (chunk === 'VP8X') return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1]
  if (chunk === 'VP8 ') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff]
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21)
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
  }
  throw new Error(`unsupported WebP chunk ${chunk}`)
}

describe('release artifact assets', () => {
  const artifacts = parseContent(rawContent).content.artifacts

  it('exposes exactly twenty playable artifacts that exist in content', () => {
    expect(playableArtifactIds).toHaveLength(20)
    expect(new Set(playableArtifactIds).size).toBe(20)
    expect(filterPlayableArtifacts(artifacts).map(({ id }) => id).sort()).toEqual([...playableArtifactIds].sort())
    expect([...assetManifest.releaseGate.playableStaticArtifactIds].sort()).toEqual([...playableArtifactIds].sort())
    expect(assetManifest.releaseGate.referenceRequiredArtifactIds).toEqual([])
    expect(assetManifest.releaseGate.referenceRequiredArtifactIds).not.toContain('artifact-zenghouyi-bells')
    expect(getRuntimeArtifactAssets('artifact-zenghouyi-bells')?.observation).toContain('reveal-wide-creative-reconstruction-v1.webp')
    for (const id of [
      'artifact-goujian-sword',
      'artifact-bronze-rhino-zun',
      'artifact-changxin-lamp',
      'artifact-liusheng-jade-suit',
      'artifact-boshan-incense-burner',
      'artifact-storyteller-drummer',
      'artifact-wuzetian-gold-slip',
      'artifact-dancing-horse-flask',
      'artifact-grape-bird-sachet',
      'artifact-tricolor-music-camel',
    ]) expect(playableArtifactIds).toContain(id)
  })

  it('keeps all locally illustrated artifacts complete and playable', () => {
    const completeIds = artifacts.filter(isCompleteArtifact).map(({ id }) => id).sort()
    expect(completeIds).toEqual([...playableArtifactIds].sort())
  })

  it('uses the full portrait reveal as the observation canvas except for the wide bells composition', () => {
    for (const id of playableArtifactIds.filter(id => !['artifact-zenghouyi-bells', 'artifact-goujian-sword'].includes(id))) {
      const assets = getRuntimeArtifactAssets(id)
      expect(assets?.observation, id).toBe(assets?.reveal)
      expect([assets?.observationWidth, assets?.observationHeight], id).toEqual([900, 1125])
    }
    const sword = getRuntimeArtifactAssets('artifact-goujian-sword')
    expect(sword?.observation).toBe(sword?.reveal)
    expect([sword?.observationWidth, sword?.observationHeight]).toEqual([1080, 1350])
  })

  it('reports a locally illustrated artifact whose complete experience is missing', () => {
    const incomplete = structuredClone(artifacts)
    const target = incomplete.find(({ id }) => id === playableArtifactIds[0])
    if (!target) throw new Error('missing playable fixture')
    delete target.experienceV2
    expect(findIncompletePlayableArtifactIds(incomplete)).toEqual([target.id])
  })

  it.each(playableArtifactIds)('%s has every static role and local URLs', id => {
    const assets = getRuntimeArtifactAssets(id)
    expect(assets).toBeDefined()
    expect(assets?.reveal).toMatch(/\/assets\/artifacts\//)
    expect(assets?.silhouette).toMatch(/silhouette-verified\.svg$/)
    expect(assets?.thumbnail).toMatch(/thumb\.webp$/)
    expect(assets?.clues.length).toBeGreaterThan(0)
    for (const path of [assets?.observation, assets?.reveal, assets?.silhouette, assets?.thumbnail, ...(assets?.clues ?? [])]) {
      expect(path).not.toMatch(/^https?:/)
      const relativePath = path?.replace(/^.*\/assets\//, '')
      expect(relativePath, `${id} exposes an unresolved asset URL`).toBeTruthy()
      expect(existsSync(fileURLToPath(new URL(`../../public/assets/${relativePath}`, import.meta.url))), `${id}: ${relativePath}`).toBe(true)
    }
  })

  it('clamps clue selection to available crops', () => {
    const id = 'artifact-eagle-tripod'
    expect(selectClueAsset(id, 0)).toBe(selectClueAsset(id, 1))
    expect(selectClueAsset(id, 99)).toBe(getRuntimeArtifactAssets(id)?.clues.at(-1))
  })

  it('keeps the silver sachet mechanics SVG free of business copy', () => {
    const diagram = fileURLToPath(new URL('../../public/assets/artifacts/artifact-grape-bird-sachet/diagram-gimbal.svg', import.meta.url))
    expect(readFileSync(diagram, 'utf8')).not.toMatch(/<(?:text|title|desc)\b/)
  })

  it('ships both local 900 by 1200 Xu Zhao narrative portraits', () => {
    const expected = [
      ['asset-guide-xuzhao-journal', 'guide-xuzhao-journal'],
      ['asset-guide-xuzhao-finale', 'guide-xuzhao-finale'],
    ] as const

    for (const [assetId, manifestId] of expected) {
      const relativePath = resolveGuideAsset(assetId).replace(/^.*\/assets\//, '')
      const path = fileURLToPath(new URL(`../../public/assets/${relativePath}`, import.meta.url))
      expect(existsSync(path), assetId).toBe(true)
      expect(readWebpDimensions(readFileSync(path)), assetId).toEqual([900, 1200])
      expect(assetManifest.guide.find(({ id }) => id === manifestId), manifestId).toMatchObject({ width: 900, height: 1200 })
    }
  })
})
