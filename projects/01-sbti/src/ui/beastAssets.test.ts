import { describe, expect, it } from 'vitest'
import { getBeastAsset } from './beastAssets'

describe('beast release asset mapping', () => {
  it('maps a result code to its manifest-approved beast and placeholder', () => {
    expect(getBeastAsset('RTLS')).toEqual({
      beastId: 'luwu',
      src: '/assets/sbti/beasts/luwu/profile-v2-reference-verified.webp',
      placeholder: '/assets/sbti/beasts/luwu/placeholder-v2.webp',
    })
  })

  it('does not substitute another beast when a profile has no placeholder', () => {
    expect(getBeastAsset('RTLM')).toEqual({
      beastId: 'ershu',
      src: '/assets/sbti/beasts/ershu/profile-v2-reference-verified.webp',
    })
  })

  it('returns no asset for a code outside the frozen result mapping', () => {
    expect(getBeastAsset('RTFS')).toBeUndefined()
  })
})
