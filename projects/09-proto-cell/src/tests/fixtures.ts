import type { BodyShape, EntityState, Vec2 } from '../domain/types'
import type { InteractionContext } from '../game/interactions'

export function vec(x: number, y: number): Vec2 {
  return { x, y }
}

export function circleBody(center: Vec2, radius: number): BodyShape {
  return {
    center: { ...center },
    radius,
    contour: Array.from({ length: 24 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      }
    }),
  }
}

export function entity(id: string, radius: number, position: Vec2 = { x: 0, y: 0 }): EntityState {
  return {
    id,
    body: circleBody(position, radius),
    position: { ...position },
    velocity: { x: 0, y: 0 },
    mass: radius * radius,
    membrane: radius,
    energy: radius,
    faction: id === 'large' ? 'player' : 'neutral',
    role: id === 'large' ? 'player' : 'prey',
    status: 'active',
  }
}

export function entityAt(id: string, x: number, y: number): EntityState {
  return entity(id, 5, { x, y })
}

export function testInteractionContext(overrides: Partial<InteractionContext> = {}): InteractionContext {
  return {
    atMs: 100,
    engulfLocks: new Set<string>(),
    ruptureLossFraction: 0,
    ...overrides,
  }
}
