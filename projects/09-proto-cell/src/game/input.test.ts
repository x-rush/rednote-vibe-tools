import { describe, expect, it } from 'vitest'
import { createPointerInput } from './input'

describe('movement-only pointer input', () => {
  it('uses the pointer-down location as the joystick origin', () => {
    const input = createPointerInput({ deadZone: 12, fullStrengthDistance: 96 })
    input.start({ x: 300, y: 600 })
    input.move({ x: 348, y: 600 })

    expect(input.snapshot()).toEqual({ direction: { x: 1, y: 0 }, strength: 0.5 })
  })

  it('keeps movement inside the dead zone at rest', () => {
    const input = createPointerInput({ deadZone: 12, fullStrengthDistance: 96 })
    input.start({ x: 300, y: 600 })
    input.move({ x: 308, y: 606 })

    expect(input.snapshot()).toEqual({ direction: { x: 0, y: 0 }, strength: 0 })
  })

  it('clears movement after release and cancellation', () => {
    const input = createPointerInput({ deadZone: 12, fullStrengthDistance: 96 })
    input.start({ x: 40, y: 50 })
    input.move({ x: 40, y: 146 })
    input.end()
    expect(input.snapshot().strength).toBe(0)

    input.start({ x: 40, y: 50 })
    input.move({ x: 136, y: 50 })
    input.cancel()
    expect(input.snapshot()).toEqual({ direction: { x: 0, y: 0 }, strength: 0 })
  })
})
