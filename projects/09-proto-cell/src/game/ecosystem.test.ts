import { describe, expect, it } from 'vitest'
import { createGameEngine } from './engine'
import { runHeadless } from '../tests/playthrough'
import { circleBody } from '../tests/fixtures'

describe('food-chain progression in the production engine', () => {
  it('publishes a real first-layer objective and a nearby opening meal', () => {
    const engine = createGameEngine({ seed: 727 })
    const hud = engine.snapshot()
    expect(hud).toHaveProperty('ecosystem')
    const world = engine.renderSnapshot()
    const player = world.entities.find((entity) => entity.id === 'player')!
    expect(world.entities.some((entity) => entity.id.startsWith('opening-food-')
      && entity.body.radius < player.body.radius
      && Math.hypot(entity.position.x - player.position.x, entity.position.y - player.position.y) < 90)).toBe(true)
    expect(engine.runSnapshot().mode).toBe('scale')
    expect(world.routeRifts).toEqual([])
  })

  it('never grants mutation, migration or victory to an idle player at the old timed migration deadline', () => {
    const engine = createGameEngine({ seed: 727, initialElapsedMs: 72_900, runOrdinal: 3 })
    engine.start()
    const events = []
    for (let frame = 0; frame < 120; frame += 1) {
      engine.advance(5 * 1000 / 60)
      events.push(...engine.drainEvents())
    }
    expect(engine.snapshot().environmentId).toBe('env-clear-drop')
    expect(events.some((event) => ['mutation-ready', 'migration-forced', 'ending-reached', 'form-transition-ready'].includes(event.type))).toBe(false)
  })

  it('lets normal movement, two mutations and a real rival kill open the second ecosystem', () => {
    const report = runHeadless({ seed: 727, durationMs: 180_000, stopAfterTier: 1 })
    expect(report.deathId, JSON.stringify(report.keyEvents.slice(-8))).toBeUndefined()
    expect(report.stageSignature, JSON.stringify(report.keyEvents.slice(-8))).toBe('1>2')
    expect(report.keyEvents.filter((event) => event.type === 'mutation-selected')).toHaveLength(2)
    expect(report.keyEvents).toContainEqual(expect.objectContaining({ type: 'engulfed', predatorId: 'player', preyId: 'encounter-0' }))
    expect(report.formSignature).toBe('form-primal-cell>form-colony-body')
    expect(report.invalidNumbers).toEqual([])
  }, 20_000)

  it('does not swallow food until the food really fits inside the player membrane', () => {
    const engine = createGameEngine({ seed: 727 })
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    const food = engine.renderSnapshot().entities.find((entity) => entity.id.startsWith('opening-food-'))!
    food.position = { x: player.position.x + player.body.radius - food.body.radius * 0.9, y: player.position.y }
    food.body = circleBody(food.position, food.body.radius)
    food.materializingUntilMs = -1
    engine.start()
    engine.advance(1000 / 60)
    expect(engine.drainEvents().some((event) => event.type === 'engulfed' && event.preyId === food.id)).toBe(false)
  })

  it('counts passive water-carried food as growth without counting it as active hunting', () => {
    const engine = createGameEngine({ seed: 727 })
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    const food = engine.renderSnapshot().entities.find((entity) => entity.id.startsWith('opening-food-'))!
    food.position = { ...player.position }
    food.body = circleBody(food.position, food.body.radius)
    food.materializingUntilMs = -1
    engine.start()
    engine.advance(1000 / 60)
    expect(engine.snapshot().tierProgress).toBeGreaterThan(0)
    expect(engine.snapshot().ecosystem?.activeBiomass).toBe(0)
    expect(engine.snapshot().ecosystem?.readyToEvolve).toBe(false)
  })

  it('keeps the encounter findable if another organism takes it before the player can counter-hunt', () => {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { evolutionPressure: 0.3 } })
    engine.start()
    engine.advance(1000 / 60)
    const rival = engine.renderSnapshot().entities.find((entity) => entity.id === 'encounter-0')!
    expect(rival).toBeDefined()
    // Model a real NPC kill after its normal contact resolution; the player receives no credit.
    rival.status = 'engulfed'
    engine.advance(1000 / 60)
    expect(engine.snapshot().ecosystem?.encounterPosition).toBeDefined()
    expect(engine.snapshot().ecosystem?.encounterResolved).toBe(false)
  })

  it.each([{ offset: 0.85, swallowed: false }, { offset: 0, swallowed: true }])('uses the visible ciliate membrane for food at relative y=$offset', ({ offset, swallowed }) => {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { tierIndex: 2 } })
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    const food = engine.renderSnapshot().entities.find((entity) => entity.id.startsWith('opening-food-'))!
    food.position = { x: player.position.x, y: player.position.y + player.body.radius * offset }
    food.body = circleBody(food.position, player.body.radius * 0.1)
    food.materializingUntilMs = -1
    engine.start()
    engine.advance(1000 / 60)
    expect(engine.drainEvents().some((event) => event.type === 'engulfed' && event.preyId === food.id)).toBe(swallowed)
  })

  it('keeps a named rival at its authored absolute size even when it wins food competition', () => {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { evolutionPressure: 0.3 } })
    engine.start()
    engine.advance(1000 / 60)
    const rival = engine.renderSnapshot().entities.find((entity) => entity.id === 'encounter-0')!
    const food = engine.renderSnapshot().entities.find((entity) => entity.id.startsWith('opening-food-'))!
    const radius = rival.body.radius
    food.position = { ...rival.position }
    food.body = circleBody(food.position, food.body.radius)
    food.materializingUntilMs = -1
    engine.advance(1000 / 60)
    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({ type: 'engulfed', predatorId: rival.id, preyId: food.id }))
    expect(engine.renderSnapshot().entities.find((entity) => entity.id === rival.id)?.body.radius).toBe(radius)
  })

  it('allows an active counter-hunt after a passive kill respawns the unresolved rival', () => {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { evolutionPressure: 1 } })
    engine.start()
    engine.advance(1000 / 60)
    const overlapRival = () => {
      const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
      const rival = engine.renderSnapshot().entities.find((entity) => entity.id === 'encounter-0')!
      rival.position = { x: player.position.x + 4, y: player.position.y }
      rival.body = circleBody(rival.position, rival.body.radius)
    }
    overlapRival()
    engine.advance(1000 / 60)
    expect(engine.snapshot().ecosystem?.encounterResolved).toBe(false)
    engine.input.start({ x: 0, y: 0 })
    engine.input.move({ x: 100, y: 0 })
    for (let step = 0; step < 15; step += 1) engine.advance(1000 / 60)
    overlapRival()
    engine.advance(1000 / 60)
    expect(engine.snapshot().ecosystem?.encounterResolved).toBe(true)
  })

  it('completes all three food chains with normal stats and actually swallows fleeing former predators', () => {
    const report = runHeadless({ seed: 727, durationMs: 720_000 })
    const diagnostics = JSON.stringify({ ecosystem: report.finalEcosystem, times: report.tierClearTimes, last: report.keyEvents.slice(-6) })
    expect(report.endingId, diagnostics).toBe('ending-stable-species')
    expect(report.stageSignature).toBe('1>2>3')
    expect(report.consumedCarryoverIds.some((id) => report.fleeingCarryoverIds.includes(id))).toBe(true)
    expect(report.keyEvents.filter((event) => event.type === 'mutation-selected')).toHaveLength(6)
    expect(report.invalidNumbers).toEqual([])
  }, 30_000)
})
