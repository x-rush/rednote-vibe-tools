import { describe, expect, it } from 'vitest'
import { nextPortraitStage } from './mediaFallback'

describe('Wenshan portrait fallback', () => {
  it('falls back from master to placeholder and only then to CSS ink', () => {
    expect(nextPortraitStage('master')).toBe('placeholder')
    expect(nextPortraitStage('placeholder')).toBe('css')
    expect(nextPortraitStage('css')).toBe('css')
  })
})
