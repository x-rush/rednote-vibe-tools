import { WINDOW_PORTAL } from '../scene/geometry'
import type { Point } from '../scene/geometry'
import { particleImpactDelay, type Particle, type ParticleWorld } from './system'

const moodColors = {
  calm: '#c9ddff', hope: '#dce9ff', missing: '#d9c5ff', courage: '#b8dcff', dream: '#d5d3ff',
} as const

export function particleColor(particle: Particle, mood: ParticleWorld['mood']) {
  if (particle.kind === 'hero') return particle.id % 9 === 0 ? '#ffe6a3' : '#f4f7ff'
  if (particle.kind === 'trail') return particle.id % 13 === 0 ? '#ffe2a3' : '#dce9ff'
  return moodColors[mood]
}

export interface ImpactFragmentSample {
  readonly position: Point
  readonly opacity: number
  readonly radius: number
}

export function sampleImpactFragment(
  particleId: number,
  fragmentIndex: number,
  impactAgeMs: number,
  origin: Point,
): ImpactFragmentSample {
  const firstFlightMs = 380 + (fragmentIndex % 5) * 24
  const firstBounceMs = 180 + (fragmentIndex % 3) * 18
  const secondBounceMs = 110 + (fragmentIndex % 4) * 12
  const directionSeed = ((particleId * 7 + fragmentIndex * 11) % 19) / 18
  const direction = directionSeed * 2 - 1
  const spread = direction * (17 + (fragmentIndex % 4) * 4.5)
  const height = 16 + (fragmentIndex % 6) * 4.2
  const age = Math.max(0, impactAgeMs)
  const parabola = (progress: number) => 4 * progress * (1 - progress)

  if (age <= firstFlightMs) {
    const progress = age / firstFlightMs
    return {
      position: {
        x: origin.x + spread * progress,
        y: origin.y - height * parabola(progress),
      },
      opacity: 1,
      radius: 0.26 + (fragmentIndex % 3) * 0.12,
    }
  }
  if (age <= firstFlightMs + firstBounceMs) {
    const progress = (age - firstFlightMs) / firstBounceMs
    return {
      position: {
        x: origin.x + spread * (1 + progress * 0.18),
        y: origin.y - height * 0.34 * parabola(progress),
      },
      opacity: 1 - progress * 0.34,
      radius: 0.24 + (fragmentIndex % 3) * 0.1,
    }
  }
  if (age <= firstFlightMs + firstBounceMs + secondBounceMs) {
    const progress = (age - firstFlightMs - firstBounceMs) / secondBounceMs
    return {
      position: {
        x: origin.x + spread * (1.18 + progress * 0.07),
        y: origin.y - height * 0.13 * parabola(progress),
      },
      opacity: 0.66 * (1 - progress),
      radius: 0.2 + (fragmentIndex % 3) * 0.08,
    }
  }
  return {
    position: { x: origin.x + spread * 1.25, y: origin.y },
    opacity: 0,
    radius: 0.2,
  }
}

function portalPath(context: CanvasRenderingContext2D) {
  context.beginPath()
  context.moveTo(WINDOW_PORTAL.topLeft.x, WINDOW_PORTAL.topLeft.y)
  context.lineTo(WINDOW_PORTAL.topRight.x, WINDOW_PORTAL.topRight.y)
  context.lineTo(WINDOW_PORTAL.bottomRight.x, WINDOW_PORTAL.bottomRight.y)
  context.lineTo(WINDOW_PORTAL.bottomLeft.x, WINDOW_PORTAL.bottomLeft.y)
  context.closePath()
}

