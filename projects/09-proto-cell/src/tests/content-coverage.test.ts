import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { outcomeFixtures } from './fixtures'
import { auditOutcomes, resolveBossThroughStateMachine, runHeadless } from './playthrough'
import { createBoss, resolveBossPath, stepBoss } from '../world/bosses'

describe('launch outcome and build coverage', () => {
  it('covers every ending and required death family with truthful event sequences', () => {
    expect(auditOutcomes(getContent(), outcomeFixtures())).toEqual({ missingEndingIds: [], missingDeathIds: [] })
  })

  it('drives every declared Boss path through the real state machine', () => {
    for (const definition of getContent().bosses) {
      for (const path of definition.resolutionPaths) {
        const dormant = createBoss(definition.id, { seed: 727, atMs: 0 })
        const active = stepBoss(dormant, { atMs: dormant.telegraphEndsAtMs })
        const resolved = resolveBossThroughStateMachine(active, path, definition)
        expect(resolveBossPath(resolved), `${definition.id}:${path}`).toEqual({ complete: true, path })
      }
    }
  })

  it('produces diverse builds and successful three-ecosystem runs with normal stats', () => {
    const policies = ['speed', 'armor', 'stealth', 'parasite', 'swarm'] as const
    const reports = Array.from({ length: 10 }, (_, index) => runHeadless({
      seed: [17, 43, 91, 127, 211, 307, 419, 557, 701, 887][index]!,
      durationMs: 560_000,
      policy: policies[index % policies.length],
    }))

    expect(new Set(reports.map((report) => report.morphologySignature)).size).toBeGreaterThanOrEqual(6)
    expect(reports.filter((report) => report.endingId).length).toBeGreaterThanOrEqual(4)
    expect(reports.filter((report) => report.endingId).every((report) => report.stageSignature === '1>2>3')).toBe(true)
    expect(reports.every((report) => ['1', '1>2', '1>2>3'].includes(report.stageSignature))).toBe(true)
    expect(reports.flatMap((report) => report.invalidNumbers)).toEqual([])
  }, 120_000)
})
