import { describe, expect, it } from 'vitest'
import { createPointerInput } from '../game/input'
import { clearPointerSession } from './GameCanvas'

describe('game canvas pointer lifecycle', () => {
  it('cancels movement only for the active pointer or a global lifecycle reset', () => {
    const input = createPointerInput()
    const activePointer = { current: 7 as number | null }
    input.move({ x: 120, y: 0 }, { x: 0, y: 0 })

    expect(clearPointerSession(input, activePointer, 8)).toBe(false)
    expect(input.snapshot().strength).toBe(1)

    expect(clearPointerSession(input, activePointer, 7)).toBe(true)
    expect(activePointer.current).toBeNull()
    expect(input.snapshot().strength).toBe(0)

    activePointer.current = 9
    input.move({ x: 120, y: 0 }, { x: 0, y: 0 })
    expect(clearPointerSession(input, activePointer)).toBe(true)
    expect(input.snapshot().strength).toBe(0)
  })
})
