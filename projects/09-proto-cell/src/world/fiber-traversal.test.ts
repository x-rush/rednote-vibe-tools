import { describe, expect, it } from 'vitest'
import { createEnvironmentField, resolveEnvironmentMovement, sampleEnvironmentField, type EnvironmentField } from './environments'
import { createGameEngine } from '../game/engine'
import { circleBody } from '../tests/fixtures'

function scene(): EnvironmentField {
  return { ...createEnvironmentField('env-fiber-maze', 727), obstacles: [
    { id: 'fiber', kind: 'fiber' as const, adhesive: true, from: { x: 0, y: 100 }, to: { x: 400, y: 100 } },
  ] }
}

describe('permeable fibers and growth', () => {
  it.each([12, 40, 64, 176])('lets radius %s squeeze across the middle in ordinary subpixel steps', (radius) => {
    const field = scene()
    let position = { x: 180, y: 100 + radius + 10 }
    for (let step = 0; step < (radius * 2 + 30) * 2; step += 1) {
      position = resolveEnvironmentMovement(field, position, { x: position.x, y: position.y - 0.5 }, radius)
    }
    expect(position.y).toBeLessThan(100 - radius)
    expect(position.x).toBe(180)
  })

  it('reduces adhesive resistance as the body grows without granting a speed bonus', () => {
    const field = scene()
    const speed = (radius: number) => sampleEnvironmentField(field, { x: 180, y: 100 }, radius).speedMultiplier
    expect(speed(12)).toBeCloseTo(0.42)
    expect(speed(40)).toBeGreaterThan(speed(12))
    expect(speed(64)).toBeGreaterThanOrEqual(0.9)
    expect(speed(176)).toBeLessThanOrEqual(1)
    expect(sampleEnvironmentField(field, { x: 180, y: 400 }, 40).speedMultiplier).toBe(1)
  })

  it('still stops bodies at solid chamber walls after a permeable fiber', () => {
    const field = scene()
    field.obstacles.push({ id: 'wall', kind: 'chamber-wall', adhesive: false, from: { x: 0, y: 60 }, to: { x: 400, y: 60 } })
    expect(resolveEnvironmentMovement(field, { x: 180, y: 74 }, { x: 180, y: 71 }, 12)).toEqual({ x: 180, y: 72 })
  })

  it('actually reaches and engulfs prey on the other side through normal engine movement', () => {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { tierIndex: 1, evolutionPressure: 0.9 } })
    const world = engine.renderSnapshot()
    // Local terrain fixture isolates movement/engulfing from enemies and the layer transition.
    world.environmentField.obstacles = createEnvironmentField('env-fiber-maze', 727).obstacles
    const player = world.entities.find((entity) => entity.id === world.playerId)!
    const food = world.entities.find((entity) => entity.faction !== 'player' && entity.body.radius < 20)!
    expect(food, JSON.stringify(world.entities.map((entity) => ({ id: entity.id, role: entity.role, radius: entity.body.radius })))).toBeDefined()
    for (const entity of world.entities) if (entity !== player && entity !== food) entity.status = 'engulfed'
    const fiber = world.environmentField.obstacles[0]!
    const length = Math.hypot(fiber.to.x - fiber.from.x, fiber.to.y - fiber.from.y)
    const normal = { x: -(fiber.to.y - fiber.from.y) / length, y: (fiber.to.x - fiber.from.x) / length }
    const middle = { x: (fiber.from.x + fiber.to.x) / 2, y: (fiber.from.y + fiber.to.y) / 2 }
    const offset = player.body.radius + 15
    player.position = { x: middle.x + normal.x * offset, y: middle.y + normal.y * offset }
    player.body = circleBody(player.position, player.body.radius)
    food.position = { x: middle.x - normal.x * offset, y: middle.y - normal.y * offset }
    food.body = circleBody(food.position, food.body.radius)
    food.materializingUntilMs = -1
    engine.input.start({ x: 0, y: 0 })
    engine.input.move({ x: -normal.x * 120, y: -normal.y * 120 })
    engine.start()
    const events = []
    for (let frame = 0; frame < 300; frame += 1) {
      engine.advance(1000 / 60)
      events.push(...engine.drainEvents())
      if (events.some((event) => event.type === 'engulfed' && event.preyId === food.id)) break
    }
    expect(events).toContainEqual(expect.objectContaining({ type: 'engulfed', predatorId: player.id, preyId: food.id }))
    engine.destroy()
  })
})
