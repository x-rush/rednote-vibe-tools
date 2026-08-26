import { describe, expect, it } from 'vitest'
import { getWrappedFocusIndex } from './focus'

describe('dialog focus loop', () => {
  it('wraps forward from the final control to the first control', () => {
    expect(getWrappedFocusIndex(2, 3, false)).toBe(0)
  })

  it('wraps backward from the first control to the final control', () => {
    expect(getWrappedFocusIndex(0, 3, true)).toBe(2)
  })

  it('moves normally between controls', () => {
    expect(getWrappedFocusIndex(1, 3, false)).toBe(2)
    expect(getWrappedFocusIndex(1, 3, true)).toBe(0)
  })
})
