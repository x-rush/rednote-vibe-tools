import { getContent, type EnvironmentId } from '../content'
import { createRng } from '../domain/rng'
import type { Vec2 } from '../domain/types'
import type { EcosystemEventState } from './events'
import { worldDimensionsForTier } from './scale-world'

export type EnvironmentTelegraph = {
  cueId: string
  hazardId: string
  shape: 'pulse' | 'bubbles' | 'threads' | 'rings' | 'contraction'
  startsAtMs: number
  activatesAtMs: number
  center: Vec2
  radius: number
}

export type FiberGap = { fromT: number; toT: number; atMs: number; natural?: boolean }
export type TerrainBreak = { obstacleId: string; position: Vec2; radius: number; atMs: number }
export type EnvironmentObstacle = { id: string; kind: 'fiber' | 'chamber-wall'; from: Vec2; to: Vec2; adhesive: boolean; gaps?: FiberGap[]; strainMs?: number; strainPosition?: Vec2; anchorY?: number }

export type EnvironmentField = {
  environmentId: EnvironmentId
  seed: number
  phaseStartedAtMs: number
  visibility: number
  baseVisibility: number
  flow: Vec2
  baseFlow: Vec2
  safeCenters: Vec2[]
  safeRadius: number
  obstacles: EnvironmentObstacle[]
  recentBreaks?: TerrainBreak[]
  telegraphs: EnvironmentTelegraph[]
  activeHazardIds: string[]
  hazardCenters: Record<string, Vec2>
}

const FIELD_RULES: Record<EnvironmentId, { hazardId: string; cueId: string; shape: EnvironmentTelegraph['shape']; leadMs: number; activeMs: number; periodMs: number }> = {
  'env-clear-drop': { hazardId: 'current-pulse', cueId: 'cue-current-lines', shape: 'pulse', leadMs: 1400, activeMs: 1600, periodMs: 6200 },
  'env-algae-glow': { hazardId: 'hazard-light-pulse', cueId: 'cue-algae-fold', shape: 'pulse', leadMs: 1800, activeMs: 1800, periodMs: 6800 },
  'env-acid-vesicle': { hazardId: 'hazard-acid-discharge', cueId: 'cue-acid-bubbles', shape: 'bubbles', leadMs: 2400, activeMs: 2600, periodMs: 8000 },
  'env-fiber-maze': { hazardId: 'hazard-fiber-anchor', cueId: 'cue-thread-twitch', shape: 'threads', leadMs: 1600, activeMs: 2200, periodMs: 7000 },
  'env-antibody-storm': { hazardId: 'hazard-antibody-sweep', cueId: 'cue-locking-rings', shape: 'rings', leadMs: 3000, activeMs: 2400, periodMs: 8000 },
  'env-abandoned-chamber': { hazardId: 'hazard-chamber-drain', cueId: 'cue-wall-contraction', shape: 'contraction', leadMs: 3600, activeMs: 3000, periodMs: 9000 },
}

