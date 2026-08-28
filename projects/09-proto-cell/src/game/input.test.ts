import { describe, expect, it } from 'vitest'
import { createPointerInput } from './input'

describe('movement-only pointer input', () => {
  it('clears movement on pointer cancellation', () => {
    const input = createPointerInput()
    input.move({ x: 200, y: 300 }, { x: 100, y: 200 })
    input.cancel()

    expect(input.snapshot()).toEqual({ direction: { x: 0, y: 0 }, strength: 0 })
  })

  it('maps displacement to normalized direction and capped strength', () => {
    const input = createPointerInput()

    input.start({ x: 190, y: 200 }, { x: 100, y: 200 })
    expect(input.snapshot()).toEqual({ direction: { x: 1, y: 0 }, strength: 0.75 })

    input.move({ x: 100, y: 400 }, { x: 100, y: 200 })
    expect(input.snapshot()).toEqual({ direction: { x: 0, y: 1 }, strength: 1 })

    input.end()
    expect(input.snapshot()).toEqual({ direction: { x: 0, y: 0 }, strength: 0 })
  })
})
