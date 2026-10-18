import type { FormId } from '../content'
import type { BuildState } from '../evolution/build'
import type { BodyShape, EntityState, Vec2 } from './types'

export type LineageFamily = 'dart' | 'bastion' | 'bloom'
export type MembraneSilhouette = 'amoeba' | 'pearl' | 'swimmer' | 'spark' | 'vesicle' | 'hunter' | 'boss' | 'colony' | 'ciliate' | `${LineageFamily}-${'primal' | 'colony' | 'ciliate'}`

// Only identity-derived constants are retained. Time, pose and physical geometry
// are always evaluated from the current state; both cache dimensions are bounded.
const phaseSeeds = new Map<string, { hash: number; phase: number; angles: Map<number, number> }>()

function phaseSeed(id: string) {
  const cached = phaseSeeds.get(id)
  if (cached) return cached
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 33)
  const seed = { hash, phase: (hash >>> 0) / 4_294_967_296 * Math.PI * 2, angles: new Map<number, number>() }
  if (phaseSeeds.size >= 512) phaseSeeds.delete(phaseSeeds.keys().next().value!)
  phaseSeeds.set(id, seed)
  return seed
}

function angularPhase(id: string, angle: number): number {
  const seed = phaseSeed(id), key = Math.round(angle * 1000)
  const cached = seed.angles.get(key)
  if (cached !== undefined) return cached
  let hash = Math.imul(seed.hash ^ 58, 33) // The original `${id}:${key}` hash, without rebuilding its prefix.
  const suffix = String(key)
  for (let index = 0; index < suffix.length; index += 1) hash = Math.imul(hash ^ suffix.charCodeAt(index), 33)
  const phase = (hash >>> 0) / 4_294_967_296 * Math.PI * 2
  if (seed.angles.size >= 128) seed.angles.delete(seed.angles.keys().next().value!)
  seed.angles.set(key, phase)
  return phase
}

export function lineageFamily(visualRecipeId: string): LineageFamily | undefined {
  return (['dart', 'bastion', 'bloom'] as const).find((family) => visualRecipeId.includes(`lineage-${family}`))
}

/** This is the visible, filled membrane, excluding ornamental cilia and spines. */
export function membranePoint(silhouette: MembraneSilhouette, angle: number, elapsedMs: number, id: string): Vec2 {
  const family = silhouette.split('-')[0]
  if (family === 'dart' || family === 'bastion' || family === 'bloom') {
    const colony = silhouette.endsWith('colony')
    const ciliate = silhouette.endsWith('ciliate')
    const breathing = Math.sin(elapsedMs / 580 + angle * 2) * 0.009
    if (family === 'dart') {
      // A narrow prow, swept rear shoulders, then paired chambers and a long oral body.
      const lobes = colony ? 1 + Math.cos(angle * 3) * 0.07 : 1
      const taper = 0.64 + (1 - Math.cos(angle)) * 0.12
      return { x: Math.cos(angle) * 0.995 * Math.min(1, lobes), y: Math.sin(angle) * taper * (ciliate ? 0.88 : colony ? 1.15 : 1) * lobes }
    }
    if (family === 'bastion') {
      // Low frequency corners remain broad enough for the armored plates to read.
      const shell = 0.94 + Math.cos(angle * (colony ? 4 : 6) + (colony ? 0 : Math.PI)) * 0.04 + breathing
      return { x: Math.cos(angle) * shell, y: Math.sin(angle) * shell * (ciliate ? 0.75 : 1) }
    }
    const petals = colony ? 3 : ciliate ? 5 : 4
    const budding = (colony ? 0.89 : 0.86) + Math.cos(angle * petals) * (colony ? 0.09 : 0.11) + breathing
    return { x: Math.cos(angle) * budding, y: Math.sin(angle) * budding * (ciliate ? 0.77 : 1) }
  }
  if (silhouette === 'pearl') return { x: Math.cos(angle), y: Math.sin(angle) * 0.94 }
  if (silhouette === 'colony') {
    const lobe = 0.90 + Math.cos(angle * 3) * 0.08 + Math.sin(elapsedMs / 580 + angle * 2) * 0.012
    return { x: Math.cos(angle) * lobe, y: Math.sin(angle) * lobe }
  }
  if (silhouette === 'ciliate') {
    const ripple = 1 + Math.sin(angle * 5 + elapsedMs / 370) * 0.014
    return { x: Math.cos(angle) * 0.98 * ripple, y: Math.sin(angle) * 0.7 * (1 - Math.cos(angle) * 0.1) * ripple }
  }
  if (silhouette === 'swimmer') {
    const taper = 0.82 + Math.cos(angle) * 0.15
    return { x: Math.cos(angle) * 0.98, y: Math.sin(angle) * taper }
  }
  const phase = angularPhase(id, angle)
  const organicWave = Math.sin(angle * 3 + elapsedMs / 420 + phase) * (silhouette === 'amoeba' ? 0.035 : 0.018)
  const silhouetteWave = silhouette === 'spark' ? Math.cos(angle * 6) * 0.055
    : silhouette === 'vesicle' ? Math.sin(angle - 0.7) * 0.045
      : silhouette === 'hunter' || silhouette === 'boss' ? Math.cos(angle * 4) * 0.035
        : Math.cos(angle) * 0.025
  const base = silhouette === 'spark' ? 0.92 : 0.94
  const localRadius = Math.max(0.94, Math.min(1, base + organicWave + silhouetteWave))
  return { x: Math.cos(angle) * localRadius, y: Math.sin(angle) * localRadius * 0.97 }
}

