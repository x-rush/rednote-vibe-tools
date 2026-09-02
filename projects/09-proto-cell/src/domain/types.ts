export type Vec2 = {
  x: number
  y: number
}

export type BodyShape = {
  center: Vec2
  radius: number
  contour: readonly Vec2[]
}

export type EntityFaction = 'player' | 'neutral' | 'hostile'

export type EntityRole =
  | 'player'
  | 'nutrient'
  | 'prey'
  | 'competitor'
  | 'scavenger'
  | 'predator'
  | 'elite'
  | 'boss'
  | 'fragment'

export type EntityStatus = 'active' | 'engulfed' | 'ruptured'

export type EntityState = {
  id: string
  body: BodyShape
  position: Vec2
  velocity: Vec2
  mass: number
  membrane: number
  energy: number
  faction: EntityFaction
  role: EntityRole
  status: EntityStatus
  spawnedAtMs?: number
  materializingUntilMs?: number
  arrivalPhase?: 'approach' | 'alert'
  alertedAtMs?: number
  arrivalReleaseUntilMs?: number
  behaviorProfileId?: `behavior-${string}`
  behaviorState?: string
  ecologyGroupId?: string
}
