import { describe, expect, it } from 'vitest'
import { metamorphosisPresentation } from './metamorphosis'

describe('metamorphosis presentation', () => {
  it('moves through contraction, growth, and bloom over 900ms', () => {
    expect(metamorphosisPresentation(0, false)?.phase).toBe('contraction')
    expect(metamorphosisPresentation(220, false)?.phase).toBe('growth')
    expect(metamorphosisPresentation(560, false)?.phase).toBe('bloom')
    expect(metamorphosisPresentation(900, false)).toBeUndefined()
  })

  it('uses only a short cross-fade for reduced motion', () => {
    expect(metamorphosisPresentation(90, true)).toMatchObject({ phase: 'cross-fade', scale: 1 })
    expect(metamorphosisPresentation(180, true)).toBeUndefined()
  })
})
