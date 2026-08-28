import { describe, expect, it } from 'vitest'
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
})
