import type { Mood } from '../content/messages'
import { createMulberry32 } from '../domain/random'
import { timelineDuration } from '../experience/timeline'
import { WINDOW_PORTAL, crossesPortal, type Point } from '../scene/geometry'

export type ParticleKind = 'dust' | 'trail' | 'hero'
export type ParticleSpace = 'outside' | 'crossing' | 'inside' | 'settling' | 'landed' | 'dissipating'
export type ParticleQuality = 'full' | 'fallback'

export interface Particle {
  readonly id: number
  readonly kind: ParticleKind
  readonly space: ParticleSpace
  readonly position: Point
  readonly previous: Point
  readonly velocity: Point
  readonly ageMs: number
  readonly spawnAtMs: number
  readonly lifetimeMs: number
  readonly history: readonly Point[]
  readonly radius: number
  readonly twinklePhase: number
  readonly settleTarget: Point
  readonly opacity: number
  readonly enteredAtMs?: number
  readonly landedAtMs?: number
}

export interface ParticleWorld {
  readonly particles: readonly Particle[]
  readonly quality: ParticleQuality
  readonly mood: Mood
  readonly nextId: number
  readonly nextEmissionAtMs: number
  readonly emissionIndex: number
}

export interface ParticleStepInput {
  readonly elapsedMs: number
  readonly deltaMs: number
  readonly entryProgress: number
  readonly reducedMotion: boolean
  readonly continuous: boolean
}

const counts = {
  full: { dust: 146, trail: 42, hero: 10 },
  fallback: { dust: 38, trail: 11, hero: 6 },
} as const

const limits = { full: 216, fallback: 68 } as const
const resultIntervals = { full: 760, fallback: 1500 } as const
const clamp = (value: number) => Math.min(1, Math.max(0, value))

const landingProfiles = {
  dust: { settleAfterMs: 450, impactAfterMs: 780, holdMs: 160, fadeMs: 520 },
  trail: { settleAfterMs: 650, impactAfterMs: 1120, holdMs: 220, fadeMs: 600 },
  hero: { settleAfterMs: 1250, impactAfterMs: 2100, holdMs: 500, fadeMs: 520 },
} as const

export function particleImpactDelay(kind: ParticleKind) {
  return landingProfiles[kind].impactAfterMs
}

export function particleLimit(quality: ParticleQuality) {
  return limits[quality]
}

function flightVelocity(start: Point, target: Point, durationMs: number): Point {
  const seconds = durationMs / 1000
  return {
    x: (target.x - start.x) / seconds,
    y: (target.y - start.y) / seconds,
  }
}

function openingFlightDuration(kind: ParticleKind, surge: boolean, variation: number) {
  const base = surge
    ? kind === 'trail' ? 1180 : kind === 'dust' ? 1480 : 1720
    : kind === 'trail' ? 2200 : kind === 'dust' ? 2700 : 3000
  return base * (0.9 + variation * 0.2)
}

function resultStart(quality: ParticleQuality) {
  return timelineDuration(quality === 'fallback')
}

function openingSpawnAt(kind: ParticleKind, index: number, count: number) {
  const surgeCount = Math.max(1, Math.round(count * 0.64))
  const kindOffset = kind === 'dust' ? 0 : kind === 'trail' ? 180 : 320
  if (index < surgeCount) {
    const ratio = index / Math.max(1, surgeCount - 1)
    return 980 + kindOffset + ratio ** 1.35 * 1450
  }
  const ratio = (index - surgeCount) / Math.max(1, count - surgeCount - 1)
  return 3050 + kindOffset * 0.35 + ratio ** 1.12 * 2650
}

export function emptyParticleWorld(quality: ParticleQuality, mood: Mood): ParticleWorld {
  return {
    particles: [], quality, mood, nextId: 0,
    nextEmissionAtMs: resultStart(quality), emissionIndex: 0,
  }
}

