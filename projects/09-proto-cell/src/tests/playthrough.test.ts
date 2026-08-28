import { describe, expect, it } from 'vitest'
import { runHeadless } from './playthrough'

describe('M0 headless playthrough', () => {
  it('keeps the five-minute entity population bounded', () => {
    const report = runHeadless({ seed: 727, durationMs: 300_000 })

    expect(report.simulatedMs).toBeCloseTo(300_000, 4)
    expect(report.maxEntities).toBeLessThanOrEqual(180)
    expect(report.invalidNumbers).toEqual([])
    expect(report.keyEvents).toContainEqual(expect.objectContaining({
      type: 'event-phase',
      eventId: 'event-nutrient-bloom',
      phase: 'active',
    }))
  }, 20_000)

  it('repeats the same full-route sequence and morphology for a seed', () => {
    const input = { seed: 727, durationMs: 520_000, route: ['env-algae-glow', 'env-fiber-maze'], policy: 'balanced' as const }
    const first = runHeadless(input)
    const second = runHeadless(input)

    expect(first.keyEvents).toEqual(second.keyEvents)
    expect(first.morphologySignature).toBe(second.morphologySignature)
    expect(first.routeSignature).toBe('env-algae-glow>env-fiber-maze>env-abandoned-chamber')
    expect(first.endingId).toBe('ending-stable-species')
  }, 20_000)
})
