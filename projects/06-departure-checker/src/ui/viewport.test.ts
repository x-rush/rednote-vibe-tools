import { describe, expect, it, vi } from 'vitest'
import { resetPageScroll } from './viewport'

describe('resetPageScroll', () => {
  it('returns a newly mounted full-screen mode to the top without animation', () => {
    const scrollTo = vi.fn()

    resetPageScroll({ scrollTo })

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })
})
