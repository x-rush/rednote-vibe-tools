import { describe, expect, it } from 'vitest'
import { getBeastAsset } from './beastAssets'

describe('beast release asset mapping', () => {
  const frozenCodes = [
    'RTLS', 'RTLM', 'RTES', 'RTEM',
    'RVLS', 'RVLM', 'RVES', 'RVEM',
    'HTLS', 'HTLM', 'HTES', 'HTEM',
    'HVLS', 'HVLM', 'HVES', 'HVEM',
  ]

  it('covers all 16 frozen result codes with one unique verified profile each', () => {
    const assets = frozenCodes.map((code) => getBeastAsset(code))

    expect(assets.every(Boolean)).toBe(true)
    expect(new Set(assets.map((asset) => asset!.beastId)).size).toBe(16)
    expect(new Set(assets.map((asset) => asset!.src)).size).toBe(16)
    expect(assets.every((asset) => asset!.src.endsWith('reference-verified.webp'))).toBe(true)
    expect(new Set(assets.map((asset) => asset!.chibiSrc)).size).toBe(16)
    expect(assets.every((asset) => asset!.chibiSrc.endsWith('/chibi-v1.webp'))).toBe(true)
    expect(new Set(assets.map((asset) => asset!.placeholder)).size).toBe(16)
    expect(assets.every((asset) => asset!.placeholder?.endsWith('.webp'))).toBe(true)
    expect(assets.every((asset) => Number.isFinite(asset!.shareFocusY) && asset!.shareFocusY >= 0 && asset!.shareFocusY <= 1)).toBe(true)
  })

  it.each([
    ['RVLS', 0.35],
    ['RVEM', 0.3],
    ['HTLM', 0.3],
    ['HTEM', 0.35],
    ['HVLS', 0.4],
    ['HVLM', 0.25],
  ])('keeps the face of head-sensitive result %s inside its audited share-card safe area', (code, maximumFocusY) => {
    expect(getBeastAsset(code)!.shareFocusY).toBeLessThanOrEqual(maximumFocusY)
  })

  it('centres Dijiang on its yellow sac-shaped body instead of making the upper wings the subject', () => {
    expect(getBeastAsset('RVLM')!.shareFocusY).toBeGreaterThanOrEqual(0.48)
    expect(getBeastAsset('RVLM')!.shareFocusY).toBeLessThanOrEqual(0.55)
  })

  it('maps a result code to its manifest-approved beast and placeholder', () => {
    expect(getBeastAsset('RTLS')).toEqual({
      beastId: 'luwu',
      src: './assets/shbti/beasts/luwu/profile-v2-reference-verified.webp',
      chibiSrc: './assets/shbti/beasts/luwu/chibi-v1.webp',
      placeholder: './assets/shbti/beasts/luwu/placeholder-v2.webp',
      shareFocusY: 0.5,
    })
  })

  it('uses the derived placeholder for the same beast instead of substituting another profile', () => {
    expect(getBeastAsset('RTLM')).toEqual({
      beastId: 'ershu',
      src: './assets/shbti/beasts/ershu/profile-v2-reference-verified.webp',
      chibiSrc: './assets/shbti/beasts/ershu/chibi-v1.webp',
      placeholder: './assets/shbti/beasts/ershu/placeholder-v2.webp',
      shareFocusY: 0.5,
    })
  })

  it('returns no asset for a code outside the frozen result mapping', () => {
    expect(getBeastAsset('RTFS')).toBeUndefined()
  })

  it.each([
    ['RTEM', 'xingxing', 0.55],
    ['RVLS', 'yingzhao', 0.35],
    ['RVEM', 'fenghuang', 0.3],
    ['HTLS', 'xuangui', 0.45],
    ['HTLM', 'bifang', 0.3],
    ['HTEM', 'lushu', 0.35],
    ['HVLS', 'kaimingshou', 0.4],
  ])('keeps the audited crop for %s independent from the other beasts', (code, beastId, shareFocusY) => {
    expect(getBeastAsset(code)).toMatchObject({ beastId, shareFocusY })
  })
})
