import type { MovementIntent } from '../game/input'
import type { Vec2 } from '../domain/types'
import type { EvolvedEntityState } from './organs'
import type { InstalledOrganelle } from './organs'

export type SwarmBody = {
  id: string
  mass: number
  position: Vec2
  velocity: Vec2
  membrane: number
  energy: number
  stability: number
  status: EvolvedEntityState['status']
  organelles: InstalledOrganelle[]
}

export type SplitResult = {
  children: SwarmBody[]
  lostMass: number
}

export function splitBody(
  entity: EvolvedEntityState,
  options: { count: number; lossFraction: number },
): SplitResult {
  const count = Math.max(2, Math.min(4, Math.floor(options.count)))
  const lossFraction = Math.max(0, Math.min(0.5, options.lossFraction))
  const lostMass = entity.mass * lossFraction
  const childMass = (entity.mass - lostMass) / count
  const formationRadius = Math.sqrt(childMass) * 0.45 + 4
  const organelles = entity.installedOrganelles

  return {
    lostMass,
    children: Array.from({ length: count }, (_, index) => {
      const angle = index / count * Math.PI * 2
      return {
        id: `${entity.id}-child-${index}`,
        mass: childMass,
        position: {
          x: entity.position.x + Math.cos(angle) * formationRadius,
          y: entity.position.y + Math.sin(angle) * formationRadius,
        },
        velocity: { ...entity.velocity },
        membrane: entity.membrane / count,
        energy: entity.energy / count,
        stability: entity.stability,
        status: 'active',
        organelles: organelles.filter((_, organIndex) => organIndex % count === index),
      }
    }),
  }
}

export function stepSwarm(
  children: readonly SwarmBody[],
  intent: MovementIntent,
  stepMs: number,
  speedMultiplier = 1,
): SwarmBody[] {
  if (children.length === 0) return []
  const seconds = Math.max(0, stepMs) / 1000
  const centroid = averagePosition(children)
  const formationRadius = Math.max(10, Math.sqrt(children.reduce((sum, child) => sum + child.mass, 0) / children.length))

  return children.map((child, index) => {
    const angle = index / children.length * Math.PI * 2
    const target = {
      x: centroid.x + Math.cos(angle) * formationRadius,
      y: centroid.y + Math.sin(angle) * formationRadius,
    }
    const velocity = {
      x: child.velocity.x * 0.82 + intent.direction.x * intent.strength * 72 * speedMultiplier * 0.18 + (target.x - child.position.x) * 2.4,
      y: child.velocity.y * 0.82 + intent.direction.y * intent.strength * 72 * speedMultiplier * 0.18 + (target.y - child.position.y) * 2.4,
    }
    return {
      ...child,
      velocity,
      position: {
        x: child.position.x + velocity.x * seconds,
        y: child.position.y + velocity.y * seconds,
      },
    }
  })
}

export function tryFuse(
  children: readonly SwarmBody[],
  options: { proximity: number; stableForMs: number; requiredStableMs: number },
): SwarmBody | undefined {
  if (
    children.length < 2
    || children.some((child) => child.status !== 'active' || child.mass <= 0)
    || options.stableForMs < options.requiredStableMs
  ) return undefined
  for (let first = 0; first < children.length; first += 1) {
    for (let second = first + 1; second < children.length; second += 1) {
      if (distance(children[first].position, children[second].position) > options.proximity) return undefined
    }
  }

  const mass = children.reduce((sum, child) => sum + child.mass, 0)
  const position = weightedPosition(children, mass)
  return {
    id: children[0].id.replace(/-child-\d+$/, ''),
    mass,
    position,
    velocity: averageVelocity(children),
    membrane: children.reduce((sum, child) => sum + child.membrane, 0),
    energy: children.reduce((sum, child) => sum + child.energy, 0),
    stability: children.reduce((sum, child) => sum + child.stability * child.mass, 0) / mass,
    status: 'active',
    organelles: children.flatMap((child) => child.organelles),
  }
}

export function advanceFusionStability(
  children: readonly SwarmBody[],
  previousStableMs: number,
  stepMs: number,
  proximity: number,
): number {
  if (children.length < 2) return 0
  for (let first = 0; first < children.length; first += 1) {
    for (let second = first + 1; second < children.length; second += 1) {
      if (distance(children[first].position, children[second].position) > proximity) return 0
    }
  }
  return previousStableMs + Math.max(0, stepMs)
}

function averagePosition(children: readonly SwarmBody[]): Vec2 {
  return {
    x: children.reduce((sum, child) => sum + child.position.x, 0) / children.length,
    y: children.reduce((sum, child) => sum + child.position.y, 0) / children.length,
  }
}

function weightedPosition(children: readonly SwarmBody[], totalMass: number): Vec2 {
  return {
    x: children.reduce((sum, child) => sum + child.position.x * child.mass, 0) / totalMass,
    y: children.reduce((sum, child) => sum + child.position.y * child.mass, 0) / totalMass,
  }
}

function averageVelocity(children: readonly SwarmBody[]): Vec2 {
  return {
    x: children.reduce((sum, child) => sum + child.velocity.x, 0) / children.length,
    y: children.reduce((sum, child) => sum + child.velocity.y, 0) / children.length,
  }
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}