export function createEnvironmentField(environmentId: EnvironmentId, seed: number, atMs = 0): EnvironmentField {
  const environment = getContent().environments.find((item) => item.id === environmentId)
  const rule = FIELD_RULES[environmentId]
  if (!environment || !rule) throw new RangeError(`Unknown environment id: ${environmentId}`)
  const m0Environment = (getContent().m0.environments as Array<{ id: string; width: number; height: number }>).find((item) => item.id === environmentId)
  const scaleTier = (getContent().scaleTiers as Array<{ environmentId: string; radiusRange: readonly number[]; worldBodyWidths: number }>).find((item) => item.environmentId === environmentId)
  const dimensions = scaleTier ? worldDimensionsForTier(scaleTier) : { width: m0Environment?.width ?? 640, height: m0Environment?.height ?? 1100 }
  const rng = createRng(seed).fork(`field:${environmentId}`)
  const angle = rng.next() * Math.PI * 2
  const center = {
    x: dimensions.width * (0.18 + rng.next() * 0.64),
    y: dimensions.height * (0.18 + rng.next() * 0.54),
  }
  const geometryBaseWidth = environmentId === 'env-fiber-maze' ? 1160 : 640
  const geometryBaseHeight = environmentId === 'env-fiber-maze' ? 1700 : 1100
  const scaleX = dimensions.width / geometryBaseWidth
  const scaleY = dimensions.height / geometryBaseHeight
  const point = (x: number, y: number): Vec2 => ({ x: x * scaleX, y: y * scaleY })
  return {
    environmentId,
    seed,
    phaseStartedAtMs: atMs,
    visibility: environment.visibility,
    baseVisibility: environment.visibility,
    flow: { x: Math.cos(angle) * environment.viscosity, y: Math.sin(angle) * environment.viscosity },
    baseFlow: { x: Math.cos(angle) * environment.viscosity, y: Math.sin(angle) * environment.viscosity },
    safeCenters: [],
    safeRadius: environmentId === 'env-acid-vesicle' || environmentId === 'env-antibody-storm' ? 132 : 92,
    obstacles: environmentId === 'env-clear-drop'
      ? getContent().fiberTraversal.firstLayerShelters.map((shelter, index) => ({ id: `shelter-${index}`, kind: 'fiber' as const, adhesive: true, from: { x: shelter.from[0] * dimensions.width, y: shelter.from[1] * dimensions.height }, to: { x: shelter.to[0] * dimensions.width, y: shelter.to[1] * dimensions.height } }))
      : environmentId === 'env-fiber-maze'
      ? [
          { id: 'fiber-main', kind: 'fiber', from: point(90, 220), to: point(550, 760), adhesive: true },
          { id: 'fiber-upper', kind: 'fiber', from: point(620, 180), to: point(1160, 640), adhesive: true },
          { id: 'fiber-lower', kind: 'fiber', from: point(260, 980), to: point(880, 1420), adhesive: true },
        ]
      : environmentId === 'env-abandoned-chamber'
        ? getContent().lateEcology.chamberWalls.map((wall, index) => ({ id: `chamber-plate-${index}`, kind: 'chamber-wall' as const, adhesive: false,
          from: { x: wall.from[0] * dimensions.width, y: wall.from[1] * dimensions.height }, to: { x: wall.to[0] * dimensions.width, y: wall.to[1] * dimensions.height }, anchorY: wall.from[1] * dimensions.height,
          gaps: wall.gaps.map(([fromT, toT]) => ({ fromT, toT, atMs, natural: true })) }))
        : [],
    telegraphs: [{ cueId: rule.cueId, hazardId: rule.hazardId, shape: rule.shape, startsAtMs: atMs, activatesAtMs: atMs + rule.leadMs, center, radius: 90 + rng.int(0, 80) }],
    activeHazardIds: [],
    hazardCenters: { [rule.hazardId]: center },
  }
}

export function stepEnvironmentField(state: EnvironmentField, atMs: number): EnvironmentField {
  const rule = FIELD_RULES[state.environmentId]
  const dimensions = dimensionsFor(state)
  const cycleIndex = Math.floor(Math.max(0, atMs - state.phaseStartedAtMs) / rule.periodMs)
  const cycleStartsAtMs = state.phaseStartedAtMs + cycleIndex * rule.periodMs
  const telegraphs = state.telegraphs.filter((cue) => cue.hazardId === rule.hazardId).map((cue) => ({
    ...cue,
    startsAtMs: cycleStartsAtMs,
    activatesAtMs: cycleStartsAtMs + rule.leadMs,
  }))
  const activeHazardIds = telegraphs.filter((cue) => (
    atMs >= cue.activatesAtMs && atMs < cue.activatesAtMs + rule.activeMs
  )).map((cue) => cue.hazardId)
  const telegraphing = telegraphs.some((cue) => atMs >= cue.startsAtMs && atMs < cue.activatesAtMs)
  const elapsedSeconds = Math.max(0, atMs - state.phaseStartedAtMs) / 1000
  const hazardSpeedMultiplier = state.environmentId === 'env-acid-vesicle' ? 0.45 : state.environmentId === 'env-antibody-storm' ? 0.5 : 1
  const moves = state.environmentId === 'env-acid-vesicle' || state.environmentId === 'env-antibody-storm' || state.environmentId === 'env-abandoned-chamber'
  const hazardCenters = Object.fromEntries(telegraphs.map((cue) => [cue.hazardId, moves ? {
    x: pingPong(cue.center.x + state.flow.x * elapsedSeconds * 180 * hazardSpeedMultiplier, Math.max(70, dimensions.width * 0.08), Math.min(dimensions.width - 70, dimensions.width * 0.92)),
    y: pingPong(cue.center.y + state.flow.y * elapsedSeconds * 220 * hazardSpeedMultiplier, Math.max(100, dimensions.height * 0.08), Math.min(dimensions.height - 100, dimensions.height * 0.92)),
  } : cue.center]))
  let safeCenters: Vec2[] = (state.environmentId === 'env-acid-vesicle' || state.environmentId === 'env-antibody-storm') && (telegraphing || activeHazardIds.length > 0)
    ? Object.values(hazardCenters).map((center) => ({
        x: pingPong(center.x + dimensions.width * 0.5, Math.max(70, dimensions.width * 0.08), Math.min(dimensions.width - 70, dimensions.width * 0.92)),
        y: pingPong(center.y + dimensions.height * 0.44, Math.max(100, dimensions.height * 0.08), Math.min(dimensions.height - 100, dimensions.height * 0.92)),
      }))
    : []
  if (state.environmentId === 'env-antibody-storm' && (telegraphing || activeHazardIds.length > 0)) {
    safeCenters = Object.values(hazardCenters).map((center) => ({ x: pingPong(center.x + dimensions.width * 0.12, Math.max(70, dimensions.width * 0.08), Math.min(dimensions.width - 70, dimensions.width * 0.92)), y: center.y }))
  }
  const obstacles = state.environmentId === 'env-abandoned-chamber'
    ? state.obstacles.map((obstacle, index) => {
        const y = (obstacle.anchorY ?? obstacle.from.y) + Math.sin(elapsedSeconds * 0.7 + index * 1.4) * Math.min(105, dimensions.height * 0.012)
        return { ...obstacle, from: { ...obstacle.from, y }, to: { ...obstacle.to, y } }
      })
    : state.obstacles
  const visibility = state.environmentId === 'env-algae-glow' && activeHazardIds.length > 0
    ? state.baseVisibility * 0.64
    : state.baseVisibility
  return {
    ...state,
    visibility,
    flow: { ...state.baseFlow },
    obstacles,
    telegraphs,
    activeHazardIds,
    hazardCenters,
    safeCenters,
  }
}

