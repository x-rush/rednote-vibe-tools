import { describe, expect, it } from 'vitest'
import type { Particle, ParticleWorld } from './system'
import { drawInterior, particleColor, sampleImpactFragment } from './renderer'

function hero(): Particle {
  const position = { x: 210, y: 560 }
  return {
    id: 3, kind: 'hero', space: 'inside', position, previous: position,
    velocity: { x: -10, y: 20 }, ageMs: 500, spawnAtMs: 0, lifetimeMs: 9000,
    history: [position], radius: 4, twinklePhase: 0, settleTarget: { x: 180, y: 700 }, opacity: 1,
  }
}

function recordingContext() {
  const calls = { fills: 0, strokes: 0, arcs: 0, ellipses: 0, shadowBlurs: [] as number[] }
  const context = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    fill() { calls.fills += 1 }, stroke() { calls.strokes += 1 },
    arc() { calls.arcs += 1 }, ellipse() { calls.ellipses += 1 },
    set shadowBlur(value: number) { calls.shadowBlurs.push(value) },
    get shadowBlur() { return calls.shadowBlurs.at(-1) ?? 0 },
  } as unknown as CanvasRenderingContext2D
  return { context, calls }
}

describe('particle rendering', () => {
  it('keeps hero stars mostly silver-white with only occasional warm gold', () => {
    expect(particleColor({ ...hero(), id: 9 }, 'dream')).toBe('#ffe6a3')
    expect(particleColor({ ...hero(), id: 10 }, 'dream')).toBe('#f4f7ff')
    expect(particleColor({ ...hero(), id: 11, kind: 'trail' }, 'hope')).toBe('#dce9ff')
  })

  it('draws hero stars with layered bloom and two-axis flare detail', () => {
    const { context, calls } = recordingContext()
    const world: ParticleWorld = {
      particles: [hero()], quality: 'full', mood: 'dream', nextId: 4,
      nextEmissionAtMs: 6500, emissionIndex: 0,
    }
    drawInterior(context, world)
    expect(calls.fills).toBeGreaterThanOrEqual(3)
    expect(calls.strokes).toBeGreaterThanOrEqual(2)
    expect(calls.arcs).toBeGreaterThanOrEqual(2)
  })

  it('anchors a landed core and bursts it into fine iron-flower sparks without a moving ring', () => {
    const { context, calls } = recordingContext()
    const landed = {
      ...hero(), space: 'landed' as const, position: { x: 180, y: 704 }, previous: { x: 180, y: 704 },
      settleTarget: { x: 180, y: 704 }, enteredAtMs: 0, ageMs: 2250,
    }
    drawInterior(context, {
      particles: [landed], quality: 'full', mood: 'dream', nextId: 4,
      nextEmissionAtMs: 6500, emissionIndex: 0,
    })
    expect(calls.arcs).toBeGreaterThanOrEqual(14)
    expect(calls.ellipses).toBe(0)
    expect(Math.min(...calls.shadowBlurs)).toBeLessThanOrEqual(4)
  })

  it('lets an impact fragment hit the floor, rebound, and finally settle', () => {
    const origin = { x: 180, y: 704 }
    const launch = sampleImpactFragment(3, 0, 0, origin)
    const airborne = sampleImpactFragment(3, 0, 190, origin)
    const firstImpact = sampleImpactFragment(3, 0, 380, origin)
    const rebound = sampleImpactFragment(3, 0, 470, origin)
    const settled = sampleImpactFragment(3, 0, 760, origin)

    expect(launch.position).toEqual(origin)
    expect(airborne.position.y).toBeLessThan(origin.y - 8)
    expect(firstImpact.position.y).toBe(origin.y)
    expect(rebound.position.y).toBeLessThan(origin.y)
    expect(settled.position.y).toBe(origin.y)
    expect(settled.opacity).toBe(0)
  })
})
