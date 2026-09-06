import type { BehaviorProfileDefinition } from '../../content'
import { normalize } from '../../domain/math'
import type { EntityState, Vec2 } from '../../domain/types'
import type { MovementIntent } from '../../game/input'

export type BehaviorState =
  | 'idle'
  | 'forage'
  | 'flee'
  | 'regroup'
  | 'steal'
  | 'escape'
  | 'hide'
  | 'ambush'
  | 'pursue'
  | 'recover'
  | 'search'
  | 'harvest'
  | 'patrol'
  | 'charge'

export type BehaviorMemory = {
  state: BehaviorState
  stateStartedAtMs: number
  targetId?: string
  anchor?: Vec2
}

export type BehaviorContext = {
  atMs: number
  nearby: readonly EntityState[]
  profile: BehaviorProfileDefinition
  attractionFields?: ReadonlyArray<{ center: Vec2; radius: number; strength: number; flow?: Vec2 }>
}

export type BehaviorDecision = {
  movement: MovementIntent
  targetId?: string
  presentationState: BehaviorState
  action?: 'consume' | 'split-school' | 'charge'
}

export type BehaviorResult = { memory: BehaviorMemory; decision: BehaviorDecision }
export type BehaviorHandler = (entity: EntityState, memory: BehaviorMemory, context: BehaviorContext) => BehaviorResult

export function activeNeighbors(entity: EntityState, context: BehaviorContext): EntityState[] {
  return context.nearby.filter((item) => item.id !== entity.id && item.status === 'active' && distance(entity.position, item.position) <= context.profile.perceptionRadius)
}

export function nearest(entity: EntityState, candidates: readonly EntityState[]): EntityState | undefined {
  return candidates.reduce<EntityState | undefined>((closest, candidate) => (
    !closest || distance(entity.position, candidate.position) < distance(entity.position, closest.position) ? candidate : closest
  ), undefined)
}

export function movementToward(from: Vec2, to: Vec2, strength = 1): MovementIntent {
  const displacement = { x: to.x - from.x, y: to.y - from.y }
  const direction = normalize(displacement)
  return { direction, strength: direction.x === 0 && direction.y === 0 ? 0 : strength }
}

export function movementAway(from: Vec2, threat: Vec2, strength = 1): MovementIntent {
  return movementToward(from, { x: from.x * 2 - threat.x, y: from.y * 2 - threat.y }, strength)
}

export function deterministicWander(id: string, atMs: number, strength = 0.25): MovementIntent {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 31)
  const segment = Math.floor(atMs / 1800)
  const angle = (((hash ^ Math.imul(segment, 2_654_435_761)) >>> 0) / 4_294_967_296) * Math.PI * 2
  return { direction: { x: Math.cos(angle), y: Math.sin(angle) }, strength }
}

export function transition(
  memory: BehaviorMemory,
  state: BehaviorState,
  atMs: number,
  targetId?: string,
  anchor?: Vec2,
): BehaviorMemory {
  if (memory.state === state && memory.targetId === targetId) return memory
  return { state, stateStartedAtMs: atMs, ...(targetId ? { targetId } : {}), ...(anchor ? { anchor: { ...anchor } } : {}) }
}

export function result(memory: BehaviorMemory, movement: MovementIntent, action?: BehaviorDecision['action']): BehaviorResult {
  return {
    memory,
    decision: {
      movement,
      ...(memory.targetId ? { targetId: memory.targetId } : {}),
      presentationState: memory.state,
      ...(action ? { action } : {}),
    },
  }
}

export function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}
