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
    expect(world.particles.some(({ kind, space }) => kind === 'hero' && (space === 'inside' || space === 'settling'))).toBe(true)
  })
})
