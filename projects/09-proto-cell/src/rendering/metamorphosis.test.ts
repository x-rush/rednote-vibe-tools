import { describe, expect, it } from 'vitest'
import { metamorphosisPresentation } from './metamorphosis'

describe('metamorphosis presentation', () => {
  it('uses a 1.2 second transition between explicit forms', () => {
    expect(metamorphosisPresentation(1199, 'form-primal-cell', 'form-colony-body', false)).toBeDefined()
    expect(metamorphosisPresentation(1200, 'form-primal-cell', 'form-colony-body', false)).toBeUndefined()
    expect(metamorphosisPresentation(240, 'form-primal-cell', 'form-colony-body', true)).toBeUndefined()
  })

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
