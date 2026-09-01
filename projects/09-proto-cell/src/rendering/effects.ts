import type { EntityState } from '../domain/types'
import { CONTACT_DAMAGE_ARM_MS } from '../game/engine'
import type { RunPhase } from '../world/run-director'

export type RenderQuality = 'high' | 'balanced' | 'low'

export type AmbientParticle = {
  x: number
  y: number
  radius: number
  phase: number
}

export function collapsePresentation(
  phase: RunPhase,
  progress: number,
  reducedMotion: boolean,
): { edgeOpacity: number; safeInsetRatio: number; cueOpacity: number } {
  if (phase === 'active' || phase === 'finale' || phase === 'complete') {
    return { edgeOpacity: 0, safeInsetRatio: 0, cueOpacity: 0 }
  }
  const normalized = Math.min(1, Math.max(0, progress))
  const warning = phase === 'warning'
  const dangerousProgress = Math.max(0, (normalized - 0.75) / 0.25)
  return {
    edgeOpacity: warning ? 0.08 : 0.12 + normalized * 0.48,
    safeInsetRatio: dangerousProgress * 0.18,
    cueOpacity: warning ? 0.3 : reducedMotion ? Math.min(0.5, 0.24 + normalized * 0.26) : 0.35 + normalized * 0.4,
  }
}

export function drawLiquidField(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
  camera: { x: number; y: number } = { x: 0, y: 0 },
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
  const drift = elapsedMs / 110 - camera.x * 0.28
  const verticalOffset = ((-camera.y * 0.2) % 92 + 92) % 92
  for (let y = -172 + verticalOffset; y < height + 92; y += 92) {
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
  reducedFlash = false,
): void {
  if (entity.role !== 'predator' && entity.role !== 'elite' && entity.role !== 'boss') return

  const state = dangerPulseState(entity, elapsedMs)
  const hidden = entity.behaviorState === 'hide'
  const charging = entity.behaviorState === 'charge' || entity.behaviorState === 'ambush'
  const pulse = state.active || charging ? 1.18 + Math.sin(elapsedMs / 55) * 0.05 : 1.18 + state.contraction * 0.32
  context.save()
  context.globalAlpha = hidden ? 0.12 : state.telegraph || charging ? (reducedFlash ? 0.72 : 1) : 0.22
  context.strokeStyle = state.active || charging ? '#fff09a' : 'rgb(255 139 105 / 78%)'
  context.lineWidth = state.active || charging ? 3.5 : 2
  context.setLineDash(hidden ? [2, 12] : [8, 8])
  context.beginPath()
  context.arc(x, y, radius * pulse, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

export function dangerPulseState(entity: EntityState, elapsedMs: number): {
  active: boolean
  telegraph: boolean
  contraction: number
} {
  const contactDamage = 'contactDamage' in entity
    ? entity.contactDamage as { periodMs: number; activeMs: number; phaseOffsetMs: number } | undefined
    : undefined
  const periodMs = Math.max(1, contactDamage?.periodMs ?? 1600)
  const activeMs = contactDamage?.activeMs ?? 240
  const spawnedAtMs = 'spawnedAtMs' in entity ? Number(entity.spawnedAtMs) : 0
  const ageMs = Math.max(0, elapsedMs - spawnedAtMs)
  if (ageMs < CONTACT_DAMAGE_ARM_MS) {
    return {
      active: false,
      telegraph: true,
      contraction: 1 - ageMs / CONTACT_DAMAGE_ARM_MS,
    }
  }

  const pulseElapsedMs = ageMs - CONTACT_DAMAGE_ARM_MS
  const phaseMs = (pulseElapsedMs + (contactDamage?.phaseOffsetMs ?? 0)) % periodMs
  const untilPulse = periodMs - phaseMs
  const active = phaseMs < activeMs
  const telegraph = active || untilPulse <= 420
  const contraction = active ? 0 : Math.max(0, Math.min(1, untilPulse / 420))
  return { active, telegraph, contraction }
}

export function drawAmbientParticles(
  context: CanvasRenderingContext2D,
  particles: readonly AmbientParticle[],
  width: number,
  height: number,
  elapsedMs: number,
  quality: RenderQuality,
  camera: { x: number; y: number } = { x: 0, y: 0 },
): void {
  if (quality === 'low') return
  const count = quality === 'high' ? particles.length : Math.ceil(particles.length * 0.48)

  context.save()
  for (let index = 0; index < count; index += 1) {
    const particle = particles[index]
    const depth = 0.18 + (index % 4) * 0.055
    const { x, y } = ambientParticlePosition(particle, width, height, elapsedMs, camera, depth)
    context.globalAlpha = 0.1 + Math.sin(elapsedMs / 900 + particle.phase) * 0.04
    context.fillStyle = '#92f8ff'
    context.beginPath()
    context.arc(x, y, particle.radius, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

export function ambientParticlePosition(
  particle: AmbientParticle,
  width: number,
  height: number,
  elapsedMs: number,
  camera: { x: number; y: number },
  parallax: number,
): { x: number; y: number } {
  const rawX = particle.x * width + Math.sin(elapsedMs / 1700 + particle.phase) * 18 - camera.x * parallax
  const rawY = particle.y * height + elapsedMs * 0.005 * (0.6 + particle.radius) - camera.y * parallax
  return {
    x: ((rawX % width) + width) % width,
    y: ((rawY % height) + height) % height,
  }
}