export function createParticleWorld(seed: number, quality: ParticleQuality, mood: Mood): ParticleWorld {
  const random = createMulberry32(seed)
  const particles: Particle[] = []
  let id = 0
  const add = (kind: ParticleKind, count: number) => {
    const surgeCount = Math.max(1, Math.round(count * 0.64))
    for (let index = 0; index < count; index += 1) {
      const ratio = random()
      const surge = index < surgeCount
      const x = surge ? 230 + random() * 96 : 236 + random() * 96
      const y = surge ? 176 + random() * 130 : 274 + random() * 134
      const spawnAtMs = openingSpawnAt(kind, index, count)
      const settleTarget = {
        x: (surge ? 24 : 118) + ratio * (surge ? 190 : 105),
        y: 604 + (index % 3) * 22 + random() * 12,
      }
      const velocity = flightVelocity(
        { x, y },
        settleTarget,
        openingFlightDuration(kind, surge, random()),
      )
      particles.push({
        id,
        kind,
        space: 'outside',
        position: { x, y },
        previous: { x, y },
        velocity,
        ageMs: -spawnAtMs,
        spawnAtMs,
        lifetimeMs: kind === 'hero' ? 9000 : kind === 'trail' ? 4400 : 3800,
        history: [{ x, y }],
        radius: kind === 'hero' ? 1.3 + random() * 1.5 : kind === 'trail' ? 0.55 + random() * 0.45 : 0.25 + random() * 0.42,
        twinklePhase: random() * Math.PI * 2,
        settleTarget,
        opacity: 1,
      })
      id += 1
    }
  }
  add('dust', counts[quality].dust)
  add('trail', counts[quality].trail)
  add('hero', counts[quality].hero)
  return {
    particles, quality, mood, nextId: id,
    nextEmissionAtMs: resultStart(quality), emissionIndex: 0,
  }
}

function createResultBatch(
  startId: number,
  emissionIndex: number,
  spawnAtMs: number,
  quality: ParticleQuality,
  mood: Mood,
): readonly Particle[] {
  const random = createMulberry32(0x71a9 + startId * 17 + emissionIndex * 101)
  const particles: Particle[] = []
  const distribution = quality === 'full'
    ? { dust: 6, trail: 2, hero: emissionIndex % 3 === 2 ? 1 : 0 }
    : { dust: 3, trail: 1, hero: emissionIndex % 4 === 3 ? 1 : 0 }
  let id = startId
  const add = (kind: ParticleKind, count: number) => {
    for (let index = 0; index < count; index += 1) {
      const ratio = random()
      const x = 228 + random() * 106
      const y = 184 + random() * 226
      const moodLift = mood === 'hope' ? 0.08 : mood === 'calm' ? -0.04 : 0
      const settleTarget = {
        x: 104 + ratio * 116,
        y: 604 + ((emissionIndex + index) % 3) * 22 + random() * 12,
      }
      const duration = openingFlightDuration(kind, false, random()) / (1 + moodLift)
      particles.push({
        id,
        kind,
        space: 'outside',
        position: { x, y },
        previous: { x, y },
        velocity: flightVelocity({ x, y }, settleTarget, duration),
        ageMs: 0,
        spawnAtMs,
        lifetimeMs: kind === 'hero' ? 9000 : kind === 'trail' ? 4600 : 4000,
        history: [{ x, y }],
        radius: kind === 'hero' ? 1.3 + random() * 1.5 : kind === 'trail' ? 0.55 + random() * 0.45 : 0.25 + random() * 0.4,
        twinklePhase: random() * Math.PI * 2,
        settleTarget,
        opacity: 1,
      })
      id += 1
    }
  }
  add('dust', distribution.dust)
  add('trail', distribution.trail)
  add('hero', distribution.hero)
  return particles
}

function mappedElapsedMs(elapsedMs: number, reducedMotion: boolean) {
  if (!reducedMotion) return elapsedMs
  const reducedTotal = timelineDuration(true)
  const fullTotal = timelineDuration(false)
  return Math.min(elapsedMs, reducedTotal) * (fullTotal / reducedTotal)
    + Math.max(0, elapsedMs - reducedTotal)
}

