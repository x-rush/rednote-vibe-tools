import { getContent } from '../content'
import type { Vec2 } from '../domain/types'
import { closestPointOnSegment, fiberSections, type EnvironmentField, type FiberGap, type TerrainBreak } from './environments'

type Body = { position: Vec2; radius: number }
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

export function territorySightRadius(tierIndex: number, progress: number, radius: number, visibility: number): number {
  const [minimum, maximum] = getContent().ecosystems[tierIndex]?.sightBodyWidths ?? [7, 10]
  const growth = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  return Math.max(1, Number.isFinite(radius) ? radius : 1) * 2 * (minimum + (maximum - minimum) * growth) * Math.max(0.1, Math.min(1, Number.isFinite(visibility) ? visibility : 1))
}

export function fiberConceals(field: EnvironmentField, observer: Body, target: Body): boolean {
  const rule = getContent().fiberTraversal
  if (target.radius > rule.coverMaxRadius || target.radius >= observer.radius * 0.9
    || distance(observer.position, target.position) <= observer.radius + target.radius + 16) return false
  const path = { x: target.position.x - observer.position.x, y: target.position.y - observer.position.y }
  const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x
  return field.obstacles.some((obstacle) => obstacle.kind === 'fiber' && fiberSections(obstacle).some((section) => {
    if (distance(target.position, closestPointOnSegment(target.position, section.from, section.to)) > target.radius + rule.coverPadding) return false
    const line = { x: section.to.x - section.from.x, y: section.to.y - section.from.y }
    const offset = { x: section.from.x - observer.position.x, y: section.from.y - observer.position.y }
    const denominator = cross(path, line)
    if (Math.abs(denominator) < 0.000001) return false
    const along = cross(offset, line) / denominator
    const across = cross(offset, path) / denominator
    return along > 0 && along < 1 && across >= 0 && across <= 1
  }))
}

export function stepFiberTerrain(field: EnvironmentField, bodies: readonly (Body & { pushing: boolean })[], deltaMs: number, atMs: number): { field: EnvironmentField; breaks: TerrainBreak[] } {
  const rule = getContent().fiberTraversal
  const breaks: TerrainBreak[] = []
  const obstacles = field.obstacles.map((obstacle) => {
    const chamber = obstacle.kind === 'chamber-wall' && field.environmentId === 'env-abandoned-chamber'
    if (obstacle.kind !== 'fiber' && !chamber) return obstacle
    const threshold = chamber ? getContent().lateEcology.chamberBreak.radius : rule.breakRadius
    const holdMs = chamber ? getContent().lateEcology.chamberBreak.holdMs : rule.breakHoldMs
    let contact: { body: Body; point: Vec2 } | undefined
    for (const body of bodies) {
      if (!body.pushing || body.radius < threshold) continue
      for (const section of fiberSections(obstacle)) {
        const point = closestPointOnSegment(body.position, section.from, section.to)
        if (distance(point, body.position) <= body.radius + rule.contactPadding) { contact = { body, point }; break }
      }
      if (contact) break
    }
    if (!contact) return obstacle.strainMs ? { ...obstacle, strainMs: 0, strainPosition: undefined } : obstacle
    const { body, point } = contact
    const stillPushingSamePlace = obstacle.strainPosition && distance(point, obstacle.strainPosition) < body.radius
    const strainMs = (stillPushingSamePlace ? obstacle.strainMs ?? 0 : 0) + Math.max(0, deltaMs)
    if (strainMs < holdMs) return { ...obstacle, strainMs, strainPosition: point }
    const dx = obstacle.to.x - obstacle.from.x, dy = obstacle.to.y - obstacle.from.y
    const length = Math.hypot(dx, dy)
    if (length < 1) return obstacle
    const t = ((point.x - obstacle.from.x) * dx + (point.y - obstacle.from.y) * dy) / (length * length)
    const radius = body.radius * rule.gapBodyRadii
    const gaps: FiberGap[] = []
    for (const gap of [...(obstacle.gaps ?? []), { fromT: Math.max(0, t - radius / length), toT: Math.min(1, t + radius / length), atMs }].sort((a, b) => a.fromT - b.fromT)) {
      const previous = gaps.at(-1)
      if (previous && previous.toT >= gap.fromT) { previous.toT = Math.max(previous.toT, gap.toT); previous.atMs = Math.max(previous.atMs, gap.atMs); previous.natural = previous.natural === true && 'natural' in gap && gap.natural === true }
      else gaps.push({ ...gap })
    }
    breaks.push({ obstacleId: obstacle.id, position: point, radius, atMs })
    return { ...obstacle, gaps, strainMs: 0, strainPosition: undefined }
  })
  return { field: { ...field, obstacles, recentBreaks: [...(field.recentBreaks ?? []).filter((record) => atMs - record.atMs < 1100), ...breaks].slice(-8) }, breaks }
}
