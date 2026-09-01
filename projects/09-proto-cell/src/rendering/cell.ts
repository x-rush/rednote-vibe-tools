import type { EntityState } from '../domain/types'
import rawContent from '../content/content.json'
import type { RenderQuality } from './effects'

export type CellPalette = {
  membrane: string
  cytoplasm: string
  core: string
  organ: string
  glow: string
}

export type CellVisualProfile = {
  palette: CellPalette
  silhouette: 'amoeba' | 'pearl' | 'swimmer' | 'spark' | 'vesicle' | 'hunter' | 'boss'
  appendages: 'none' | 'flagellum' | 'fins' | 'cilia' | 'spines'
}

export function cellStrokeWidth(radius: number): number {
  return Math.max(2.5, radius * 0.11)
}

export function cellToneBands(palette: CellPalette): [string, string, string] {
  return [
    mixHex(palette.membrane, '#07142c', 0.44),
    mixHex(palette.membrane, palette.core, 0.38),
    mixHex(palette.core, '#e8ffff', 0.2),
  ]
}

type DrawableVisualRecipe = { id: string; palette: string[] }

export function buildVisualRecipeMap(value: unknown): Map<string, DrawableVisualRecipe> {
  if (!Array.isArray(value)) return new Map()
  const recipes = value.flatMap((candidate): DrawableVisualRecipe[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const record = candidate as Record<string, unknown>
    if (typeof record.id !== 'string' || !Array.isArray(record.palette) || !record.palette.every((color) => typeof color === 'string')) return []
    return [{ id: record.id, palette: [...record.palette] as string[] }]
  })
  return new Map(recipes.map((recipe) => [recipe.id, recipe]))
}

const visualRecipes = buildVisualRecipeMap((rawContent as unknown as { visualRecipes?: unknown }).visualRecipes)

export function cellVisualProfile(entity: EntityState): CellVisualProfile {
  const visualRecipeId = 'visualRecipeId' in entity ? String(entity.visualRecipeId) : ''
  const recipe = visualRecipes.get(visualRecipeId)
  const fallback = fallbackPaletteFor(entity)
  const membrane = recipe?.palette[0] ?? fallback.membrane
  const core = recipe?.palette[1] ?? recipe?.palette[0] ?? fallback.core
  const palette = {
    membrane,
    cytoplasm: hexWithAlpha(membrane, 0.24),
    core,
    organ: recipe?.palette[1] ?? fallback.organ,
    glow: membrane,
  }
  if (entity.role === 'nutrient' || entity.role === 'fragment') return { palette, silhouette: 'pearl', appendages: 'none' }
  if (entity.role === 'boss') return { palette, silhouette: 'boss', appendages: 'spines' }
  if (entity.role === 'predator' || entity.role === 'elite') return { palette, silhouette: 'hunter', appendages: 'spines' }
  if (entity.role === 'scavenger') return { palette, silhouette: 'vesicle', appendages: 'cilia' }
  if (entity.role === 'competitor') return { palette, silhouette: 'spark', appendages: 'fins' }
  if (entity.role === 'prey') return { palette, silhouette: 'swimmer', appendages: 'flagellum' }
  if (visualRecipeId.includes('armored-spore')) return { palette, silhouette: 'vesicle', appendages: 'spines' }
  if (visualRecipeId.includes('ciliate')) return { palette, silhouette: 'amoeba', appendages: 'cilia' }
  return { palette, silhouette: 'amoeba', appendages: 'cilia' }
}

