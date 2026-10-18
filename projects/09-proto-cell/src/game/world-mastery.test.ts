import { describe, expect, it } from 'vitest'
import { createGameEngine } from './engine'
import { circleBody } from '../tests/fixtures'

describe('world mastery in the production engine', () => {
  it('tags a real active rival engulf for impact feedback', () => {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { tierIndex: 1, evolutionPressure: 1 } })
    engine.start(); engine.advance(1000 / 60)
    engine.input.start({ x: 0, y: 0 }); engine.input.move({ x: 120, y: 0 })
    for (let frame = 0; frame < 14; frame += 1) engine.advance(1000 / 60)
    const world = engine.renderSnapshot()
    const player = world.entities.find((entity) => entity.id === 'player')!
    const rival = world.entities.find((entity) => entity.id === 'encounter-1')!
    for (const entity of world.entities) if (entity !== player && entity !== rival) entity.status = 'engulfed'
    rival.position = { x: player.position.x + 8, y: player.position.y }; rival.body = circleBody(rival.position, rival.body.radius)
    rival.materializingUntilMs = -1; rival.arrivalPhase = undefined
    engine.drainEvents(); engine.advance(1000 / 60)
    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({ type: 'engulfed', preyId: 'encounter-1', reversal: true }))
    expect(engine.snapshot().ecosystem?.reversalCount).toBe(1)
    engine.destroy()
  })
  it('makes a stronger hunter lose sight behind a fiber and reacquire through its gap', () => {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { evolutionPressure: 0.1 } })
    engine.start(); engine.advance(1000 / 60)
    const world = engine.renderSnapshot()
    const player = world.entities.find((entity) => entity.id === 'player')!
    const hunter = world.entities.find((entity) => entity.id === 'encounter-0')!
    for (const entity of world.entities) if (entity !== player && entity !== hunter) entity.status = 'engulfed'
    player.position = { x: 720, y: 1220 }; player.body = circleBody(player.position, player.body.radius)
    hunter.position = { x: 720, y: 1040 }; hunter.body = circleBody(hunter.position, hunter.body.radius)
    hunter.materializingUntilMs = -1; hunter.arrivalPhase = undefined
    world.environmentField.obstacles = [{ id: 'cover', kind: 'fiber', adhesive: true, from: { x: 400, y: 1200 }, to: { x: 1040, y: 1200 } }]
    engine.start(); engine.advance(1000 / 60)
    expect(engine.renderSnapshot().entities.find((entity) => entity.id === hunter.id)?.behaviorState).toBe('search')
    expect(engine.snapshot().territory?.concealed).toBe(true)
    engine.renderSnapshot().environmentField.obstacles[0]!.gaps = [{ fromT: 0.3, toT: 0.7, atMs: 16 }]
    engine.advance(1000 / 60)
    expect(engine.renderSnapshot().entities.find((entity) => entity.id === hunter.id)?.behaviorState).toBe('telegraph')
    engine.destroy()
  })
  it('opens a persistent terrain gap only through active mature movement and resets it next run', () => {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { tierIndex: 1, evolutionPressure: 1 } })
    const world = engine.renderSnapshot()
    const player = world.entities.find((entity) => entity.id === 'player')!
    for (const entity of world.entities) if (entity !== player) entity.status = 'engulfed'
    world.environmentField.obstacles = [{ id: 'breakable', kind: 'fiber', adhesive: true, from: { x: player.position.x - 300, y: player.position.y - 20 }, to: { x: player.position.x + 300, y: player.position.y - 20 } }]
    engine.start()
    for (let frame = 0; frame < 30; frame += 1) engine.advance(1000 / 60)
    expect(engine.drainEvents().some((event) => event.type === 'terrain-broken')).toBe(false)
    engine.pause('user'); engine.advance(1000); engine.resume('user')
    engine.input.start({ x: 0, y: 0 }); engine.input.move({ x: 0, y: -120 })
    const events = []
    for (let frame = 0; frame < 40; frame += 1) { engine.advance(1000 / 60); events.push(...engine.drainEvents()) }
    expect(events).toContainEqual(expect.objectContaining({ type: 'terrain-broken', obstacleId: 'breakable' }))
    expect(engine.renderSnapshot().entities.filter((entity) => entity.id.startsWith('terrain-nutrient-breakable-'))).toHaveLength(3)
    // This isolated terrain fixture re-closes the same obstacle: widening or
    // rebreaking it must not respawn a second reward or grant biomass directly.
    const after = engine.renderSnapshot()
    const body = after.entities.find((entity) => entity.id === 'player')!
    for (const entity of after.entities) if (entity !== body) entity.status = 'engulfed'
    after.environmentField.obstacles = [{ id: 'breakable', kind: 'fiber', adhesive: true, from: { x: body.position.x - 300, y: body.position.y - 70 }, to: { x: body.position.x + 300, y: body.position.y - 70 } }]
    const before = engine.snapshot().ecosystem!.activeBiomass
    for (let frame = 0; frame < 40; frame += 1) engine.advance(1000 / 60)
    expect(engine.drainEvents()).toContainEqual(expect.objectContaining({ type: 'terrain-broken', obstacleId: 'breakable' }))
    expect(engine.renderSnapshot().entities.some((entity) => entity.id.startsWith('terrain-nutrient-breakable-'))).toBe(false)
    expect(engine.snapshot().ecosystem!.activeBiomass).toBe(before)
    expect(engine.snapshot().territory?.brokenFibers).toBeGreaterThan(0)
    expect(createGameEngine({ seed: 727 }).renderSnapshot().environmentField.obstacles.every((obstacle) => !obstacle.gaps?.length)).toBe(true)
    engine.destroy()
  })
})
