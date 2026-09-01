import { describe, expect, it } from 'vitest'
import { WINDOW_PORTAL, pointInConvexQuad } from '../scene/geometry'
import { createParticleWorld, emptyParticleWorld, resetParticleWorld, stepParticleWorld, type Particle, type ParticleWorld } from './system'

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
  return { particles: [particle], quality: 'full', mood: 'dream', nextId: 2 }
}

describe('particle spatial narrative', () => {
  it('never transfers a hero star before the sash threshold', () => {
    const next = stepParticleWorld(worldWith(hero()), {
      elapsedMs: 4700, deltaMs: 80, sashOpen: 0.39, reducedMotion: false,
    })
    expect(next.particles[0]?.space).toBe('outside')
  })

  it('transfers continuously through the portal and not through the wall', () => {
    const crossing = stepParticleWorld(worldWith(hero()), {
      elapsedMs: 4800, deltaMs: 80, sashOpen: 0.7, reducedMotion: false,
    })
    expect(crossing.particles[0]?.space).toBe('inside')
    expect(crossing.particles[0]?.history.some((point) => pointInConvexQuad(point, WINDOW_PORTAL))).toBe(true)

    const wall = stepParticleWorld(worldWith(hero({ x: 105, y: 210 })), {
      elapsedMs: 4800, deltaMs: 80, sashOpen: 0.7, reducedMotion: false,
    })
    expect(wall.particles[0]?.space).toBe('outside')
  })

  it('clears all particles and generation counters on reset', () => {
    expect(resetParticleWorld(worldWith(hero()))).toEqual(emptyParticleWorld('full', 'dream'))
  })

  it('keeps visible hero-star entry in the shortened reduced-motion timeline', () => {
    let world = createParticleWorld(42, 'fallback', 'dream')
    for (let elapsedMs = 0; elapsedMs <= 4300; elapsedMs += 20) {
      world = stepParticleWorld(world, {
        elapsedMs, deltaMs: 20, sashOpen: elapsedMs >= 2100 ? 1 : 0, reducedMotion: true,
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
      spawnAtMs: 7000,
      enteredAtMs: 7000,
    }
    const result = stepParticleWorld(worldWith(lateHero), {
      elapsedMs: 4300, deltaMs: 20, sashOpen: 1, reducedMotion: true,
    })
    expect(result.particles[0]?.space).toBe('settling')
  })

  it('lands hero stars on the room floor before they dissipate', () => {
    const landedHero = { ...hero({ x: 250, y: 704 }, { x: -4, y: 8 }), space: 'inside' as const, spawnAtMs: 4300 }
    const landed = stepParticleWorld(worldWith(landedHero), {
      elapsedMs: 6820, deltaMs: 20, sashOpen: 1, reducedMotion: false,
    })
    const dissipating = stepParticleWorld(landed, {
      elapsedMs: 7240, deltaMs: 420, sashOpen: 1, reducedMotion: false,
    })

    expect(landed.particles[0]?.space).toBe('landed')
    expect(dissipating.particles[0]?.space).toBe('dissipating')
  })

  it('stagger-lands the generated star group so the finale includes visible dissipation', () => {
    let world = createParticleWorld(42, 'full', 'hope')
    for (let elapsedMs = 0; elapsedMs <= 7500; elapsedMs += 20) {
      world = stepParticleWorld(world, {
        elapsedMs, deltaMs: 20, sashOpen: elapsedMs >= 3900 ? 1 : 0, reducedMotion: false,
      })
    }
    const heroSpaces = world.particles.filter(({ kind }) => kind === 'hero').map(({ space }) => space)
    expect(heroSpaces).toContain('dissipating')
    expect(heroSpaces.some((space) => space === 'settling' || space === 'landed')).toBe(true)
  })
})
