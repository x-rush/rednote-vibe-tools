import { describe, expect, it } from 'vitest'
import { WINDOW_PORTAL, pointInConvexQuad } from '../scene/geometry'
import { createParticleWorld, emptyParticleWorld, particleLimit, resetParticleWorld, stepParticleWorld, type Particle, type ParticleWorld } from './system'

function hero(position = { x: 308, y: 215 }, velocity = { x: -80, y: 110 }): Particle {
  return {
    id: 1,
    kind: 'hero',
    space: 'outside',
    position,
    previous: position,
    velocity,
    ageMs: 0,
    spawnAtMs: 0,
    lifetimeMs: 9000,
    history: [position],
    radius: 4,
    twinklePhase: 0,
    settleTarget: { x: 250, y: 704 },
    opacity: 1,
  }
}

function worldWith(particle: Particle): ParticleWorld {
  return {
    particles: [particle], quality: 'full', mood: 'dream', nextId: 2,
    nextEmissionAtMs: 6500, emissionIndex: 0,
  }
}

describe('particle spatial narrative', () => {
  it('never transfers a hero star before the entry threshold', () => {
    const next = stepParticleWorld(worldWith(hero()), {
      elapsedMs: 1800, deltaMs: 80, entryProgress: 0.39, reducedMotion: false, continuous: false,
    })
    expect(next.particles[0]?.space).toBe('outside')
  })

  it('transfers continuously through the portal and not through the wall', () => {
    const crossing = stepParticleWorld(worldWith(hero()), {
      elapsedMs: 1900, deltaMs: 80, entryProgress: 0.7, reducedMotion: false, continuous: false,
    })
    expect(crossing.particles[0]?.space).toBe('inside')
    expect(crossing.particles[0]?.history.some((point) => pointInConvexQuad(point, WINDOW_PORTAL))).toBe(true)

    const wall = stepParticleWorld(worldWith(hero({ x: 105, y: 210 })), {
      elapsedMs: 1900, deltaMs: 80, entryProgress: 0.7, reducedMotion: false, continuous: false,
    })
    expect(wall.particles[0]?.space).toBe('outside')
  })

  it('clears particles and continuous emission counters on reset', () => {
    const reset = resetParticleWorld({
      ...worldWith(hero()),
      nextEmissionAtMs: 7200,
      emissionIndex: 3,
    })
    expect(reset).toEqual(emptyParticleWorld('full', 'dream'))
  })

  it('keeps visible hero-star entry in the shortened reduced-motion timeline', () => {
    let world = createParticleWorld(42, 'fallback', 'dream')
    for (let elapsedMs = 0; elapsedMs <= 4300; elapsedMs += 20) {
      world = stepParticleWorld(world, {
        elapsedMs, deltaMs: 20, entryProgress: elapsedMs >= 1100 ? 1 : 0, reducedMotion: true, continuous: elapsedMs >= 3000,
      })
    }
    expect(world.particles.some(({ kind, space, opacity }) => (
      kind === 'hero' && space !== 'outside' && opacity > 0.05
    ))).toBe(true)
  })

  it('maps the reduced result boundary to the complete landing narrative', () => {
    const lateHero = {
      ...hero({ x: 240, y: 520 }, { x: -8, y: 18 }),
      space: 'inside' as const,
      spawnAtMs: 5000,
      enteredAtMs: 5000,
    }
    const result = stepParticleWorld(worldWith(lateHero), {
      elapsedMs: 3000, deltaMs: 20, entryProgress: 1, reducedMotion: true, continuous: true,
    })
    expect(result.particles[0]?.space).toBe('settling')
  })

  it('lands hero stars on the room floor before they dissipate', () => {
    const landedHero = { ...hero({ x: 250, y: 704 }, { x: -4, y: 8 }), space: 'inside' as const, spawnAtMs: 1500 }
    const landed = stepParticleWorld(worldWith(landedHero), {
      elapsedMs: 4020, deltaMs: 20, entryProgress: 1, reducedMotion: false, continuous: false,
    })
    const dissipating = stepParticleWorld(landed, {
      elapsedMs: 4440, deltaMs: 420, entryProgress: 1, reducedMotion: false, continuous: false,
    })

    expect(landed.particles[0]?.space).toBe('landed')
    expect(dissipating.particles[0]?.space).toBe('dissipating')
  })

  it('stagger-lands the generated star group so the finale includes visible dissipation', () => {
    let world = createParticleWorld(42, 'full', 'hope')
    for (let elapsedMs = 0; elapsedMs <= 7500; elapsedMs += 20) {
      world = stepParticleWorld(world, {
        elapsedMs, deltaMs: 20, entryProgress: elapsedMs >= 1500 ? 1 : 0, reducedMotion: false, continuous: elapsedMs >= 6500,
      })
    }
    const heroSpaces = world.particles.filter(({ kind }) => kind === 'hero').map(({ space }) => space)
    expect(heroSpaces).toContain('dissipating')
    expect(heroSpaces.some((space) => space === 'settling' || space === 'landed')).toBe(true)
  })

  it('continues emitting stars for 60 seconds without exceeding the particle cap', () => {
    let world = createParticleWorld(42, 'full', 'hope')
    let latestSpawn = 0
    for (let elapsedMs = 0; elapsedMs <= 66_500; elapsedMs += 20) {
      world = stepParticleWorld(world, {
        elapsedMs,
        deltaMs: 20,
        entryProgress: elapsedMs >= 1800 ? 1 : 0,
        reducedMotion: false,
        continuous: elapsedMs >= 6500,
      })
      latestSpawn = Math.max(latestSpawn, ...world.particles.map(({ spawnAtMs }) => spawnAtMs))
      expect(world.particles.length).toBeLessThanOrEqual(particleLimit('full'))
    }
    expect(latestSpawn).toBeGreaterThan(60_000)
    expect(world.particles.some(({ space, opacity }) => space !== 'outside' && opacity > 0.05)).toBe(true)
  })

  it('uses a lower result cap for reduced motion', () => {
    expect(particleLimit('fallback')).toBeLessThan(particleLimit('full'))
  })
})