export function applyEventWorldEffects(
  state: EnvironmentField,
  event: EcosystemEventState | undefined,
  atMs: number,
): EnvironmentField {
  if (!event || event.phase === 'expired') return state
  const active = event.phase === 'active'
  let visibility = state.visibility
  let flow = { ...state.flow }
  let safeCenters = [...state.safeCenters]
  let activeHazardIds = [...state.activeHazardIds]
  let hazardCenters = { ...state.hazardCenters }
  let telegraphs = [...state.telegraphs]
  const seconds = Math.max(0, atMs - event.activatesAtMs) / 1000
  for (const effect of event.worldEffects) {
    if (effect.type === 'moving-safe-geometry') {
      const previewSeconds = active ? seconds : 0
      safeCenters = [{
        x: pingPong(event.center.x + Math.cos(previewSeconds * effect.flow) * effect.radius, 60, 580),
        y: pingPong(event.center.y + Math.sin(previewSeconds * effect.flow) * effect.radius, 80, 1020),
      }]
    } else if (effect.type === 'sweep-gap') {
      const hazardId = 'event-antibody-sweep'
      if (active) activeHazardIds = [...new Set([...activeHazardIds, hazardId])]
      hazardCenters = { ...hazardCenters, [hazardId]: { ...event.center } }
      telegraphs = [...telegraphs.filter((cue) => cue.hazardId !== hazardId), {
        cueId: 'cue-sweep-direction',
        hazardId,
        shape: 'rings',
        startsAtMs: event.startedAtMs,
        activatesAtMs: event.activatesAtMs,
        center: { ...event.center },
        radius: effect.radius,
      }]
      safeCenters = [{
        x: pingPong(event.center.x + seconds * effect.flow * 90, 70, 570),
        y: event.center.y,
      }]
    } else if (effect.type === 'visibility-current-shift' && active) {
      visibility *= effect.visibilityMultiplier
      const eventFlow = event.aiSignals[0]?.flow ?? { x: effect.flow, y: 0 }
      flow = { x: flow.x + eventFlow.x, y: flow.y + eventFlow.y }
    }
  }
  return { ...state, visibility, flow, safeCenters, activeHazardIds, hazardCenters, telegraphs }
}

export type EnvironmentSample = {
  flow: Vec2
  speedMultiplier: number
  damage: number
  hazardId?: string
  blocked: boolean
  fiberControl?: number
}

/** Growth changes terrain resistance, while every body can still squeeze through. */
export function fiberTraversalFor(radius: number): { control: number; speedMultiplier: number } {
  const rule = getContent().fiberTraversal
  const safeRadius = Number.isFinite(radius) ? radius : 0
  const control = Math.max(0, Math.min(1, (safeRadius - rule.radiusRange[0]) / (rule.radiusRange[1] - rule.radiusRange[0])))
  const [minimum, maximum] = rule.speedMultiplierRange
  return { control, speedMultiplier: minimum + (maximum - minimum) * control }
}

