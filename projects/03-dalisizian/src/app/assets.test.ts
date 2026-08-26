import { describe, expect, it } from 'vitest'
import { resolveCharacterAsset, resolveSceneAsset } from './assets'

describe('art asset resolver', () => {
  it('maps the three home-case scene asset IDs to approved project files', () => {
    expect(resolveSceneAsset('asset-scene-home-court')).toBe('/assets/scenes/home-court/home-court-v1.webp')
    expect(resolveSceneAsset('asset-scene-home-archive')).toBe('/assets/scenes/official-records-room/records-room-v2.webp')
    expect(resolveSceneAsset('asset-scene-home-street')).toBe('/assets/scenes/home-street/home-street-v1.webp')
  })

  it('reuses each approved environment baseline for later cases of the same scene type', () => {
    expect(resolveSceneAsset('asset-scene-rest-court')).toBe('/assets/scenes/home-court/home-court-v1.webp')
    expect(resolveSceneAsset('asset-scene-law-archive')).toBe('/assets/scenes/official-records-room/records-room-v2.webp')
    expect(resolveSceneAsset('asset-scene-autumn-street')).toBe('/assets/scenes/home-street/home-street-v1.webp')
  })

  it('maps approved characters and leaves unproduced witnesses to the semantic fallback', () => {
    expect(resolveCharacterAsset('asset-character-temple-official')).toMatchObject({
      master: '/assets/characters/shenyan/shenyan-master-v3.webp',
      avatar: '/assets/characters/shenyan/shenyan-avatar-v3.webp',
    })
    expect(resolveCharacterAsset('asset-character-record-clerk')?.master).toBe('/assets/characters/record-clerk/record-clerk-base-v1.webp')
    expect(resolveCharacterAsset('asset-character-home-witness')?.master).toBe('/assets/characters/home-witness/home-witness-base-v1.webp')
    expect(resolveCharacterAsset('asset-character-rest-witness')).toBeUndefined()
  })
})
