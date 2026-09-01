import { WINDOW_PORTAL } from '../scene/geometry'
import type { Particle, ParticleWorld } from './system'

const moodColors = {
  calm: '#c9ddff', hope: '#ffe4a3', missing: '#d9c5ff', courage: '#b8dcff', dream: '#d5d3ff',
} as const

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
  context.shadowBlur = particle.kind === 'hero' ? 14 : particle.kind === 'trail' ? 8 : 4
  if (particle.kind === 'trail') {
    context.lineWidth = particle.radius
    context.beginPath()
    context.moveTo(particle.previous.x, particle.previous.y)
    context.lineTo(particle.position.x, particle.position.y)
    context.stroke()
  } else if (particle.kind === 'hero') {
    const { x, y } = particle.position
    const radius = particle.radius * (particle.space === 'dissipating' ? Math.max(0.18, particle.opacity) : 1)
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
    context.globalAlpha *= 0.42
    context.beginPath()
    context.arc(x, y, radius * 0.66, 0, Math.PI * 2)
    context.fillStyle = '#ffffff'
    context.fill()
    if (particle.space === 'landed' || particle.space === 'dissipating') {
      const scatter = (1 - particle.opacity) * 13
      context.strokeStyle = color
      context.lineWidth = 0.72
      context.beginPath()
      context.ellipse(x, y + radius * 1.45, radius * (2.1 + scatter * 0.08), radius * 0.52, 0, 0, Math.PI * 2)
      context.stroke()
      for (let index = 0; index < 6; index += 1) {
        const angle = particle.twinklePhase + index * Math.PI / 3
        const distance = radius * 1.5 + scatter * (0.55 + (index % 2) * 0.25)
        const moteX = x + Math.cos(angle) * distance
        const moteY = y + Math.sin(angle) * distance * 0.48
        context.beginPath()
        context.arc(moteX, moteY, Math.max(0.42, radius * 0.18 * particle.opacity), 0, Math.PI * 2)
        context.fill()
      }
    }
  } else {
    context.beginPath()
    context.arc(particle.position.x, particle.position.y, particle.radius, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

function drawParticles(context: CanvasRenderingContext2D, world: ParticleWorld, spaces: readonly string[]) {
  const color = moodColors[world.mood]
  for (const particle of world.particles) {
    const particleColor = particle.kind === 'hero' && particle.id % 3 === 0 ? '#ffe6a3' : color
    if (spaces.includes(particle.space)) drawParticle(context, particle, particleColor)
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
