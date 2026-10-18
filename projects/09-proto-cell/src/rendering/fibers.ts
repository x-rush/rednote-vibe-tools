import type { Vec2 } from '../domain/types'
import { fiberTraversalFor } from '../world/environments'
import { getContent } from '../content'

/** A local elastic indentation: no timer or extra motion for stationary bodies. */
export function fiberStrandPoints(from: Vec2, to: Vec2, bodies: readonly { position: Vec2; radius: number }[]): Vec2[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const padding = getContent().fiberTraversal.contactPadding
  return Array.from({ length: 33 }, (_, index) => {
    const t = index / 32
    const point = { x: from.x + dx * t, y: from.y + dy * t }
    if (index === 0 || index === 32) return point
    let displacement = { x: 0, y: 0 }
    let strongest = 0
    for (const body of bodies) {
      const offset = { x: point.x - body.position.x, y: point.y - body.position.y }
      const distance = Math.hypot(offset.x, offset.y)
      const overlap = body.radius + padding - distance
      if (overlap <= 0) continue
      const strength = overlap * (0.5 + fiberTraversalFor(body.radius).control * 0.5)
      if (strength <= strongest) continue
      strongest = strength
      const normal = distance > 0.001 ? { x: offset.x / distance, y: offset.y / distance } : { x: -dy / length, y: dx / length }
      displacement = { x: normal.x * strength, y: normal.y * strength }
    }
    return { x: point.x + displacement.x, y: point.y + displacement.y }
  })
}
