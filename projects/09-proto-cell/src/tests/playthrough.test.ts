import { describe, expect, it } from 'vitest'
import { runHeadless } from './playthrough'

describe('M0 headless playthrough', () => {
  it('keeps the five-minute entity population bounded', () => {
    const report = runHeadless({ seed: 727, durationMs: 300_000 })

    expect(report.simulatedMs).toBeCloseTo(300_000, 4)
    expect(report.maxEntities).toBeLessThanOrEqual(180)
    expect(report.invalidNumbers).toEqual([])
  }, 20_000)

  it('repeats key events and morphology for the same seed', () => {
    const first = runHeadless({ seed: 91, durationMs: 30_000 })
    const second = runHeadless({ seed: 91, durationMs: 30_000 })

    expect(first.keyEvents).toEqual(second.keyEvents)
    expect(first.morphologySignature).toBe(second.morphologySignature)
  })
})
