import type { EntityState } from '../domain/types'

export type CellPalette = {
  membrane: string
  cytoplasm: string
  core: string
  organ: string
  glow: string
}

export function drawCell(
  context: CanvasRenderingContext2D,
  entity: EntityState,
  screenX: number,
  screenY: number,
  radius: number,
  elapsedMs: number,
): void {
  const palette = paletteFor(entity)
  const pulse = 1 + Math.sin(elapsedMs / 520 + hashPhase(entity.id)) * 0.025
  const bodyRadius = radius * pulse

  context.save()
  context.translate(screenX, screenY)

  // 1. Liquid shadow and refraction.
  context.fillStyle = 'rgb(0 4 18 / 42%)'
  context.filter = 'blur(5px)'
  context.beginPath()
  context.ellipse(3, radius * 0.42, bodyRadius * 0.92, bodyRadius * 0.48, 0, 0, Math.PI * 2)
  context.fill()
  context.filter = 'none'

  // 2. Membrane outline.
  context.shadowColor = palette.glow
  context.shadowBlur = entity.role === 'predator' || entity.role === 'boss' ? 16 : 10
  context.fillStyle = palette.cytoplasm
  context.strokeStyle = palette.membrane
  context.lineWidth = Math.max(1.5, radius * 0.09)
  context.beginPath()
  context.ellipse(0, 0, bodyRadius, bodyRadius * 0.94, hashPhase(entity.id) * 0.08, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  // 3. Cytoplasm highlight.
  const cytoplasm = context.createRadialGradient(-radius * 0.35, -radius * 0.4, 0, 0, 0, radius)
  cytoplasm.addColorStop(0, 'rgb(255 255 255 / 34%)')
  cytoplasm.addColorStop(0.25, 'rgb(128 245 255 / 11%)')
  cytoplasm.addColorStop(1, 'rgb(0 18 68 / 8%)')
  context.fillStyle = cytoplasm
  context.beginPath()
  context.arc(0, 0, radius * 0.88, 0, Math.PI * 2)
  context.fill()

  // 4. Core.
  context.shadowBlur = 12
  context.fillStyle = palette.core
  context.strokeStyle = 'rgb(222 255 255 / 72%)'
  context.lineWidth = Math.max(1, radius * 0.045)
  context.beginPath()
  context.arc(radius * 0.04, radius * 0.06, radius * 0.31, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  // 5. Abstract installed organelles.
  context.fillStyle = palette.organ
  context.shadowBlur = 6
  for (let index = 0; index < 3; index += 1) {
    const angle = hashPhase(entity.id) + index * Math.PI * 2 / 3 + elapsedMs / 5600
    context.beginPath()
    context.ellipse(
      Math.cos(angle) * radius * 0.53,
      Math.sin(angle) * radius * 0.48,
      radius * 0.17,
      radius * 0.09,
      angle,
      0,
      Math.PI * 2,
    )
    context.fill()
  }

  // 6. Non-facial appendages.
  if (entity.role !== 'nutrient') {
    context.strokeStyle = palette.membrane
    context.lineWidth = Math.max(1, radius * 0.045)
    context.globalAlpha = 0.72
    for (let index = 0; index < 7; index += 1) {
      const angle = index / 7 * Math.PI * 2 + hashPhase(entity.id)
      const length = radius * (entity.role === 'predator' ? 0.56 : 0.28)
      context.beginPath()
      context.moveTo(Math.cos(angle) * radius * 0.94, Math.sin(angle) * radius * 0.9)
      context.quadraticCurveTo(
        Math.cos(angle + 0.22) * (radius + length * 0.5),
        Math.sin(angle + 0.22) * (radius + length * 0.5),
        Math.cos(angle) * (radius + length),
        Math.sin(angle) * (radius + length),
      )
      context.stroke()
    }
  }

  // 7. Status shell. No eyes, mouth, teeth, or facial marks.
  if (entity.role === 'predator' || entity.role === 'elite' || entity.role === 'boss') {
    context.globalAlpha = 0.68 + Math.sin(elapsedMs / 190) * 0.16
    context.strokeStyle = '#ff9c72'
    context.lineWidth = Math.max(1.5, radius * 0.055)
    context.setLineDash([radius * 0.22, radius * 0.14])
    context.beginPath()
    context.arc(0, 0, radius * 1.17, 0, Math.PI * 2)
    context.stroke()
  }

  context.restore()
}

function paletteFor(entity: EntityState): CellPalette {
  if (entity.id === 'player') {
    return {
      membrane: '#9dffff',
      cytoplasm: 'rgb(26 198 239 / 31%)',
      core: '#39e5e8',
      organ: '#b36cff',
      glow: '#36e9ff',
    }
  }
  if (entity.role === 'predator' || entity.role === 'elite' || entity.role === 'boss') {
    return {
      membrane: '#ff9b74',
      cytoplasm: 'rgb(128 28 91 / 38%)',
      core: '#ffcf70',
      organ: '#ff5b87',
      glow: '#ff596f',
    }
  }
  if (entity.role === 'nutrient' || entity.role === 'fragment') {
    return {
      membrane: '#c8ff94',
      cytoplasm: 'rgb(157 255 96 / 38%)',
      core: '#fff07a',
      organ: '#8effd4',
      glow: '#a5ff76',
    }
  }
  return {
    membrane: '#8ecfff',
    cytoplasm: 'rgb(80 92 226 / 30%)',
    core: '#86f4ff',
    organ: '#8c62ff',
    glow: '#477dff',
  }
}

function hashPhase(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 33)
  return (hash >>> 0) / 4_294_967_296 * Math.PI * 2
}
