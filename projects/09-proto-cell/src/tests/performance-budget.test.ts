import { describe, expect, it } from 'vitest'
import { createGameEngine } from '../game/engine'
import { SpatialGrid } from '../game/spatial-grid'
import { circleBody, PERFORMANCE_BUDGET } from './fixtures'

describe('launch simulation budget', () => {
  it('keeps 18,000 pressure steps bounded and spatial queries unique', () => {
    const engine = createGameEngine({ seed: 727, environmentId: 'env-algae-glow', modifierIds: ['modifier-alert-predators', 'modifier-elite-ecosystem'] })
    engine.start()
    const player = engine.renderSnapshot().entities.find((entity) => entity.id === 'player')!
    player.mass = 2500
    player.membrane = 1_000_000
    player.body = circleBody(player.position, 50)
    engine.input.start({ x: 0, y: 0 })
    const startedAt = performance.now()
    let maxEntities = 0
    let duplicateIds = false

    for (let step = 0; step < PERFORMANCE_BUDGET.fixedSteps; step += 1) {
      engine.input.move({ x: Math.cos(step / 180) * 120, y: Math.sin(step / 180) * 120 })
      engine.advance(1000 / 60)
      const entities = engine.renderSnapshot().entities
      maxEntities = Math.max(maxEntities, entities.length)
      if (step % 300 === 0) {
        const grid = new SpatialGrid(96)
        entities.forEach((entity) => grid.insert(entity))
        const queried = grid.query({ x: 0, y: 0, width: 640, height: 1100 }).map((entity) => entity.id)
        duplicateIds ||= new Set(queried).size !== queried.length
      }
    }

    const averageUpdateMs = (performance.now() - startedAt) / PERFORMANCE_BUDGET.fixedSteps
    expect(maxEntities).toBeLessThanOrEqual(PERFORMANCE_BUDGET.entityHardCap)
    expect(duplicateIds).toBe(false)
    expect(averageUpdateMs).toBeLessThan(PERFORMANCE_BUDGET.averageUpdateMs)
    engine.destroy()
  }, 20_000)
})
