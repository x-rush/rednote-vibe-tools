import { describe, expect, it } from 'vitest'
import { getContent, type EnvironmentId } from '../content'
import { analyzeGeneratedRegion, generateRunRoute } from './generator'
import { applyEventWorldEffects, createEnvironmentField, resolveEnvironmentMovement, sampleEnvironmentField, stepEnvironmentField } from './environments'
import { startEvent, stepEvent } from './events'

describe('launch environments', () => {
  it.each(getContent().environments.map((item) => item.id))('%s has a reachable exit', (environmentId) => {
    expect(analyzeGeneratedRegion(727, environmentId).reachableExitCount).toBeGreaterThan(0)
  })

  it('builds the four-region route in launch order', () => {
    const route = generateRunRoute(727)
    expect(route).toHaveLength(4)
    expect(route[0]).toBe('env-clear-drop')
    expect(['env-algae-glow', 'env-acid-vesicle']).toContain(route[1])
    expect(['env-fiber-maze', 'env-antibody-storm']).toContain(route[2])
    expect(route[3]).toBe('env-abandoned-chamber')
  })

  it.each([
    ['env-algae-glow', 'hazard-light-pulse'],
    ['env-acid-vesicle', 'hazard-acid-discharge'],
    ['env-fiber-maze', 'hazard-fiber-anchor'],
    ['env-antibody-storm', 'hazard-antibody-sweep'],
    ['env-abandoned-chamber', 'hazard-chamber-drain'],
  ] as Array<[EnvironmentId, string]>)('%s telegraphs %s before activation', (environmentId, hazardId) => {
    const field = createEnvironmentField(environmentId, 727, 10_000)
    const cue = field.telegraphs.find((item) => item.hazardId === hazardId)
    expect(cue).toBeDefined()
    expect(stepEnvironmentField(field, cue!.activatesAtMs - 1).activeHazardIds).not.toContain(hazardId)
    expect(stepEnvironmentField(field, cue!.activatesAtMs).activeHazardIds).toContain(hazardId)
  })

  it('shows the future acid safe geometry before outside damage activates', () => {
    const field = createEnvironmentField('env-acid-vesicle', 727, 10_000)
    const cue = field.telegraphs[0]!
    const preview = stepEnvironmentField(field, cue.activatesAtMs - 1)
    const active = stepEnvironmentField(field, cue.activatesAtMs)

    expect(preview.safeCenters).toHaveLength(1)
    expect(sampleEnvironmentField(preview, preview.safeCenters[0]!, 10).damage).toBe(0)
    expect(active.safeCenters[0]).toMatchObject({
      x: expect.closeTo(preview.safeCenters[0]!.x, 0),
      y: expect.closeTo(preview.safeCenters[0]!.y, 0),
    })
    expect(sampleEnvironmentField(active, active.hazardCenters['hazard-acid-discharge']!, 10).damage).toBeGreaterThan(0)
  })

  it('moves acid safety geometry deterministically and exposes adhesive fiber collision', () => {
    const acid = createEnvironmentField('env-acid-vesicle', 727, 0)
    const first = stepEnvironmentField(acid, 3000)
    const second = stepEnvironmentField(acid, 6000)
    const repeated = stepEnvironmentField(createEnvironmentField('env-acid-vesicle', 727, 0), 6000)

    expect(second.safeCenters).not.toEqual(first.safeCenters)
    expect(second.safeCenters).toEqual(repeated.safeCenters)
    expect(createEnvironmentField('env-fiber-maze', 727).obstacles).toContainEqual(expect.objectContaining({ kind: 'fiber', adhesive: true }))
  })

  it('turns field geometry into movement and damage samples', () => {
    const acid = stepEnvironmentField(createEnvironmentField('env-acid-vesicle', 727), 3000)
    const hazard = Object.values(acid.hazardCenters)[0]!
    const acidSample = sampleEnvironmentField(acid, hazard, 12)
    const safeSample = sampleEnvironmentField(acid, acid.safeCenters[0]!, 12)
    const fiber = stepEnvironmentField(createEnvironmentField('env-fiber-maze', 727), 5000)
    const fiberSample = sampleEnvironmentField(fiber, { x: 320, y: 490 }, 12)

    expect(acidSample.damage).toBeGreaterThan(0)
    expect(safeSample.damage).toBe(0)
    expect(fiberSample.speedMultiplier).toBeLessThan(1)
  })

  it('consumes event world effects while the event is active', () => {
    const started = startEvent('event-giant-passage', {
      seed: 727,
      environmentId: 'env-algae-glow',
      atMs: 1000,
      center: { x: 300, y: 500 },
    })
    const active = stepEvent(started, started.activatesAtMs)
    const base = stepEnvironmentField(createEnvironmentField('env-algae-glow', 727), active.activatesAtMs)
    const changed = applyEventWorldEffects(base, active, active.activatesAtMs)

    expect(changed.visibility).toBeLessThan(base.visibility)
    expect(changed.flow).not.toEqual(base.flow)
  })

  it('makes the fiber sweep harmful outside its moving gap and removes it after expiry', () => {
    const started = startEvent('event-antibody-sweep', {
      seed: 727,
      environmentId: 'env-fiber-maze',
      atMs: 1000,
      center: { x: 300, y: 500 },
    })
    const active = stepEvent(started, started.activatesAtMs)
    const base = stepEnvironmentField(createEnvironmentField('env-fiber-maze', 727), active.activatesAtMs)
    const changed = applyEventWorldEffects(base, active, active.activatesAtMs)
    const cleaned = stepEnvironmentField(changed, active.endsAtMs + 1)

    expect(sampleEnvironmentField(changed, { x: active.center.x - 110, y: active.center.y }, 10).damage).toBeGreaterThan(0)
    expect(sampleEnvironmentField(changed, changed.safeCenters[0]!, 10).damage).toBe(0)
    expect(cleaned.activeHazardIds).not.toContain('event-antibody-sweep')
    expect(cleaned.telegraphs.some((cue) => cue.hazardId === 'event-antibody-sweep')).toBe(false)
  })

  it('blocks crossing a fiber while retaining adhesive slowdown near it', () => {
    const field = createEnvironmentField('env-fiber-maze', 727)
    const from = { x: 310, y: 460 }
    const to = { x: 330, y: 520 }

    expect(resolveEnvironmentMovement(field, from, to, 12)).toEqual(from)
    expect(sampleEnvironmentField(field, { x: 320, y: 490 }, 12).speedMultiplier).toBeLessThan(1)
  })
})
