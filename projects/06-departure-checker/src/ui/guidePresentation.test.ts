import { describe, expect, it } from 'vitest'
import { GUIDE_PORTRAIT_VARIANTS, guidePresentationFor } from './guidePresentation'

describe('guide portrait presentation', () => {
  it('defines every approved stage without repeating meaningful alt text', () => {
    expect(GUIDE_PORTRAIT_VARIANTS).toEqual([
      'home',
      'wizard',
      'summary',
      'urgent',
      'completion',
      'help',
    ])
    expect(guidePresentationFor('home').alt).toContain('路岚')

    for (const variant of GUIDE_PORTRAIT_VARIANTS.filter((item) => item !== 'home')) {
      expect(guidePresentationFor(variant).alt).toBe('')
    }
  })
})