export function drawCell(
  context: CanvasRenderingContext2D,
  entity: EntityState,
  screenX: number,
  screenY: number,
  radius: number,
  elapsedMs: number,
  options: { quality?: RenderQuality; organelleIds?: readonly string[]; stability?: number; synergyIds?: readonly string[]; damageSource?: 'acid' | 'electric' | 'spine' | 'ram' } = {},
): void {
  const profile = cellVisualProfile(entity)
  const palette = profile.palette
  const toneBands = cellToneBands(palette)
  const pulse = 1 + Math.sin(elapsedMs / 520 + hashPhase(entity.id)) * 0.025
  const bodyRadius = radius * pulse
  const speed = Math.hypot(entity.velocity.x, entity.velocity.y)
  const heading = speed > 0.5 ? Math.atan2(entity.velocity.y, entity.velocity.x) : hashPhase(entity.id) * 0.08

  context.save()
  context.translate(screenX, screenY)
  context.rotate(heading)

  // 1. Liquid shadow and refraction.
  context.fillStyle = 'rgb(0 3 16 / 68%)'
  context.filter = options.quality === 'low' ? 'none' : 'blur(3px)'
  context.beginPath()
  context.ellipse(4, radius * 0.34, bodyRadius * 0.96, bodyRadius * 0.62, 0, 0, Math.PI * 2)
  context.fill()
  context.filter = 'none'

  // 2. Membrane outline.
  context.shadowColor = palette.glow
  context.shadowBlur = options.quality === 'low' ? 0 : entity.role === 'predator' || entity.role === 'boss' ? 16 : 10
  context.fillStyle = toneBands[0]
  context.strokeStyle = palette.membrane
  context.lineWidth = cellStrokeWidth(radius)
  traceBody(context, profile.silhouette, bodyRadius, elapsedMs, entity.id)
  context.fill()
  context.stroke()

  // 3. Three opaque arcade tone bands keep small cells readable at speed.
  context.shadowBlur = 0
  context.fillStyle = toneBands[1]
  traceBody(context, profile.silhouette, radius * 0.82, elapsedMs, entity.id)
  context.fill()
  context.fillStyle = toneBands[2]
  traceBody(context, profile.silhouette, radius * 0.62, elapsedMs, entity.id)
  context.fill()

  // 4. Core.
  context.shadowBlur = 12
  context.fillStyle = palette.core
  context.strokeStyle = 'rgb(222 255 255 / 72%)'
  context.lineWidth = Math.max(1, radius * 0.045)
  const coreGradient = context.createRadialGradient(-radius * 0.08, -radius * 0.1, 0, 0, 0, radius * 0.38)
  coreGradient.addColorStop(0, '#ffffff')
  coreGradient.addColorStop(0.2, palette.core)
  coreGradient.addColorStop(1, hexWithAlpha(palette.core, 0.28))
  context.fillStyle = coreGradient
  context.beginPath()
  context.ellipse(radius * 0.04, radius * 0.06, radius * 0.33, radius * 0.29, -0.2, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  // 5. Abstract installed organelles.
  context.fillStyle = palette.organ
  context.shadowBlur = 6
  const organelleIds = options.organelleIds
  const organCount = organelleIds === undefined ? 3 : organelleIds.length
  for (let index = 0; index < organCount; index += 1) {
    const organId = organelleIds?.[index] ?? `${entity.id}:${index}`
    const angle = hashPhase(organId) + index * Math.PI * 2 / organCount + elapsedMs / 5600
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
  if (profile.appendages !== 'none') {
    context.strokeStyle = palette.membrane
    context.lineWidth = Math.max(1, radius * 0.045)
    context.globalAlpha = 0.72
    const baseAppendageCount = profile.appendages === 'cilia' ? 11 : profile.appendages === 'spines' ? 8 : profile.appendages === 'fins' ? 5 : 2
    const appendageCount = options.quality === 'low' ? Math.min(4, baseAppendageCount) : options.quality === 'high' ? baseAppendageCount + 2 : baseAppendageCount
    for (let index = 0; index < appendageCount; index += 1) {
      const angle = index / appendageCount * Math.PI * 2 + hashPhase(entity.id)
      const length = radius * (profile.appendages === 'spines' ? 0.48 : profile.appendages === 'flagellum' ? 0.72 : profile.appendages === 'fins' ? 0.38 : 0.24)
      context.beginPath()
      context.moveTo(Math.cos(angle) * radius * 0.94, Math.sin(angle) * radius * 0.9)
      if (profile.appendages === 'spines') {
        context.lineTo(Math.cos(angle) * (radius + length), Math.sin(angle) * (radius + length))
      } else {
        const wave = Math.sin(elapsedMs / 180 + index * 1.7) * 0.18
        context.quadraticCurveTo(
          Math.cos(angle + 0.22 + wave) * (radius + length * 0.5),
          Math.sin(angle + 0.22 + wave) * (radius + length * 0.5),
          Math.cos(angle + wave * 0.35) * (radius + length),
          Math.sin(angle + wave * 0.35) * (radius + length),
        )
      }
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

  // 8. Authoritative player status layers; quality settings never remove these cues.
  if (entity.faction === 'player' && options.damageSource) {
    context.globalAlpha = 0.92
    context.strokeStyle = options.damageSource === 'acid' ? '#dfff68' : options.damageSource === 'electric' ? '#fff39a' : '#ff927e'
    context.lineWidth = Math.max(2, radius * 0.07)
    context.setLineDash(options.damageSource === 'electric' ? [radius * 0.16, radius * 0.08] : [radius * 0.34, radius * 0.12])
    context.beginPath()
    context.arc(0, 0, radius * 1.08, 0, Math.PI * 2)
    context.stroke()
  }
  if (entity.faction === 'player' && (options.stability ?? 100) < 70) {
    context.globalAlpha = 0.75
    context.strokeStyle = '#ffb68c'
    context.lineWidth = Math.max(1.5, radius * 0.045)
    context.setLineDash([])
    for (let crack = 0; crack < 3; crack += 1) {
      const angle = hashPhase(`stability:${crack}`)
      context.beginPath()
      context.moveTo(Math.cos(angle) * radius * 0.42, Math.sin(angle) * radius * 0.42)
      context.lineTo(Math.cos(angle + 0.12) * radius * 0.78, Math.sin(angle + 0.12) * radius * 0.78)
      context.stroke()
    }
  }
  if (entity.faction === 'player' && (options.synergyIds?.length ?? 0) > 0) {
    context.globalAlpha = 0.52
    context.strokeStyle = '#cf9cff'
    context.lineWidth = Math.max(1, radius * 0.035)
    context.setLineDash([radius * 0.1, radius * 0.14])
    context.beginPath()
    context.arc(0, 0, radius * (1.24 + Math.min(3, options.synergyIds!.length) * 0.04), 0, Math.PI * 2)
    context.stroke()
  }

  context.restore()
}

function fallbackPaletteFor(entity: EntityState): CellPalette {
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

function traceBody(
  context: CanvasRenderingContext2D,
  silhouette: CellVisualProfile['silhouette'],
  radius: number,
  elapsedMs: number,
  id: string,
) {
  const count = silhouette === 'hunter' || silhouette === 'boss' ? 18 : 22
  const points = Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2
    const point = cellBodyPoint(silhouette, angle, elapsedMs, id)
    return { x: point.x * radius, y: point.y * radius }
  })
  context.beginPath()
  const first = points[0]!
  const last = points.at(-1)!
  context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!
    const next = points[(index + 1) % points.length]!
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2)
  }
  context.closePath()
}

export function cellBodyPoint(
  silhouette: CellVisualProfile['silhouette'],
  angle: number,
  elapsedMs: number,
  id: string,
): { x: number; y: number } {
  if (silhouette === 'pearl') return { x: Math.cos(angle), y: Math.sin(angle) * 0.94 }

  const phase = hashPhase(`${id}:${Math.round(angle * 1000)}`)
  const organicWave = Math.sin(angle * 3 + elapsedMs / 420 + phase) * (silhouette === 'amoeba' ? 0.035 : 0.018)
  const silhouetteWave = silhouette === 'spark'
    ? Math.cos(angle * 6) * 0.055
    : silhouette === 'vesicle'
      ? Math.sin(angle - 0.7) * 0.045
      : silhouette === 'hunter' || silhouette === 'boss'
        ? Math.cos(angle * 4) * 0.035
        : Math.cos(angle) * 0.025
  const base = silhouette === 'spark' ? 0.92 : silhouette === 'swimmer' ? 0.96 : 0.94
  const minimumRadius = silhouette === 'swimmer' ? 0.96 : 0.94
  const localRadius = Math.max(minimumRadius, Math.min(1, base + organicWave + silhouetteWave))
  const height = silhouette === 'swimmer' ? 0.94 : 0.97
  return { x: Math.cos(angle) * localRadius, y: Math.sin(angle) * localRadius * height }
}

function hexWithAlpha(color: string, alpha: number): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return color
  const red = Number.parseInt(color.slice(1, 3), 16)
  const green = Number.parseInt(color.slice(3, 5), 16)
  const blue = Number.parseInt(color.slice(5, 7), 16)
  return `rgb(${red} ${green} ${blue} / ${alpha})`
}

function mixHex(first: string, second: string, secondWeight: number): string {
  if (!/^#[\da-f]{6}$/i.test(first) || !/^#[\da-f]{6}$/i.test(second)) return first
  const weight = Math.min(1, Math.max(0, secondWeight))
  const channel = (offset: number) => Math.round(
    Number.parseInt(first.slice(offset, offset + 2), 16) * (1 - weight)
      + Number.parseInt(second.slice(offset, offset + 2), 16) * weight,
  ).toString(16).padStart(2, '0')
  return `#${channel(1)}${channel(3)}${channel(5)}`
}

function hashPhase(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 33)
  return (hash >>> 0) / 4_294_967_296 * Math.PI * 2
}
