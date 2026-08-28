import { getContent, type EnvironmentId } from '../content'
import { createRng } from '../domain/rng'
import type { Vec2 } from '../domain/types'
import type { EcosystemEventState } from './events'

export type EnvironmentTelegraph = {
  cueId: string
  hazardId: string
  shape: 'pulse' | 'bubbles' | 'threads' | 'rings' | 'contraction'
  startsAtMs: number
  activatesAtMs: number
  center: Vec2
  radius: number
}

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
  obstacles: Array<{ id: string; kind: 'fiber' | 'chamber-wall'; from: Vec2; to: Vec2; adhesive: boolean }>
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
  const rng = createRng(seed).fork(`field:${environmentId}`)
  const angle = rng.next() * Math.PI * 2
  const center = { x: 100 + rng.next() * 440, y: 160 + rng.next() * 760 }
  return {
    environmentId,
    seed,
    phaseStartedAtMs: atMs,
    visibility: environment.visibility,
    baseVisibility: environment.visibility,
    flow: { x: Math.cos(angle) * environment.viscosity, y: Math.sin(angle) * environment.viscosity },
    baseFlow: { x: Math.cos(angle) * environment.viscosity, y: Math.sin(angle) * environment.viscosity },
    safeCenters: [],
    safeRadius: 92,
    obstacles: environmentId === 'env-fiber-maze'
      ? [{ id: 'fiber-main', kind: 'fiber', from: { x: 90, y: 220 }, to: { x: 550, y: 760 }, adhesive: true }]
      : environmentId === 'env-abandoned-chamber'
        ? [{ id: 'chamber-gate', kind: 'chamber-wall', from: { x: 80, y: 520 }, to: { x: 560, y: 520 }, adhesive: false }]
        : [],
    telegraphs: [{ cueId: rule.cueId, hazardId: rule.hazardId, shape: rule.shape, startsAtMs: atMs, activatesAtMs: atMs + rule.leadMs, center, radius: 90 + rng.int(0, 80) }],
    activeHazardIds: [],
    hazardCenters: { [rule.hazardId]: center },
  }
}

export function stepEnvironmentField(state: EnvironmentField, atMs: number): EnvironmentField {
  const rule = FIELD_RULES[state.environmentId]
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
  const moves = state.environmentId === 'env-acid-vesicle' || state.environmentId === 'env-antibody-storm' || state.environmentId === 'env-abandoned-chamber'
  const hazardCenters = Object.fromEntries(telegraphs.map((cue) => [cue.hazardId, moves ? {
    x: pingPong(cue.center.x + state.flow.x * elapsedSeconds * 180, 70, 570),
    y: pingPong(cue.center.y + state.flow.y * elapsedSeconds * 220, 100, 1000),
  } : cue.center]))
  let safeCenters: Vec2[] = state.environmentId === 'env-acid-vesicle' && (telegraphing || activeHazardIds.length > 0)
    ? Object.values(hazardCenters).map((center) => ({
        x: pingPong(center.x + 320, 70, 570),
        y: pingPong(center.y + 480, 100, 1000),
      }))
    : []
  if (state.environmentId === 'env-antibody-storm' && activeHazardIds.length > 0) {
    safeCenters = Object.values(hazardCenters).map((center) => ({ x: pingPong(center.x + 70, 70, 570), y: center.y }))
  }
  const obstacles = state.environmentId === 'env-abandoned-chamber'
    ? state.obstacles.map((obstacle) => {
        const y = 520 + Math.sin(elapsedSeconds * 0.7) * 105
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
    obstacle.adhesive && distanceToSegment(position, obstacle.from, obstacle.to) <= radius + 16
  ))
  const touchesWall = state.obstacles.some((obstacle) => (
    obstacle.kind === 'chamber-wall' && distanceToSegment(position, obstacle.from, obstacle.to) <= radius + 5
  ))
  const acidExposed = state.environmentId === 'env-acid-vesicle'
    && state.activeHazardIds.includes('hazard-acid-discharge')
    && !nearSafeCenter
  const damagingHazard = !nearSafeCenter && (acidExposed || Boolean(activeHazard && (
    state.environmentId === 'env-fiber-maze' || state.environmentId === 'env-antibody-storm' || state.environmentId === 'env-abandoned-chamber'
  )))
  return {
    flow: { ...state.flow },
    speedMultiplier: touchesAdhesive ? 0.42 : 1,
    damage: damagingHazard ? (state.environmentId === 'env-abandoned-chamber' ? 12 : 8) : 0,
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
    if (obstacle.kind === 'fiber') {
      const fromSide = signedSide(from, obstacle.from, obstacle.to)
      const toSide = signedSide(to, obstacle.from, obstacle.to)
      const nearSegment = distanceToSegment(to, obstacle.from, obstacle.to) <= radius + 2
      if (nearSegment || fromSide * toSide < 0) return { ...from }
      continue
    }
    if (obstacle.kind !== 'chamber-wall') continue
    const crosses = (from.y < obstacle.from.y && to.y + radius >= obstacle.from.y)
      || (from.y > obstacle.from.y && to.y - radius <= obstacle.from.y)
    const withinSpan = to.x >= Math.min(obstacle.from.x, obstacle.to.x) - radius
      && to.x <= Math.max(obstacle.from.x, obstacle.to.x) + radius
    if (crosses && withinSpan) return { x: to.x, y: from.y < obstacle.from.y ? obstacle.from.y - radius : obstacle.from.y + radius }
  }
  return to
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function distanceToSegment(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(point, from)
  const ratio = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared))
  return distance(point, { x: from.x + dx * ratio, y: from.y + dy * ratio })
}

function signedSide(point: Vec2, from: Vec2, to: Vec2): number {
  return (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)
}

function pingPong(value: number, min: number, max: number): number {
  const width = max - min
  const phase = ((value - min) % (width * 2) + width * 2) % (width * 2)
  return min + (phase <= width ? phase : width * 2 - phase)
}
