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

function indoorParticle(kind: Particle['kind']): Particle {
  return {
    ...hero({ x: 208, y: 540 }, { x: -18, y: 46 }),
    id: kind === 'dust' ? 1 : kind === 'trail' ? 2 : 3,
    kind,
    space: 'inside',
    enteredAtMs: 0,
    lifetimeMs: 9000,
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

  it('carries an indoor star along one constant straight velocity instead of easing it downward', () => {
    const particle = indoorParticle('dust')
    const first = stepParticleWorld(worldWith(particle), {
      elapsedMs: 100, deltaMs: 100, entryProgress: 1, reducedMotion: false, continuous: false,
    })
    const second = stepParticleWorld(first, {
      elapsedMs: 200, deltaMs: 100, entryProgress: 1, reducedMotion: false, continuous: false,
    })
    const firstParticle = first.particles[0]
    const secondParticle = second.particles[0]
    if (!firstParticle || !secondParticle) throw new Error('Expected an indoor particle')
    const firstStep = {
      x: firstParticle.position.x - particle.position.x,
      y: firstParticle.position.y - particle.position.y,
    }
    const secondStep = {
      x: secondParticle.position.x - firstParticle.position.x,
      y: secondParticle.position.y - firstParticle.position.y,
    }

    expect(secondStep.x).toBeCloseTo(firstStep.x, 8)
    expect(secondStep.y).toBeCloseTo(firstStep.y, 8)
    expect(firstStep.x).toBeLessThan(-Math.abs(firstStep.y) * 0.35)
  })

  it('does not switch to a timed settling pull before reaching the floor', () => {
    const particle = { ...indoorParticle('hero'), position: { x: 208, y: 300 }, previous: { x: 208, y: 300 } }
    const next = stepParticleWorld(worldWith(particle), {
      elapsedMs: 1500, deltaMs: 20, entryProgress: 1, reducedMotion: false, continuous: false,
    }).particles[0]

    expect(next?.space).toBe('inside')
    expect(next?.position.y).toBeLessThan(310)
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

  it('does not teleport a reduced-motion star to its landing point at the result boundary', () => {
    const lateHero = {
      ...hero({ x: 240, y: 520 }, { x: -8, y: 18 }),
      space: 'inside' as const,
      spawnAtMs: 5000,
      enteredAtMs: 5000,
    }
    const result = stepParticleWorld(worldWith(lateHero), {
      elapsedMs: 3000, deltaMs: 20, entryProgress: 1, reducedMotion: true, continuous: true,
    })
    expect(result.particles[0]?.space).toBe('inside')
    expect(result.particles[0]?.position.y).toBeLessThan(540.5)
  })

  it('lands hero stars on the room floor before they dissipate', () => {
    const landedHero = { ...hero({ x: 250, y: 704 }, { x: -4, y: 8 }), space: 'inside' as const, spawnAtMs: 1500 }
    const landed = stepParticleWorld(worldWith(landedHero), {
      elapsedMs: 4020, deltaMs: 20, entryProgress: 1, reducedMotion: false, continuous: false,
    })
    const dissipating = stepParticleWorld(landed, {
      elapsedMs: 4600, deltaMs: 580, entryProgress: 1, reducedMotion: false, continuous: false,
    })

    expect(landed.particles[0]?.space).toBe('landed')
    expect(dissipating.particles[0]?.space).toBe('dissipating')
  })

  it.each(['dust', 'trail', 'hero'] as const)('stops a %s star at its physical floor crossing instead of sliding across it', (kind) => {
    const approaching = {
      ...indoorParticle(kind),
      position: { x: 180, y: 698 },
      previous: { x: 180, y: 698 },
      velocity: { x: -30, y: 180 },
      settleTarget: { x: 150, y: 704 },
    }
    const landed = stepParticleWorld(worldWith(approaching), {
      elapsedMs: 100, deltaMs: 48, entryProgress: 1, reducedMotion: false, continuous: false,
    })
    const afterImpact = stepParticleWorld(landed, {
      elapsedMs: 220, deltaMs: 120, entryProgress: 1, reducedMotion: false, continuous: false,
    })
    const particle = landed.particles[0]
    const laterParticle = afterImpact.particles[0]

    expect(particle?.position).toEqual(particle?.settleTarget)
    expect(particle?.velocity).toEqual({ x: 0, y: 0 })
    expect(laterParticle?.position).toEqual(particle?.settleTarget)
    expect(laterParticle?.previous).toEqual(particle?.settleTarget)
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
    expect(heroSpaces.some((space) => space === 'inside' || space === 'landed')).toBe(true)
  })

  it('spreads the opening star stream across the full letter-forming scene', () => {
    const world = createParticleWorld(42, 'full', 'dream')
    const dustSpawns = world.particles.filter(({ kind }) => kind === 'dust').map(({ spawnAtMs }) => spawnAtMs)
    const trailSpawns = world.particles.filter(({ kind }) => kind === 'trail').map(({ spawnAtMs }) => spawnAtMs)

    expect(Math.max(...dustSpawns)).toBeGreaterThan(5000)
    expect(Math.max(...trailSpawns)).toBeGreaterThan(5000)
  })

  it('front-loads a fast opening star surge before settling into a softer stream', () => {
    const world = createParticleWorld(42, 'full', 'dream')
    const dust = world.particles.filter(({ kind }) => kind === 'dust')
    const surge = dust.filter(({ spawnAtMs }) => spawnAtMs < 2800)
    const later = dust.filter(({ spawnAtMs }) => spawnAtMs >= 3200)
    const speed = (particle: Particle) => Math.hypot(particle.velocity.x, particle.velocity.y)

    expect(surge.length).toBeGreaterThan(later.length)
    expect(Math.min(...surge.map(speed))).toBeGreaterThan(Math.max(...later.map(speed)) * 0.82)
  })

  it('draws the opening surge from the upper window and sends it deeper into the room', () => {
    const world = createParticleWorld(42, 'full', 'dream')
    const surge = world.particles.filter(({ spawnAtMs }) => spawnAtMs < 2800)
    const later = world.particles.filter(({ spawnAtMs }) => spawnAtMs >= 3200)
    const upperRatio = surge.filter(({ position }) => position.y < 340).length / surge.length
    const surgeReach = Math.min(...surge.map(({ settleTarget }) => settleTarget.x))
    const laterReach = Math.min(...later.map(({ settleTarget }) => settleTarget.x))

    expect(upperRatio).toBeGreaterThan(0.82)
    expect(surgeReach).toBeLessThan(laterReach - 24)
  })

  it('keeps a dense reference-like mix of fine stars and short light trails', () => {
    const world = createParticleWorld(42, 'full', 'dream')
    expect(world.particles.length).toBeGreaterThanOrEqual(190)
    expect(world.particles.filter(({ kind }) => kind === 'trail')).toHaveLength(42)
    expect(Math.max(...world.particles.filter(({ kind }) => kind === 'hero').map(({ radius }) => radius))).toBeLessThan(3)
    expect(particleLimit('full')).toBeGreaterThanOrEqual(210)
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
