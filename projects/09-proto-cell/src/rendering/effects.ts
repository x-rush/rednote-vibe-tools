import type { EntityState } from '../domain/types'

export type RenderQuality = 'high' | 'balanced' | 'low'

export type AmbientParticle = {
  x: number
  y: number
  radius: number
  phase: number
}

export function drawLiquidField(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
): void {
  const field = context.createRadialGradient(width * 0.48, height * 0.42, 0, width * 0.5, height * 0.5, height * 0.72)
  field.addColorStop(0, '#073d66')
  field.addColorStop(0.46, '#032448')
  field.addColorStop(1, '#010716')
  context.fillStyle = field
  context.fillRect(0, 0, width, height)

  context.save()
  context.globalAlpha = 0.1
  context.strokeStyle = '#72f5ff'
  context.lineWidth = 1
  const drift = elapsedMs / 110
  for (let y = -80; y < height + 80; y += 92) {
    context.beginPath()
    for (let x = -40; x <= width + 40; x += 28) {
      const waveY = y + Math.sin((x + drift) / 90) * 12
      if (x === -40) context.moveTo(x, waveY)
      else context.lineTo(x, waveY)
    }
    context.stroke()
  }
  context.restore()
}

export function drawDangerTelegraph(
  context: CanvasRenderingContext2D,
  entity: EntityState,
  x: number,
  y: number,
  radius: number,
  elapsedMs: number,
): void {
  if (entity.role !== 'predator' && entity.role !== 'elite' && entity.role !== 'boss') return

  const pulse = 1.32 + Math.sin(elapsedMs / 180) * 0.08
  context.save()
  context.strokeStyle = 'rgb(255 139 105 / 70%)'
  context.lineWidth = 2
  context.setLineDash([8, 8])
  context.beginPath()
  context.arc(x, y, radius * pulse, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

export function drawAmbientParticles(
  context: CanvasRenderingContext2D,
  particles: readonly AmbientParticle[],
  width: number,
  height: number,
  elapsedMs: number,
  quality: RenderQuality,
): void {
  if (quality === 'low') return
  const count = quality === 'high' ? particles.length : Math.ceil(particles.length * 0.48)

  context.save()
  for (let index = 0; index < count; index += 1) {
    const particle = particles[index]
    const x = (particle.x * width + Math.sin(elapsedMs / 1700 + particle.phase) * 18 + width) % width
    const y = (particle.y * height + elapsedMs * 0.005 * (0.6 + particle.radius) + height) % height
    context.globalAlpha = 0.1 + Math.sin(elapsedMs / 900 + particle.phase) * 0.04
    context.fillStyle = '#92f8ff'
    context.beginPath()
    context.arc(x, y, particle.radius, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}