/** Sample the rounded quadratic body once; drawing and containment use these same vertices. */
export function membraneContour(silhouette: MembraneSilhouette, elapsedMs: number, id: string): Vec2[] {
  const count = silhouette === 'hunter' || silhouette === 'boss' ? 18 : 22
  const controls = Array.from({ length: count }, (_, index) => membranePoint(silhouette, index / count * Math.PI * 2, elapsedMs, id))
  const contour: Vec2[] = []
  for (let index = 0; index < count; index += 1) {
    const previous = controls[(index - 1 + count) % count]!
    const control = controls[index]!
    const next = controls[(index + 1) % count]!
    const start = { x: (previous.x + control.x) / 2, y: (previous.y + control.y) / 2 }
    const end = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 }
    for (let step = 0; step < 3; step += 1) {
      const t = step / 3
      const u = 1 - t
      contour.push({ x: u * u * start.x + 2 * u * t * control.x + t * t * end.x, y: u * u * start.y + 2 * u * t * control.y + t * t * end.y })
    }
  }
  return contour
}

export function membranePose(entity: Pick<EntityState, 'id' | 'velocity'>, elapsedMs: number) {
  const speed = Math.hypot(entity.velocity.x, entity.velocity.y)
  return {
    heading: speed > 0.5 ? Math.atan2(entity.velocity.y, entity.velocity.x) : membranePhase(entity.id) * 0.08,
    pulse: 1 + Math.sin(elapsedMs / 520 + membranePhase(entity.id)) * 0.025,
    strain: Math.min(0.018, speed / 5000),
  }
}

export function membraneSilhouette(entity: EntityState, formId: FormId): MembraneSilhouette {
  if (entity.faction === 'player') {
    const recipe = 'visualRecipeId' in entity ? String(entity.visualRecipeId) : ''
    const family = lineageFamily(recipe)
    const stage = formId === 'form-colony-body' ? 'colony' : formId === 'form-ciliate-composite' ? 'ciliate' : 'primal'
    return family ? `${family}-${stage}` : stage === 'primal' ? 'amoeba' : stage
  }
  const definitionId = 'definitionId' in entity ? String(entity.definitionId) : ''
  if (entity.role === 'nutrient' || entity.role === 'fragment') return 'pearl'
  if (definitionId === 'creature-thornback-forager') return 'vesicle'
  if (definitionId === 'predator-seam-lurker') return 'ciliate'
  if (definitionId === 'creature-lantern-siphon') return 'swimmer'
  if (definitionId === 'predator-razor-ray') return 'spark'
  if (definitionId.includes('fiber-stalker')) return 'ciliate'
  if (definitionId.includes('chamber')) return 'colony'
  if (entity.role === 'boss') return 'boss'
  if (entity.role === 'elite' || entity.role === 'predator') return 'hunter'
  if (entity.role === 'scavenger') return 'vesicle'
  if (entity.role === 'competitor') return 'spark'
  if (entity.role === 'prey') return 'swimmer'
  const recipe = 'visualRecipeId' in entity ? String(entity.visualRecipeId) : ''
  return recipe.includes('armored-spore') ? 'vesicle' : 'amoeba'
}

/** Transient interaction geometry. Do not persist its enclosing radius as lifecycle radius. */
export function physicalMembrane(entity: EntityState, formId: FormId, elapsedMs: number, _build?: BuildState): BodyShape {
  const pose = membranePose(entity, elapsedMs)
  const cosine = Math.cos(pose.heading)
  const sine = Math.sin(pose.heading)
  const scale = entity.body.radius * pose.pulse
  const contour = membraneContour(membraneSilhouette(entity, formId), elapsedMs, entity.id).map((point) => {
    const x = point.x * scale * (1 + pose.strain)
    const y = point.y * scale * (1 - pose.strain)
    return { x: entity.position.x + x * cosine - y * sine, y: entity.position.y + x * sine + y * cosine }
  })
  const radius = Math.max(...contour.map((point) => Math.hypot(point.x - entity.position.x, point.y - entity.position.y)))
  return { center: { ...entity.position }, radius, contour }
}

function membranePhase(id: string): number {
  return phaseSeed(id).phase
}
