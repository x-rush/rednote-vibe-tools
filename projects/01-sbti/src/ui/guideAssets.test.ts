import { describe, expect, it } from 'vitest'
import { getGuidePortrait } from './guideAssets'

describe('Wenshan pose assets', () => {
  it('maps meaningful guide states to versioned project assets', () => {
    expect(getGuidePortrait('default')).toBe('./assets/shbti/guide/guide-master-v1.webp')
    expect(getGuidePortrait('pass-scroll')).toBe('./assets/shbti/guide/guide-wenshan-pass-scroll-v1.webp')
    expect(getGuidePortrait('read-seals')).toBe('./assets/shbti/guide/guide-wenshan-read-seals-v1.webp')
  })
})
