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
    expect(new Set(assets.map((asset) => asset!.placeholder)).size).toBe(16)
    expect(assets.every((asset) => asset!.placeholder?.endsWith('.webp'))).toBe(true)
  })

  it('maps a result code to its manifest-approved beast and placeholder', () => {
    expect(getBeastAsset('RTLS')).toEqual({
      beastId: 'luwu',
      src: '/assets/sbti/beasts/luwu/profile-v2-reference-verified.webp',
      placeholder: '/assets/sbti/beasts/luwu/placeholder-v2.webp',
    })
  })

  it('uses the derived placeholder for the same beast instead of substituting another profile', () => {
    expect(getBeastAsset('RTLM')).toEqual({
      beastId: 'ershu',
      src: '/assets/sbti/beasts/ershu/profile-v2-reference-verified.webp',
      placeholder: '/assets/sbti/beasts/ershu/placeholder-v2.webp',
    })
  })

  it('returns no asset for a code outside the frozen result mapping', () => {
    expect(getBeastAsset('RTFS')).toBeUndefined()
  })
})
