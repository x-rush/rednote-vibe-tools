import { describe, expect, it } from 'vitest'
import { runHeadless } from './playthrough'

describe('M0 headless playthrough', () => {
  it('keeps the five-minute entity population bounded', () => {
    const report = runHeadless({ seed: 727, durationMs: 300_000 })

    expect(report.simulatedMs).toBeCloseTo(300_000, 4)
    expect(report.maxEntities).toBeLessThanOrEqual(180)
    expect(report.invalidNumbers).toEqual([])
    expect(report.keyEvents).toContainEqual(expect.objectContaining({ type: 'ecology-opportunity' }))
  }, 20_000)

  it('finishes a deterministic six-stage journey without route-driving cheats', () => {
    const input = { seed: 727, durationMs: 520_000, policy: 'balanced' as const }
    const first = runHeadless(input)
    const second = runHeadless(input)

    expect(first.keyEvents).toEqual(second.keyEvents)
    expect(first.morphologySignature).toBe(second.morphologySignature)
    expect(first.stageSignature).toBe('1>2>3>4>5>6')
    expect(first.routeSignature.split('>')).toHaveLength(5)
    expect(new Set(first.opportunitySignature.split('>')).size).toBeGreaterThanOrEqual(4)
    expect(first.maxActionableGapMs).toBeLessThanOrEqual(8000)
  }, 30_000)

  it('shows all eight visible behavior families during a ten-seed audit', () => {
    const families = new Set<string>()
    for (let seed = 0; seed < 10; seed += 1) {
      const report = runHeadless({ seed, durationMs: 520_000 })
      Object.keys(report.behaviorStateCounts).forEach((family) => families.add(family))
    }

    expect([...families].sort()).toEqual(['ambusher', 'apex', 'competitor', 'hunter', 'resource', 'scavenger', 'school', 'skittish'])
  }, 60_000)
})