export function sampleEnvironmentField(
  state: EnvironmentField,
  position: Vec2,
  radius: number,
): EnvironmentSample {
  const nearSafeCenter = state.safeCenters.some((center) => distance(center, position) <= state.safeRadius + radius)
  const activeHazard = state.activeHazardIds.find((hazardId) => {
    const center = state.hazardCenters[hazardId]
    const cue = state.telegraphs.find((item) => item.hazardId === hazardId)
    return Boolean(center && cue && distance(center, position) <= cue.radius + radius)
  })
  const touchesAdhesive = state.obstacles.some((obstacle) => (
    obstacle.adhesive && fiberSections(obstacle).some((section) => distanceToSegment(position, section.from, section.to) <= radius + getContent().fiberTraversal.contactPadding)
  ))
  const touchesWall = state.obstacles.some((obstacle) => (
    obstacle.kind === 'chamber-wall' && fiberSections(obstacle).some((section) => distanceToSegment(position, section.from, section.to) <= radius + 5)
  ))
  const acidExposed = state.environmentId === 'env-acid-vesicle'
    && state.activeHazardIds.includes('hazard-acid-discharge')
    && Boolean(activeHazard)
    && !nearSafeCenter
  const damagingHazard = !nearSafeCenter && (acidExposed || Boolean(activeHazard && (
    state.environmentId === 'env-fiber-maze' || state.environmentId === 'env-antibody-storm' || state.environmentId === 'env-abandoned-chamber'
  )))
  return {
    flow: { ...state.flow },
    speedMultiplier: touchesAdhesive ? fiberTraversalFor(radius).speedMultiplier : 1,
    fiberControl: touchesAdhesive ? fiberTraversalFor(radius).control : undefined,
    damage: damagingHazard
      ? state.environmentId === 'env-abandoned-chamber' ? 12 : state.environmentId === 'env-acid-vesicle' || state.environmentId === 'env-antibody-storm' ? 6 : 8
      : 0,
    hazardId: activeHazard,
    blocked: touchesWall,
  }
}

export function resolveEnvironmentMovement(
  state: EnvironmentField,
  from: Vec2,
  to: Vec2,
  radius: number,
): Vec2 {
  for (const obstacle of state.obstacles) {
    // Fibers resist through the movement sample; treating them as walls traps
    // the player permanently on one side, regardless of size or growth.
    if (obstacle.kind !== 'chamber-wall') continue
    for (const section of fiberSections(obstacle)) {
    const crosses = (from.y < section.from.y && to.y + radius >= section.from.y)
      || (from.y > section.from.y && to.y - radius <= section.from.y)
    const withinSpan = to.x >= Math.min(section.from.x, section.to.x) - radius
      && to.x <= Math.max(section.from.x, section.to.x) + radius
    if (crosses && withinSpan) return { x: to.x, y: from.y < section.from.y ? section.from.y - radius : section.from.y + radius }
    }
  }
  return to
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function distanceToSegment(point: Vec2, from: Vec2, to: Vec2): number {
  return distance(point, closestPointOnSegment(point, from, to))
}

export function closestPointOnSegment(point: Vec2, from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return { ...from }
  const ratio = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared))
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

/** The same intact sections drive resistance, sight blocking and rendering. */
export function fiberSections(obstacle: EnvironmentObstacle): Array<{ from: Vec2; to: Vec2 }> {
  const gaps = obstacle.gaps ?? []
  if (gaps.length === 0) return [{ from: obstacle.from, to: obstacle.to }]
  const sections: Array<{ from: Vec2; to: Vec2 }> = []
  const point = (t: number) => ({ x: obstacle.from.x + (obstacle.to.x - obstacle.from.x) * t, y: obstacle.from.y + (obstacle.to.y - obstacle.from.y) * t })
  let start = 0
  for (const gap of gaps) {
    if (gap.fromT > start) sections.push({ from: point(start), to: point(gap.fromT) })
    start = Math.max(start, gap.toT)
  }
  if (start < 1) sections.push({ from: point(start), to: point(1) })
  return sections
}

function pingPong(value: number, min: number, max: number): number {
  const width = max - min
  const phase = ((value - min) % (width * 2) + width * 2) % (width * 2)
  return min + (phase <= width ? phase : width * 2 - phase)
}

function dimensionsFor(state: EnvironmentField): { width: number; height: number } {
  const content = getContent()
  const m0Environment = (content.m0.environments as Array<{ id: string; width: number; height: number }>).find((item) => item.id === state.environmentId)
  const scaleTier = (content.scaleTiers as Array<{ environmentId: string; radiusRange: readonly number[]; worldBodyWidths: number }>).find((item) => item.environmentId === state.environmentId)
  return scaleTier ? worldDimensionsForTier(scaleTier) : { width: m0Environment?.width ?? 640, height: m0Environment?.height ?? 1100 }
}
