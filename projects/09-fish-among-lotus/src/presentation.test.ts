import { describe, expect, it } from 'vitest'
import { getPresentationState } from './presentation.ts'

describe('poster presentation state', () => {
  it('keeps the designed copy and labeled controls on the default poster', () => {
    expect(getPresentationState(false)).toEqual({
      showDecorativeCopy: true,
      compactSettingsToggle: false,
    })
  })

  it('uses a copy-free canvas and compact settings entry with a custom background', () => {
    expect(getPresentationState(true)).toEqual({
      showDecorativeCopy: false,
      compactSettingsToggle: true,
    })
  })
})
