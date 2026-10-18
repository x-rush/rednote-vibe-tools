import { describe, expect, it } from 'vitest'
import { createGameEngine } from '../game/engine'
import { circleBody } from './fixtures'
import { setPolicyIntent } from './playthrough'
import { createBuildState } from '../evolution/build'

function scene(faction: 'neutral' | 'hostile') {
    const engine = createGameEngine({ seed: 727, initialLifecycle: { tierIndex: 2 } })
    const entities = engine.renderSnapshot().entities
    const player = entities.find((entity) => entity.id === 'player')!
    const [broadPrey, food] = entities.filter((entity) => entity.faction !== 'player')
    for (const entity of entities) if (entity.id !== player.id && entity !== broadPrey && entity !== food) entity.status = 'engulfed'
    player.velocity = { x: 100, y: 0 }
    broadPrey!.role = 'competitor'
    broadPrey!.faction = faction
    broadPrey!.behaviorState = 'recover'
    broadPrey!.position = { x: player.position.x + 180, y: player.position.y }
    broadPrey!.body = circleBody(broadPrey!.position, 70)
    food!.role = 'nutrient'
    food!.position = { x: player.position.x, y: player.position.y + 200 }
    food!.body = circleBody(food!.position, 4)
    engine.input.start({ x: 0, y: 0 })
    return { engine, broadPrey: broadPrey! }
}

describe('normal playthrough steering', () => {
  it.each(['neutral', 'hostile'] as const)('hunts fitting food rather than an inedible %s body that cannot engulf the player', (faction) => {
    const { engine } = scene(faction)
    setPolicyIntent(engine, 0, 'balanced')
    expect(engine.input.snapshot().direction.y).toBeGreaterThan(0.9)
    expect(Math.abs(engine.input.snapshot().direction.x)).toBeLessThan(0.1)
  })

  it('respects a live spine pulse even while the predator recovers from movement', () => {
    const { engine, broadPrey } = scene('hostile')
    Object.assign(broadPrey, { contactDamage: { source: 'spine', amount: 11, periodMs: 1000, activeMs: 500, phaseOffsetMs: 0 } })
    setPolicyIntent(engine, 0, 'balanced')
    expect(engine.input.snapshot().direction.x).toBeLessThan(-0.9)
  })

  it('sidesteps a committed burst instead of retreating along its charge line', () => {
    const { engine, broadPrey } = scene('hostile')
    Object.assign(broadPrey, { behaviorState: 'ambush', behaviorDirection: { x: -1, y: 0 }, contactDamage: { source: 'spine', amount: 11, periodMs: 1000, activeMs: 500, phaseOffsetMs: 0 } })
    setPolicyIntent(engine, 0, 'balanced')
    expect(Math.abs(engine.input.snapshot().direction.y)).toBeGreaterThan(0.9)
    expect(Math.abs(engine.input.snapshot().direction.x)).toBeLessThan(0.3)
  })

  it('releases movement for an eligible real split to fuse, then resumes the pointer afterward', () => {
    const engine = createGameEngine({ seed: 727 })
    engine.applyEvolution(createBuildState({ traitIds: ['organelle-division-ring'] }))
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    player.mass = 320
    for (const entity of engine.renderSnapshot().entities) if (entity.faction !== 'player') entity.status = 'engulfed'
    engine.start()
    engine.input.start({ x: 0, y: 0 })
    engine.input.move({ x: 100, y: 0 })
    for (let frame = 0; frame < 365; frame += 1) engine.advance(1000 / 60)
    expect(engine.snapshot().swarm?.bodyCount).toBe(2)
    setPolicyIntent(engine, engine.snapshot().elapsedMs, 'balanced')
    expect(engine.input.snapshot().strength).toBe(0)
    for (let frame = 0; frame < 90; frame += 1) engine.advance(1000 / 60)
    expect(engine.snapshot().swarm).toBeUndefined()
    setPolicyIntent(engine, engine.snapshot().elapsedMs, 'balanced')
    expect(engine.input.snapshot().strength).toBeGreaterThan(0)
  })

  it.each(['fiber', 'chamber-wall'] as const)('treats a %s according to actual permeability when selecting a meal', (kind) => {
    const { engine, broadPrey } = scene('neutral')
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    broadPrey.role = 'nutrient'
    broadPrey.body = circleBody(broadPrey.position, 4)
    engine.renderSnapshot().environmentField.obstacles.push({ id: 'test-obstacle', kind, adhesive: kind === 'fiber',
      from: { x: player.position.x + 90, y: player.position.y - 80 }, to: { x: player.position.x + 90, y: player.position.y + 80 } })
    setPolicyIntent(engine, 0, 'balanced')
    const direction = engine.input.snapshot().direction
    expect(kind === 'fiber' ? direction.x : direction.y).toBeGreaterThan(0.9)
    expect(Math.abs(kind === 'fiber' ? direction.y : direction.x)).toBeLessThan(0.1)
  })
})
