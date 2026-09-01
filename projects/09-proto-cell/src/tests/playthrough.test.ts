import { describe, expect, it } from 'vitest'
import { runHeadless } from './playthrough'

let tenSeedReports: ReturnType<typeof runHeadless>[] | undefined
function auditedTenSeeds() {
  tenSeedReports ??= Array.from({ length: 10 }, (_, seed) => runHeadless({ seed, durationMs: 520_000 }))
  return tenSeedReports
}

describe('M0 headless playthrough', () => {
  const launchRouteAuditSet = [
    ['journey-route-algae-feast', 'journey-route-fiber-cover', 'journey-route-acid-pressure', 'journey-route-fiber-ambush', 'journey-route-chamber-wreckage'],
    ['journey-route-acid-mutation', 'journey-route-antibody-current', 'journey-route-algae-blackout', 'journey-route-antibody-hunt', 'journey-route-chamber-gauntlet'],
    ['journey-route-algae-feast', 'journey-route-antibody-current', 'journey-route-acid-pressure', 'journey-route-antibody-hunt', 'journey-route-chamber-wreckage'],
    ['journey-route-acid-mutation', 'journey-route-fiber-cover', 'journey-route-algae-blackout', 'journey-route-fiber-ambush', 'journey-route-chamber-gauntlet'],
  ] as const

  it('produces at least six distinct final morphology signatures across ten seeds', () => {
    const signatures = new Set(auditedTenSeeds().map((report) => report.morphologySignature))
    expect(signatures.size).toBeGreaterThanOrEqual(6)
  }, 120_000)

  it('covers every route offer across complete eight-minute outcomes', () => {
    for (const [seed, route] of launchRouteAuditSet.entries()) {
      const report = runHeadless({ seed: seed + 727, durationMs: 560_000, route })
      expect(report.invalidNumbers).toEqual([])
      expect(report.endingId ?? report.deathId).toBeDefined()
      expect(report.stageSignature.split('>')).toHaveLength(6)
    }
  }, 120_000)

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
    for (const report of auditedTenSeeds()) {
      Object.keys(report.behaviorStateCounts).forEach((family) => families.add(family))
    }

    expect([...families].sort()).toEqual(['ambusher', 'apex', 'competitor', 'hunter', 'resource', 'scavenger', 'school', 'skittish'])
  }, 120_000)
})
