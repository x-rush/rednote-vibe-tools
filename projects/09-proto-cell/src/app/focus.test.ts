import { describe, expect, it } from 'vitest'
import { wrappedModalFocusIndex } from './focus'

describe('modal focus wrapping', () => {
  it('wraps forward from the last control and backward from the first', () => {
    expect(wrappedModalFocusIndex(1, 2, false)).toBe(0)
    expect(wrappedModalFocusIndex(0, 2, true)).toBe(1)
  })

  it('lets the browser handle focus between interior controls', () => {
    expect(wrappedModalFocusIndex(0, 3, false)).toBeUndefined()
    expect(wrappedModalFocusIndex(2, 3, true)).toBeUndefined()
  })
})
