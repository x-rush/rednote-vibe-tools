import { describe, expect, it, vi } from 'vitest'
import { testDependencies } from '../tests/fixtures'
import { createController } from './controller'
import { createGameEngine } from '../game/engine'
import type { OrganelleId, OriginId } from '../content'

describe('M0 app controller', () => {
  it('records a dense event batch from one authoritative frame snapshot', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    const engine = controller.engine()!, hud = vi.spyOn(engine, 'snapshot'), render = vi.spyOn(engine, 'renderSnapshot')
    const events = Array.from({ length: 120 }, () => ({ type: 'organ-triggered' as const, entityId: 'player', organId: 'organelle-flagellum' as const, atMs: 0 }))
    controller.handleMany(events)
    expect(hud).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledTimes(1)
    expect(controller.snapshot().eventLog).toHaveLength(120)
    controller.destroy()
  })
  it('keeps the full independent journal available while HUD snapshots skip copying it', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    controller.handle({ type: 'organ-triggered', entityId: 'player', organId: 'organelle-flagellum', atMs: 0 })
    expect(controller.snapshot({ includeEventLog: false }).eventLog).toEqual([])
    expect(controller.snapshot({ includeEventLog: 'result' }).eventLog).toEqual([])
    const first = controller.snapshot()
    ;(first.eventLog[0]!.snapshot!.organelleIds as string[]).push('organelle-eye-spot')
    expect(controller.snapshot().eventLog[0]!.snapshot!.organelleIds).not.toContain('organelle-eye-spot')
    expect(controller.snapshot().eventLog).toHaveLength(1)
    controller.handle({ type: 'ending-reached', endingId: 'ending-stable-species', atMs: 2000 })
    expect(controller.snapshot({ includeEventLog: 'result' }).eventLog).toHaveLength(2)
    controller.destroy()
  })
  it('keeps route counters independent between exported entries from one event batch', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    controller.handleMany(Array.from({ length: 2 }, () => ({ type: 'organ-triggered' as const, entityId: 'player', organId: 'organelle-flagellum' as const, atMs: 0 })))
    const snapshot = controller.snapshot()
    snapshot.eventLog[0]!.snapshot!.buildRouteCounts!.predation = 99
    expect(snapshot.eventLog[1]!.snapshot!.buildRouteCounts!.predation).toBe(0)
    expect(controller.snapshot().eventLog[0]!.snapshot!.buildRouteCounts!.predation).toBe(0)
    controller.destroy()
  })
  it('records the real form and scale with life events for later specimens', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell' })
    controller.handle({ type: 'organ-triggered', entityId: 'player', organId: 'organelle-flagellum', atMs: 0 })
    expect(controller.snapshot().eventLog[0]?.snapshot).toMatchObject({ formId: 'form-primal-cell', tierIndex: 0 })
    controller.destroy()
  })
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

  it('passes the persisted run ordinal and increments it on restart', () => {
    const controller = createController(testDependencies())
    controller.startRun({ seed: 727, originId: 'origin-primal-cell', runOrdinal: 4 })
    expect(controller.engine()?.runSnapshot().runOrdinal).toBe(4)

    controller.restart()
    expect(controller.engine()?.runSnapshot().runOrdinal).toBe(5)
  })

  it('restarts the same lineage with its inherited organ and fresh lifetime progress', () => {
    const dependencies = testDependencies()
    dependencies.createEngine = (input) => createGameEngine({ ...input, originId: input.originId as OriginId })
    const controller = createController(dependencies)
    const inheritedOrganelleIds: OrganelleId[] = ['organelle-flagellum']
    controller.startRun({ seed: 727, originId: 'origin-armored-spore', lineageArchetypeId: 'lineage-bastion', inheritedOrganelleIds })
    inheritedOrganelleIds.push('organelle-eye-spot')
    controller.restart()
    expect(controller.snapshot()).toMatchObject({ seed: 728, hud: { tierIndex: 0, elapsedMs: 0 } })
    expect(controller.engine()?.evolutionSnapshot().organelles.map((organ) => organ.id)).toEqual(['organelle-flagellum'])
    expect(controller.engine()?.renderSnapshot().entities.find((entity) => entity.id === 'player')).toMatchObject({ visualRecipeId: 'visual-lineage-bastion' })
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
