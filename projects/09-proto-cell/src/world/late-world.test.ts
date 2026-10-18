import { describe, expect, it } from 'vitest'
import { createEnvironmentField, resolveEnvironmentMovement, sampleEnvironmentField, stepEnvironmentField } from './environments'
import { stepFiberTerrain } from './mastery'
import { getContent } from '../content'
import { worldDimensionsForTier } from './scale-world'
describe('deep chamber terrain', () => {
  it('keeps each moving plate inside the world and at its own depth', () => {
    const field = createEnvironmentField('env-abandoned-chamber', 727)
    const world = worldDimensionsForTier(getContent().scaleTiers[2]!)
    for (const atMs of [0, 1000, 8000]) {
      const next = stepEnvironmentField(field, atMs)
      expect(new Set(next.obstacles.map((wall) => Math.round(wall.from.y))).size).toBe(3)
      for (const wall of next.obstacles) for (const point of [wall.from, wall.to]) {
        expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(world.width)
        expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(world.height)
      }
    }
  })
  it('offers open lanes to young ciliates and local mature wall breaches', () => {
    const field = createEnvironmentField('env-abandoned-chamber', 727)
    const wall = field.obstacles[0]!
    const gap = wall.gaps![0]!
    const x = wall.from.x + (wall.to.x - wall.from.x) * (gap.fromT + gap.toT) / 2
    const through = { x, y: wall.from.y - 95 }
    expect(resolveEnvironmentMovement(field, { x, y: wall.from.y + 95 }, through, 88)).toEqual(through)
    const solidX = wall.from.x + 220
    const body = { position: { x: solidX, y: wall.from.y + 155 }, radius: 150, pushing: true }
    expect(sampleEnvironmentField(field, body.position, body.radius).blocked).toBe(true)
    const broken = stepFiberTerrain(field, [body], 620, 620)
    expect(broken.breaks).toHaveLength(1)
    expect(sampleEnvironmentField(broken.field, body.position, body.radius).blocked).toBe(false)
  })
})
