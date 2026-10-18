import { describe, expect, it } from 'vitest'
import { createEnvironmentField, sampleEnvironmentField, stepEnvironmentField } from './environments'
import { fiberConceals, stepFiberTerrain, territorySightRadius } from './mastery'

function field() {
  return { ...createEnvironmentField('env-fiber-maze', 727), obstacles: [{ id: 'fiber', kind: 'fiber' as const, adhesive: true, from: { x: 0, y: 100 }, to: { x: 1000, y: 100 } }] }
}
describe('world mastery', () => {
  it('offers nearby first-life shelter without slowing the spawn or its opening meals', () => {
    const world = createEnvironmentField('env-clear-drop', 727)
    const spawn = { x: 720, y: 1224 }
    expect(world.obstacles.filter((obstacle) => obstacle.kind === 'fiber').length).toBeGreaterThan(0)
    expect(sampleEnvironmentField(world, spawn, 12).speedMultiplier).toBe(1)
    for (const position of [{ x: 687, y: 1224 }, { x: 753, y: 1224 }, { x: 720, y: 1191 }]) expect(sampleEnvironmentField(world, position, 12).speedMultiplier).toBe(1)
  })
  it('conceals a smaller body behind a nearby fiber, but not through contact or from the same side', () => {
    const world = field()
    const prey = { position: { x: 500, y: 120 }, radius: 40 }
    expect(fiberConceals(world, { position: { x: 500, y: -30 }, radius: 60 }, prey)).toBe(true)
    expect(fiberConceals(world, { position: { x: 500, y: 200 }, radius: 60 }, prey)).toBe(false)
    expect(fiberConceals(world, { position: { x: 500, y: 80 }, radius: 60 }, prey)).toBe(false)
    expect(fiberConceals(world, { position: { x: 500, y: -30 }, radius: 60 }, { ...prey, radius: 64 })).toBe(false)
  })
  it('provides cover throughout the hunters actual smaller-prey acquisition range', () => {
    const observer = { position: { x: 500, y: -30 }, radius: 50 }
    expect(fiberConceals(field(), observer, { position: { x: 500, y: 120 }, radius: 44 })).toBe(true)
    expect(fiberConceals(field(), observer, { position: { x: 500, y: 120 }, radius: 46 })).toBe(false)
  })
  it('requires mature size and sustained active pressure before opening a local gap', () => {
    const body = { position: { x: 500, y: 120 }, radius: 64, pushing: true }
    const early = stepFiberTerrain(field(), [body], 200, 200)
    expect(early.breaks).toEqual([])
    const broken = stepFiberTerrain(early.field, [body], 240, 440)
    expect(broken.breaks).toHaveLength(1)
    expect(sampleEnvironmentField(broken.field, body.position, 12).speedMultiplier).toBe(1)
    expect(sampleEnvironmentField(broken.field, { x: 100, y: 100 }, 12).speedMultiplier).toBeLessThan(1)
    expect(fiberConceals(broken.field, { position: { x: 500, y: -30 }, radius: 60 }, { position: body.position, radius: 40 })).toBe(false)
    expect(stepFiberTerrain(broken.field, [body], 1000, 1440).breaks).toEqual([])
    expect(sampleEnvironmentField(stepEnvironmentField(broken.field, 9000), body.position, 12).speedMultiplier).toBe(1)
    expect(sampleEnvironmentField(field(), body.position, 12).speedMultiplier).toBeLessThan(1)
  })
  it('does not break fibers when small, idle or no longer in contact, and never breaks a chamber wall', () => {
    const body = { position: { x: 500, y: 120 }, radius: 40, pushing: true }
    expect(stepFiberTerrain(field(), [body], 1000, 1000).breaks).toEqual([])
    expect(stepFiberTerrain(field(), [{ ...body, radius: 64, pushing: false }], 1000, 1000).breaks).toEqual([])
    const pressed = stepFiberTerrain(field(), [{ ...body, radius: 64 }], 200, 200)
    const away = stepFiberTerrain(pressed.field, [{ ...body, radius: 64, position: { x: 500, y: 400 } }], 300, 500)
    expect(stepFiberTerrain(away.field, [{ ...body, radius: 64 }], 200, 700).breaks).toEqual([])
    const walls = { ...field(), obstacles: [{ ...field().obstacles[0]!, kind: 'chamber-wall' as const }] }
    expect(stepFiberTerrain(walls, [{ ...body, radius: 176 }], 1000, 1000).breaks).toEqual([])
  })
  it('expands real sight with growth and respects visibility', () => {
    const juvenile = territorySightRadius(0, 0, 12, 1)
    const mature = territorySightRadius(1, 1, 64, 1)
    const evolved = territorySightRadius(2, 1, 176, 1)
    expect(mature).toBeGreaterThan(juvenile * 5)
    expect(evolved).toBeGreaterThan(mature * 3)
    expect(territorySightRadius(1, 1, 64, 0.5)).toBeCloseTo(mature * 0.5)
  })
  it('merges overlapping gaps without mutating the prior terrain snapshot', () => {
    const first = stepFiberTerrain(field(), [{ position: { x: 500, y: 120 }, radius: 64, pushing: true }], 440, 440)
    const original = structuredClone(first.field.obstacles[0]!.gaps)
    const next = stepFiberTerrain(first.field, [{ position: { x: 600, y: 120 }, radius: 64, pushing: true }], 440, 880)
    expect(next.field.obstacles[0]!.gaps).toHaveLength(1)
    expect(next.field.obstacles[0]!.gaps![0]!.toT).toBeGreaterThan(original![0]!.toT)
    expect(first.field.obstacles[0]!.gaps).toEqual(original)
  })
})
