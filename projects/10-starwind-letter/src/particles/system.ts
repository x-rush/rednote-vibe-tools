import type { Mood } from '../content/messages'
import { createMulberry32 } from '../domain/random'
import { WINDOW_PORTAL, crossesPortal, type Point } from '../scene/geometry'

export type ParticleKind = 'dust' | 'trail' | 'hero'
export type ParticleSpace = 'outside' | 'crossing' | 'inside' | 'settling'
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
}

export interface ParticleWorld {
  readonly particles: readonly Particle[]
  readonly quality: ParticleQuality
  readonly mood: Mood
  readonly nextId: number
}

export interface ParticleStepInput {
  readonly elapsedMs: number
  readonly deltaMs: number
  readonly sashOpen: number
  readonly reducedMotion: boolean
}

const counts = {
  full: { dust: 70, trail: 22, hero: 8 },
  fallback: { dust: 35, trail: 10, hero: 5 },
} as const

export function emptyParticleWorld(quality: ParticleQuality, mood: Mood): ParticleWorld {
  return { particles: [], quality, mood, nextId: 0 }
}

export function createParticleWorld(seed: number, quality: ParticleQuality, mood: Mood): ParticleWorld {
  const random = createMulberry32(seed)
  const particles: Particle[] = []
  let id = 0
  const add = (kind: ParticleKind, count: number) => {
    for (let index = 0; index < count; index += 1) {
      const ratio = random()
      const x = 228 + random() * 106
      const y = 184 + random() * 226
      const kindOffset = kind === 'dust' ? 0 : kind === 'trail' ? 350 : 850
      const interval = kind === 'dust' ? 12 : kind === 'trail' ? 42 : 115
      const speed = kind === 'dust' ? 0.72 : kind === 'trail' ? 1.55 : 1
      particles.push({
        id,
        kind,
        space: 'outside',
        position: { x, y },
        previous: { x, y },
        velocity: { x: (-38 - random() * 42) * speed, y: (66 + random() * 70) * speed },
        ageMs: -(4300 + kindOffset + index * interval),
        spawnAtMs: 4300 + kindOffset + index * interval,
        lifetimeMs: kind === 'hero' ? 9000 : kind === 'trail' ? 2800 : 2100,
        history: [{ x, y }],
        radius: kind === 'hero' ? 2.8 + random() * 2.8 : kind === 'trail' ? 1 + random() : 0.45 + random() * 0.85,
        twinklePhase: random() * Math.PI * 2,
        settleTarget: { x: 94 + ratio * 202, y: 675 + (index % 3) * 30 + random() * 24 },
      })
      id += 1
    }
  }
  add('dust', counts[quality].dust)
  add('trail', counts[quality].trail)
  add('hero', counts[quality].hero)
  return { particles, quality, mood, nextId: id }
}

export function stepParticleWorld(world: ParticleWorld, input: ParticleStepInput): ParticleWorld {
  const seconds = Math.min(48, Math.max(0, input.deltaMs)) / 1000
  const motionScale = input.reducedMotion ? 0.58 : 1
  const settlingAt = input.reducedMotion ? 3300 : 6200
  const particles = world.particles.map((particle) => {
    const ageMs = input.elapsedMs - particle.spawnAtMs
    if (ageMs < 0 || ageMs > particle.lifetimeMs) return { ...particle, ageMs }
    const previous = particle.position
    let position = {
      x: previous.x + particle.velocity.x * seconds * motionScale,
      y: previous.y + particle.velocity.y * seconds * motionScale,
    }
    let space = particle.space
    if (space === 'outside' && input.sashOpen >= 0.55 && crossesPortal(previous, position, WINDOW_PORTAL)) {
      space = 'inside'
    }
    if ((space === 'inside' || space === 'settling') && input.elapsedMs >= settlingAt && particle.kind === 'hero') {
      space = 'settling'
      const settleAmount = 1 - Math.exp(-input.deltaMs / 520)
      position = {
        x: position.x + (particle.settleTarget.x - position.x) * settleAmount,
        y: position.y + (particle.settleTarget.y - position.y) * settleAmount,
      }
    }
    const history = particle.kind === 'hero'
      ? [...particle.history, position].slice(-48)
      : [previous, position]
    return { ...particle, previous, position, space, ageMs, history }
  })
  return { ...world, particles }
}

export function resetParticleWorld(world: ParticleWorld): ParticleWorld {
  return emptyParticleWorld(world.quality, world.mood)
}
