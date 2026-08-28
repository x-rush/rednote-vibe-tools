import { describe, expect, it } from 'vitest'
import { createTestEngine } from '../tests/fixtures'
import { createEntity } from '../entities/factory'
import { contactDamageAt, contactDamageForPair, runStableEntityPass } from './engine'

describe('game engine lifecycle', () => {
  it('does not advance while paused', () => {
    const engine = createTestEngine()
    engine.pause('visibility')
    engine.advance(1000)

    expect(engine.snapshot().elapsedMs).toBe(0)
  })

  it('advances in fixed steps only after start and resume', () => {
    const engine = createTestEngine()
    engine.advance(1000 / 30)
    const elapsed = engine.snapshot().elapsedMs
    engine.pause('user')
    engine.advance(100)
    engine.resume('user')
    engine.advance(1000 / 60)

    expect(elapsed).toBeCloseTo(1000 / 30)
    expect(engine.snapshot().elapsedMs).toBeCloseTo(50)
  })

  it('keeps momentum after release and turns through acceleration', () => {
    const engine = createTestEngine()
    engine.input.move({ x: 120, y: 0 }, { x: 0, y: 0 })
    engine.advance(100)
    const movingVelocity = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')?.velocity.x ?? 0

    engine.input.end()
    engine.advance(1000 / 60)
    const releasedVelocity = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')?.velocity.x ?? 0

    engine.input.move({ x: -120, y: 0 }, { x: 0, y: 0 })
    engine.advance(1000 / 60)
    const turningVelocity = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')?.velocity.x ?? 0

    expect(movingVelocity).toBeGreaterThan(0)
    expect(releasedVelocity).toBeGreaterThan(0)
    expect(releasedVelocity).toBeLessThan(movingVelocity)
    expect(turningVelocity).toBeGreaterThan(-96)
  })

  it('exposes configured contact damage only inside its pulse window', () => {
    const predator = createEntity({
      id: 'predator-test',
      role: 'predator',
      faction: 'hostile',
      radius: 20,
      mass: 400,
      membrane: 50,
      energy: 50,
      maxSpeed: 40,
      visualRecipeId: 'visual-predator-test',
      contactDamage: { source: 'spine', amount: 8, periodMs: 1600, activeMs: 240, phaseOffsetMs: 0 },
    }, { id: 'predator', position: { x: 0, y: 0 } })

    expect(contactDamageAt(predator, 100)).toEqual({ source: 'spine', amount: 8, periodIndex: 0 })
    expect(contactDamageAt(predator, 500)).toBeUndefined()
    expect(contactDamageAt(predator, 1700)).toEqual({ source: 'spine', amount: 8, periodIndex: 1 })
  })

  it('does not recursively damage edible rupture fragments', () => {
    const predator = createEntity({
      id: 'predator-test',
      role: 'predator',
      faction: 'hostile',
      radius: 20,
      mass: 400,
      membrane: 50,
      energy: 50,
      maxSpeed: 40,
      visualRecipeId: 'visual-predator-test',
      contactDamage: { source: 'spine', amount: 8, periodMs: 1600, activeMs: 240, phaseOffsetMs: 0 },
    }, { id: 'predator', position: { x: 0, y: 0 } })
    const fragment = createEntity({
      id: 'fragment-test',
      role: 'fragment',
      faction: 'neutral',
      radius: 2,
      mass: 4,
      membrane: 1,
      energy: 0,
      maxSpeed: 0,
      visualRecipeId: 'visual-fragment-test',
    }, { id: 'fragment', position: { x: 20, y: 0 } })

    expect(contactDamageForPair(predator, fragment, 100, new Map())).toBeUndefined()
  })

  it('arms newly spawned contact damage only after its telegraph lead', () => {
    const predator = createEntity({
      id: 'predator-test',
      role: 'predator',
      faction: 'hostile',
      radius: 20,
      mass: 400,
      membrane: 50,
      energy: 50,
      maxSpeed: 40,
      visualRecipeId: 'visual-predator-test',
      contactDamage: { source: 'spine', amount: 8, periodMs: 1600, activeMs: 240, phaseOffsetMs: 0 },
    }, { id: 'predator', position: { x: 0, y: 0 }, spawnedAtMs: 45_000 })
    const prey = createEntity({
      id: 'prey-test',
      role: 'prey',
      faction: 'neutral',
      radius: 10,
      mass: 100,
      membrane: 20,
      energy: 20,
      maxSpeed: 30,
      visualRecipeId: 'visual-prey-test',
    }, { id: 'prey', position: { x: 20, y: 0 }, spawnedAtMs: 0 })

    expect(contactDamageForPair(predator, prey, 45_000, new Map())).toBeUndefined()
    expect(contactDamageForPair(predator, prey, 45_419, new Map())).toBeUndefined()
    expect(contactDamageForPair(predator, prey, 45_420, new Map())).toMatchObject({
      damage: { source: 'spine', amount: 8, targetId: 'prey' },
    })
  })

  it('defers entities created during an interaction pass until the pass ends', () => {
    const entities = new Map([['a', { id: 'a' }]])
    const visited: string[] = []

    runStableEntityPass(entities, (entity, enqueue) => {
      visited.push(entity.id)
      enqueue({ id: 'b' })
    })

    expect(visited).toEqual(['a'])
    expect([...entities.keys()]).toEqual(['a', 'b'])
  })
})
