import { describe, expect, it } from 'vitest'
import { runHeadless } from './playthrough'

let tenSeedReports: ReturnType<typeof runHeadless>[] | undefined
function auditedTenSeeds() {
  tenSeedReports ??= Array.from({ length: 10 }, (_, seed) => runHeadless({ seed, durationMs: 520_000 }))
  return tenSeedReports
}

describe('M0 headless playthrough', () => {
  const launchPolicyAuditSet = ['balanced', 'speed', 'armor', 'stealth'] as const

  it('produces at least six distinct final morphology signatures across ten seeds', () => {
    const signatures = new Set(auditedTenSeeds().map((report) => report.morphologySignature))
    expect(signatures.size).toBeGreaterThanOrEqual(6)
  }, 120_000)

  it('records normal terminal outcomes across several seed and build policies', () => {
    const reports = launchPolicyAuditSet.map((policy, index) => runHeadless({ seed: index + 727, durationMs: 720_000, policy }))
    for (const report of reports) {
      expect(report.invalidNumbers).toEqual([])
      expect(report.endingId ?? report.deathId, JSON.stringify(report.finalEcosystem)).toBeDefined()
      expect(['1', '1>2', '1>2>3']).toContain(report.stageSignature)
      expect(report.routeSignature).toBe('')
    }
    expect(reports.some((report) => report.endingId && report.stageSignature === '1>2>3')).toBe(true)
  }, 120_000)

  it('keeps the five-minute entity population bounded', () => {
    const report = runHeadless({ seed: 727, durationMs: 300_000 })

    expect(report.simulatedMs).toBeGreaterThan(60_000)
    expect(report.simulatedMs).toBeLessThanOrEqual(300_000.01)
    expect(report.maxEntities).toBeLessThanOrEqual(180)
    expect(report.invalidNumbers).toEqual([])
    expect(report.keyEvents).toContainEqual(expect.objectContaining({ type: 'ecology-opportunity' }))
  }, 20_000)

  it('finishes a deterministic three-layer food chain without changing player stats', () => {
    const input = { seed: 727, durationMs: 720_000, policy: 'balanced' as const }
    const first = runHeadless(input)
    const second = runHeadless(input)

    expect(first.keyEvents).toEqual(second.keyEvents)
    expect(first.morphologySignature).toBe(second.morphologySignature)
    expect(first.stageSignature, JSON.stringify(first.finalEcosystem)).toBe('1>2>3')
    expect(first.endingId).toBeDefined()
    expect(first.formSignature).toBe('form-primal-cell>form-colony-body>form-ciliate-composite')
    expect(first.keyEvents.filter((event) => event.type === 'mutation-selected')).toHaveLength(6)
    expect(first.consumedCarryoverIds.some((id) => first.fleeingCarryoverIds.includes(id))).toBe(true)
    expect(first.routeSignature).toBe('')
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
