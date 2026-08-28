import { describe, expect, it } from 'vitest'
import { circleBody } from '../tests/fixtures'
import * as containment from './containment'

describe('majority geometric containment', () => {
  it('accepts a larger cell after covering at least seventy percent of the target', () => {
    expect('coveredRatio' in containment).toBe(true)
    if (!('coveredRatio' in containment)) return
    const predator = circleBody({ x: 0, y: 0 }, 20)
    const prey = circleBody({ x: 18, y: 0 }, 5)

    expect(containment.coveredRatio(predator, prey)).toBeGreaterThan(0.7)
    expect(containment.mostlyContains(predator, prey, 0.7)).toBe(true)
  })

  it('rejects overlap below seventy percent', () => {
    const predator = circleBody({ x: 0, y: 0 }, 20)
    const prey = circleBody({ x: 19, y: 0 }, 5)

    expect(containment.mostlyContains(predator, prey, 0.7)).toBe(false)
  })

  it('rejects a container that is not larger than its target', () => {
    const sameSize = circleBody({ x: 0, y: 0 }, 10)
    const target = circleBody({ x: 0, y: 0 }, 10)

    expect(containment.mostlyContains(sameSize, target, 0.7)).toBe(false)
  })
})
