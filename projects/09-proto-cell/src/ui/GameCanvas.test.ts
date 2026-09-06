import { describe, expect, it } from 'vitest'
import { createPointerInput } from '../game/input'
import { canvasViewport, clearPointerSession, engulfPreyName } from './GameCanvas'
import * as gameCanvasModule from './GameCanvas'

describe('game canvas pointer lifecycle', () => {
  it('falls back to a playable CSS viewport when layout is not measured yet', () => {
    expect(canvasViewport({ clientWidth: 0, clientHeight: 0 })).toEqual({ width: 390, height: 844 })
    expect(canvasViewport({ clientWidth: 375, clientHeight: 812 })).toEqual({ width: 375, height: 812 })
  })

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

describe('canvas failure diagnostics', () => {
  it('preserves the failing phase and useful error message', () => {
    const canvasFailureFrom = (gameCanvasModule as unknown as {
      canvasFailureFrom(error: unknown, phase: 'initialization' | 'frame' | 'context-lost'): { phase: string; message: string }
    }).canvasFailureFrom

    expect(canvasFailureFrom(new Error('gradient coordinates became invalid'), 'frame')).toEqual({
      phase: 'frame',
      message: 'gradient coordinates became invalid',
    })
    expect(canvasFailureFrom(undefined, 'context-lost')).toEqual({
      phase: 'context-lost',
      message: 'Canvas context lost',
    })
  })
})
