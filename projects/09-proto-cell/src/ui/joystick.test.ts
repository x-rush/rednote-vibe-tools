import { describe, expect, it } from 'vitest'
import { resolveFloatingJoystick } from './joystick'

describe('floating joystick visual', () => {
  it('follows the thumb inside the travel radius', () => {
    expect(resolveFloatingJoystick({ x: 80, y: 640 }, { x: 104, y: 608 })).toEqual({
      origin: { x: 80, y: 640 },
      knobOffset: { x: 24, y: -32 },
    })
  })

  it('caps the knob at the same 48px radius that reaches full speed', () => {
    expect(resolveFloatingJoystick({ x: 100, y: 600 }, { x: 200, y: 600 })).toEqual({
      origin: { x: 100, y: 600 },
      knobOffset: { x: 48, y: 0 },
    })
  })
})
