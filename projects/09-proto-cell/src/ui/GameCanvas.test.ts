import { describe, expect, it } from 'vitest'
import { createPointerInput } from '../game/input'
import { clearPointerSession, engulfPreyName } from './GameCanvas'

describe('game canvas pointer lifecycle', () => {
  it('cancels movement only for the active pointer or a global lifecycle reset', () => {
    const input = createPointerInput()
    const activePointer = { current: 7 as number | null }
    input.start({ x: 0, y: 0 })
    input.move({ x: 120, y: 0 })

    expect(clearPointerSession(input, activePointer, 8)).toBe(false)
    expect(input.snapshot().strength).toBe(1)

    expect(clearPointerSession(input, activePointer, 7)).toBe(true)
    expect(activePointer.current).toBeNull()
    expect(input.snapshot().strength).toBe(0)

    activePointer.current = 9
    input.start({ x: 0, y: 0 })
    input.move({ x: 120, y: 0 })
    expect(clearPointerSession(input, activePointer)).toBe(true)
    expect(input.snapshot().strength).toBe(0)
  })
})

describe('engulf feedback labels', () => {
  it('resolves creature and nutrient names from content', () => {
    expect(engulfPreyName('creature-drifter')).toBe('漂游体')
    expect(engulfPreyName('nutrient-protein')).toBe('蛋白团')
    expect(engulfPreyName(undefined)).toBeUndefined()
  })
})
