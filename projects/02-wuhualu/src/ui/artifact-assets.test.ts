import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import { filterPlayableArtifacts, getRuntimeArtifactAssets, playableArtifactIds, selectClueAsset } from './artifact-assets.ts'

describe('release artifact assets', () => {
  const artifacts = parseContent(rawContent).content.artifacts

  it('exposes exactly nine playable artifacts that exist in content', () => {
    expect(playableArtifactIds).toHaveLength(9)
    expect(new Set(playableArtifactIds).size).toBe(9)
    expect(filterPlayableArtifacts(artifacts).map(({ id }) => id).sort()).toEqual([...playableArtifactIds].sort())
  })

  it.each(playableArtifactIds)('%s has every static role and local URLs', id => {
    const assets = getRuntimeArtifactAssets(id)
    expect(assets).toBeDefined()
    expect(assets?.reveal).toMatch(/\/assets\/artifacts\//)
    expect(assets?.silhouette).toMatch(/silhouette-verified\.svg$/)
    expect(assets?.thumbnail).toMatch(/thumb\.webp$/)
    expect(assets?.clues.length).toBeGreaterThan(0)
    for (const path of [assets?.reveal, assets?.silhouette, assets?.thumbnail, ...(assets?.clues ?? [])]) {
      expect(path).not.toMatch(/^https?:/)
    }
  })

  it('clamps clue selection to available crops', () => {
    const id = 'artifact-eagle-tripod'
    expect(selectClueAsset(id, 0)).toBe(selectClueAsset(id, 1))
    expect(selectClueAsset(id, 99)).toBe(getRuntimeArtifactAssets(id)?.clues.at(-1))
  })
})
