import type { EntityFaction, EntityRole, EntityState, Vec2 } from '../domain/types'

export type EntityDefinition = {
  id: string
  role: EntityRole
  faction: EntityFaction
  radius: number
  mass: number
  membrane: number
  energy: number
  maxSpeed: number
  visualRecipeId: string
  contactDamage?: ContactDamageDefinition
}

export type ContactDamageDefinition = {
  source: 'acid' | 'electric' | 'spine' | 'ram'
  amount: number
  periodMs: number
  activeMs: number
  phaseOffsetMs: number
}

export type EntitySpawn = {
  id: string
  position: Vec2
  velocity?: Vec2
}

export type SpawnedEntityState = EntityState & {
  definitionId: string
  visualRecipeId: string
  maxSpeed: number
  contactDamage?: ContactDamageDefinition
}

export function createEntity(definition: EntityDefinition, spawn: EntitySpawn): SpawnedEntityState {
  return {
    id: spawn.id,
    definitionId: definition.id,
    visualRecipeId: definition.visualRecipeId,
    maxSpeed: definition.maxSpeed,
    contactDamage: definition.contactDamage ? { ...definition.contactDamage } : undefined,
    body: circleBody(spawn.position, definition.radius),
    position: { ...spawn.position },
    velocity: spawn.velocity ? { ...spawn.velocity } : { x: 0, y: 0 },
    mass: definition.mass,
    membrane: definition.membrane,
    energy: definition.energy,
    faction: definition.faction,
    role: definition.role,
    status: 'active',
  }
}

function circleBody(center: Vec2, radius: number) {
  return {
    center: { ...center },
    radius,
    contour: Array.from({ length: 16 }, (_, index) => {
      const angle = index / 16 * Math.PI * 2
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      }
    }),
  }
}