function drawParticle(context: CanvasRenderingContext2D, particle: Particle, color: string) {
  if (particle.ageMs < 0 || particle.ageMs > particle.lifetimeMs) return
  const pulseSpeed = particle.kind === 'hero' ? 260 : 190
  const pulseDepth = particle.kind === 'hero' ? 0.24 : 0.14
  const pulse = 0.76 + Math.sin(particle.ageMs / pulseSpeed + particle.twinklePhase) * pulseDepth
  context.save()
  context.globalAlpha = Math.max(0, pulse * particle.opacity)
  context.strokeStyle = color
  context.fillStyle = color
  context.shadowColor = color
  const impacted = particle.space === 'landed' || particle.space === 'dissipating'
  context.shadowBlur = impacted ? 4 : particle.kind === 'hero' ? 14 : particle.kind === 'trail' ? 8 : 4
  if (particle.kind === 'trail' && !impacted) {
    context.lineCap = 'round'
    context.lineWidth = particle.radius * 2.8
    context.globalAlpha *= 0.18
    context.beginPath()
    context.moveTo(particle.previous.x, particle.previous.y)
    context.lineTo(particle.position.x, particle.position.y)
    context.stroke()
    context.globalAlpha *= 3.4
    context.lineWidth = Math.max(0.5, particle.radius * 0.62)
    context.beginPath()
    context.moveTo(particle.previous.x, particle.previous.y)
    context.lineTo(particle.position.x, particle.position.y)
    context.stroke()
  } else if (particle.kind === 'hero') {
    const { x, y } = particle.position
    const radius = particle.radius
      * (impacted ? 0.72 : 1)
      * (particle.space === 'dissipating' ? Math.max(0.18, particle.opacity) : 1)
    context.globalAlpha *= 0.2
    context.beginPath()
    context.arc(x, y, radius * 2.45, 0, Math.PI * 2)
    context.fill()
    context.globalAlpha *= 4.1
    context.beginPath()
    context.moveTo(x, y - radius * 1.7)
    context.lineTo(x + radius * 0.55, y - radius * 0.5)
    context.lineTo(x + radius * 1.7, y)
    context.lineTo(x + radius * 0.55, y + radius * 0.5)
    context.lineTo(x, y + radius * 1.7)
    context.lineTo(x - radius * 0.55, y + radius * 0.5)
    context.lineTo(x - radius * 1.7, y)
    context.lineTo(x - radius * 0.55, y - radius * 0.5)
    context.closePath()
    context.fill()
    context.globalAlpha *= 0.58
    context.beginPath()
    context.arc(x, y, radius * 0.66, 0, Math.PI * 2)
    context.fillStyle = '#ffffff'
    context.fill()
    context.strokeStyle = '#ffffff'
    context.lineCap = 'round'
    context.globalAlpha *= 0.84
    context.lineWidth = Math.max(0.42, radius * 0.11)
    context.beginPath()
    context.moveTo(x - radius * 2.45, y)
    context.lineTo(x + radius * 2.45, y)
    context.stroke()
    context.globalAlpha *= 0.72
    context.lineWidth = Math.max(0.36, radius * 0.085)
    context.beginPath()
    context.moveTo(x, y - radius * 2.9)
    context.lineTo(x, y + radius * 2.9)
    context.stroke()
  } else {
    context.globalAlpha *= 0.18
    context.beginPath()
    context.arc(particle.position.x, particle.position.y, particle.radius * 2.7, 0, Math.PI * 2)
    context.fill()
    context.globalAlpha *= 4.4
    context.beginPath()
    context.arc(particle.position.x, particle.position.y, particle.radius, 0, Math.PI * 2)
    context.fill()
  }
  if (impacted) {
    const landedAtMs = particle.landedAtMs
      ?? (particle.enteredAtMs ?? particle.spawnAtMs) + particleImpactDelay(particle.kind)
    const impactAgeMs = Math.max(0, particle.ageMs + particle.spawnAtMs - landedAtMs)
    const fragmentCount = particle.kind === 'hero' ? 14 : particle.kind === 'trail' ? 9 : 6
    context.shadowBlur = particle.kind === 'hero' ? 3.2 : 2.2
    for (let index = 0; index < fragmentCount; index += 1) {
      const fragment = sampleImpactFragment(particle.id, index, impactAgeMs, particle.position)
      if (fragment.opacity <= 0) continue
      context.globalAlpha = pulse * particle.opacity * fragment.opacity * 0.92
      context.beginPath()
      context.arc(fragment.position.x, fragment.position.y, fragment.radius, 0, Math.PI * 2)
      context.fillStyle = index % 7 === 0 ? '#ffe6a3' : '#f4f7ff'
      context.fill()
    }
  }
  context.restore()
}

function drawParticles(context: CanvasRenderingContext2D, world: ParticleWorld, spaces: readonly string[]) {
  for (const particle of world.particles) {
    if (spaces.includes(particle.space)) drawParticle(context, particle, particleColor(particle, world.mood))
  }
}

export function drawExterior(context: CanvasRenderingContext2D, world: ParticleWorld) {
  context.save()
  portalPath(context)
  context.clip()
  drawParticles(context, world, ['outside', 'crossing'])
  context.restore()
}

export function drawInterior(context: CanvasRenderingContext2D, world: ParticleWorld) {
  drawParticles(context, world, ['inside', 'settling', 'landed', 'dissipating'])
}