export function stepParticleWorld(world: ParticleWorld, input: ParticleStepInput): ParticleWorld {
  const seconds = Math.min(48, Math.max(0, input.deltaMs)) / 1000
  const motionScale = input.reducedMotion ? 0.58 : 1
  const narrativeElapsed = mappedElapsedMs(input.elapsedMs, input.reducedMotion)
  let particles = world.particles.filter((particle) => {
    const ageMs = narrativeElapsed - particle.spawnAtMs
    return ageMs <= particle.lifetimeMs && !(particle.space === 'dissipating' && particle.opacity <= 0)
  }).map((particle) => {
    const ageMs = narrativeElapsed - particle.spawnAtMs
    if (ageMs < 0 || ageMs > particle.lifetimeMs) return { ...particle, ageMs }
    const frozen = particle.space === 'landed' || particle.space === 'dissipating'
    const previous = frozen ? particle.settleTarget : particle.position
    let position = frozen ? particle.settleTarget : {
      x: previous.x + particle.velocity.x * seconds * motionScale,
      y: previous.y + particle.velocity.y * seconds * motionScale,
    }
    let velocity = frozen ? { x: 0, y: 0 } : particle.velocity
    let space = particle.space
    let enteredAtMs = particle.enteredAtMs
    let landedAtMs = particle.landedAtMs
    let settleTarget = particle.settleTarget
    if (space === 'outside' && input.entryProgress >= 0.55 && crossesPortal(previous, position, WINDOW_PORTAL)) {
      space = 'inside'
      enteredAtMs = narrativeElapsed
    }
    let opacity = particle.opacity
    const landing = landingProfiles[particle.kind]
    if ((space === 'inside' || space === 'settling') && position.y >= settleTarget.y) {
      const verticalTravel = position.y - previous.y
      const impactProgress = verticalTravel > 0
        ? clamp((settleTarget.y - previous.y) / verticalTravel)
        : 0
      settleTarget = {
        x: previous.x + (position.x - previous.x) * impactProgress,
        y: settleTarget.y,
      }
      position = settleTarget
      space = 'landed'
      landedAtMs = narrativeElapsed - input.deltaMs * (1 - impactProgress)
    }
    if (space === 'landed' || space === 'dissipating') {
      landedAtMs ??= narrativeElapsed
      position = settleTarget
      velocity = { x: 0, y: 0 }
      const impactAgeMs = Math.max(0, narrativeElapsed - landedAtMs)
      if (impactAgeMs >= landing.holdMs) space = 'dissipating'
      opacity = space === 'dissipating'
        ? Math.max(0, 1 - (impactAgeMs - landing.holdMs) / landing.fadeMs)
        : 1
    } else if (particle.kind !== 'hero') {
      const fadeIn = Math.min(1, ageMs / 180)
      const fadeOut = Math.min(1, (particle.lifetimeMs - ageMs) / 480)
      opacity = Math.max(0, Math.min(fadeIn, fadeOut))
    }
    const history = particle.kind === 'hero'
      ? [...particle.history, position].slice(-48)
      : [previous, position]
    return { ...particle, previous, position, velocity, space, ageMs, history, opacity, enteredAtMs, landedAtMs, settleTarget }
  })

  let nextId = world.nextId
  let nextEmissionAtMs = world.nextEmissionAtMs
  let emissionIndex = world.emissionIndex
  if (input.continuous) {
    let generated = 0
    while (input.elapsedMs >= nextEmissionAtMs && generated < 4) {
      const batch = createResultBatch(
        nextId,
        emissionIndex,
        mappedElapsedMs(nextEmissionAtMs, input.reducedMotion),
        world.quality,
        world.mood,
      )
      const available = Math.max(0, particleLimit(world.quality) - particles.length)
      const heroes = batch.filter(({ kind }) => kind === 'hero')
      const trails = batch.filter(({ kind }) => kind === 'trail')
      const dust = batch.filter(({ kind }) => kind === 'dust')
      const accepted = [...heroes, ...trails, ...dust].slice(0, available)
      particles = [...particles, ...accepted]
      nextId += batch.length
      emissionIndex += 1
      nextEmissionAtMs += resultIntervals[world.quality]
      generated += 1
    }
  }
  return { ...world, particles, nextId, nextEmissionAtMs, emissionIndex }
}

export function resetParticleWorld(world: ParticleWorld): ParticleWorld {
  return emptyParticleWorld(world.quality, world.mood)
}
