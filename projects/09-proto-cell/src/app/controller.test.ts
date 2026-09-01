import { describe, expect, it, vi } from 'vitest'
import { testDependencies } from '../tests/fixtures'
import { createController } from './controller'

describe('M0 app controller', () => {
  it('starts, dies, and restarts with a fresh run seed', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    controller.handle({ type: 'player-died', cause: 'engulfed', atMs: 1000 })

    expect(controller.snapshot().screen).toBe('result')
    const failedSeed = controller.snapshot().seed
    controller.restart()

    expect(controller.snapshot().screen).toBe('playing')
    expect(controller.snapshot().seed).not.toBe(failedSeed)
  })

  it('keeps visibility and user pauses independent', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    controller.pause('visibility')
    controller.pause('user')
    controller.resume('visibility')

    expect(controller.snapshot().screen).toBe('paused')
    controller.resume('user')
    expect(controller.snapshot().screen).toBe('playing')
  })

  it('waits for the authoritative player-died event instead of a single body engulf', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })

    controller.handle({ type: 'engulfed', predatorId: 'threat', preyId: 'player', biomass: 10, atMs: 1000 })
    expect(controller.snapshot().screen).toBe('playing')

    controller.handle({ type: 'player-died', cause: 'all-split-bodies-lost', atMs: 1001 })
    expect(controller.snapshot().screen).toBe('result')
    expect(controller.snapshot().eventLog.map((entry) => entry.sequence)).toEqual([1, 2])
  })

  it('records structured run facts and ends on a real ending event', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    controller.handle({ type: 'route-selected', routeId: 'journey-route-acid-mutation', environmentId: 'env-acid-vesicle', atMs: 5000 })
    controller.handle({ type: 'ending-reached', endingId: 'ending-stable-species', atMs: 6000 })

    expect(controller.snapshot()).toMatchObject({ screen: 'result', cause: 'ending-stable-species' })
    expect(controller.snapshot().eventLog[0]?.snapshot).toMatchObject({
      runSeed: 727,
      environmentId: 'env-acid-vesicle',
      morphology: { bodyCount: 1, totalMass: 144, radius: 12, stability: 100 },
    })
  })

  it('destroys the completed engine before an immediate restart', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    const destroy = vi.spyOn(controller.engine()!, 'destroy')

    controller.restart()

    expect(destroy).toHaveBeenCalledOnce()
    expect(controller.snapshot()).toMatchObject({ screen: 'playing', seed: 728, eventLog: [] })
  })

  it('returns a completed run to the lab without starting another engine', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    controller.handle({ type: 'player-died', cause: 'engulfed', atMs: 1000 })
    controller.returnToLab()
    expect(controller.snapshot().screen).toBe('lab')
    expect(controller.engine()).toBeUndefined()
  })
})
