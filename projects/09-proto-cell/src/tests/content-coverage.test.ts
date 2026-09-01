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

  it('produces diverse builds and successful six-stage terminal runs', () => {
    const routes = [
      ['journey-route-algae-feast', 'journey-route-fiber-cover', 'journey-route-acid-pressure', 'journey-route-fiber-ambush', 'journey-route-chamber-wreckage'],
      ['journey-route-algae-feast', 'journey-route-antibody-current', 'journey-route-algae-blackout', 'journey-route-antibody-hunt', 'journey-route-chamber-gauntlet'],
      ['journey-route-acid-mutation', 'journey-route-fiber-cover', 'journey-route-acid-pressure', 'journey-route-antibody-hunt', 'journey-route-chamber-wreckage'],
      ['journey-route-acid-mutation', 'journey-route-antibody-current', 'journey-route-algae-blackout', 'journey-route-fiber-ambush', 'journey-route-chamber-gauntlet'],
    ] as const
    const policies = ['speed', 'armor', 'stealth', 'parasite', 'swarm'] as const
    const reports = Array.from({ length: 10 }, (_, index) => runHeadless({
      seed: [17, 43, 91, 127, 211, 307, 419, 557, 701, 887][index]!,
      durationMs: 560_000,
      route: routes[index % routes.length],
      policy: policies[index % policies.length],
    }))

    expect(new Set(reports.map((report) => report.morphologySignature)).size).toBeGreaterThanOrEqual(6)
    expect(reports.filter((report) => report.endingId).length).toBeGreaterThanOrEqual(4)
    expect(reports.every((report) => report.stageSignature === '1>2>3>4>5>6')).toBe(true)
    expect(reports.flatMap((report) => report.invalidNumbers)).toEqual([])
  }, 120_000)
})
