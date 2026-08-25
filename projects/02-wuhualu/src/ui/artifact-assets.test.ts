import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import assetManifest from '../../public/assets/asset-manifest.json'
import { isCompleteArtifact } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { filterPlayableArtifacts, findIncompletePlayableArtifactIds, getRuntimeArtifactAssets, playableArtifactIds, selectClueAsset } from './artifact-assets.ts'

describe('release artifact assets', () => {
  const artifacts = parseContent(rawContent).content.artifacts

  it('exposes exactly ten playable artifacts that exist in content', () => {
    expect(playableArtifactIds).toHaveLength(10)
    expect(new Set(playableArtifactIds).size).toBe(10)
    expect(filterPlayableArtifacts(artifacts).map(({ id }) => id).sort()).toEqual([...playableArtifactIds].sort())
    expect([...assetManifest.releaseGate.playableStaticArtifactIds].sort()).toEqual([...playableArtifactIds].sort())
    expect(assetManifest.releaseGate.referenceRequiredArtifactIds).not.toContain('artifact-zenghouyi-bells')
    expect(getRuntimeArtifactAssets('artifact-zenghouyi-bells')?.observation).toContain('reveal-wide-creative-reconstruction-v1.webp')
  })

  it('keeps all locally illustrated artifacts complete and playable', () => {
    const completeIds = artifacts.filter(isCompleteArtifact).map(({ id }) => id).sort()
    expect(completeIds).toEqual([...playableArtifactIds].sort())
  })

  it('uses the full portrait reveal as the observation canvas except for the wide bells composition', () => {
    for (const id of playableArtifactIds.filter(id => id !== 'artifact-zenghouyi-bells')) {
      const assets = getRuntimeArtifactAssets(id)
      expect(assets?.observation, id).toBe(assets?.reveal)
      expect([assets?.observationWidth, assets?.observationHeight], id).toEqual([900, 1125])
    }
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
    }
  })

  it('clamps clue selection to available crops', () => {
    const id = 'artifact-eagle-tripod'
    expect(selectClueAsset(id, 0)).toBe(selectClueAsset(id, 1))
    expect(selectClueAsset(id, 99)).toBe(getRuntimeArtifactAssets(id)?.clues.at(-1))
  })
})
