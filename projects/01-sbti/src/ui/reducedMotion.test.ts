import { describe, expect, it } from 'vitest'
import { effectiveReducedMotion } from './reducedMotion'

describe('effectiveReducedMotion', () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])('combines saved %s and system %s into %s', (saved, system, expected) => {
    expect(effectiveReducedMotion(saved, system)).toBe(expected)
  })
})
