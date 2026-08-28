import { getContent, type EnvironmentId, type EventId } from '../content'
import { createRng } from '../domain/rng'
import type { Vec2 } from '../domain/types'

export type EventContext = {
  seed: number
  environmentId: EnvironmentId
  atMs: number
  center: Vec2
}

export type EventVariant = {
  id: string
  radius: number
  resourceCount: number
  attractionStrength: number
  flow: number
}

export type EcosystemEventState = {
  id: EventId
  variantId: string
  variant: EventVariant
  phase: 'telegraph' | 'active' | 'expired'
  startedAtMs: number
  activatesAtMs: number
  endsAtMs: number
  center: Vec2
  spawnRequests: Array<{ role: 'resource' | 'predator'; count: number; atMs: number; center: Vec2; radius: number }>
  aiSignals: Array<{ type: 'attraction-field'; audience: 'non-player'; center: Vec2; radius: number; strength: number; flow: Vec2 }>
  telegraphs: Array<{ cueId: string; startsAtMs: number; endsAtMs: number; center: Vec2; radius: number }>
}

export function startEvent(eventId: EventId, context: EventContext): EcosystemEventState {
  const event = getContent().events.find((item) => item.id === eventId)
  if (!event) throw new RangeError(`Unknown event id: ${eventId}`)
  if (!event.environmentIds.includes(context.environmentId)) throw new RangeError(`Event ${eventId} is unavailable in ${context.environmentId}`)

  const rng = createRng(context.seed).fork(`${eventId}:${context.atMs}`)
  const variant = event.variants[rng.int(0, event.variants.length)]
  if (!variant) throw new RangeError(`Event ${eventId} has no variants`)
  const durationMs = Math.round((event.durationSec[0] + rng.next() * (event.durationSec[1] - event.durationSec[0])) * 1000)
  const flowAngle = rng.next() * Math.PI * 2
  const activatesAtMs = context.atMs + event.telegraphLeadMs
  return {
    id: event.id,
    variantId: variant.id,
    variant,
    phase: 'telegraph',
    startedAtMs: context.atMs,
    activatesAtMs,
    endsAtMs: activatesAtMs + durationMs,
    center: { ...context.center },
    spawnRequests: [
      { role: 'resource', count: variant.resourceCount, atMs: activatesAtMs, center: { ...context.center }, radius: variant.radius },
      { role: 'predator', count: Math.max(1, Math.round(variant.attractionStrength * 3)), atMs: activatesAtMs + 3200, center: { ...context.center }, radius: variant.radius * 1.4 },
    ],
    aiSignals: [{
      type: 'attraction-field',
      audience: 'non-player',
      center: { ...context.center },
      radius: variant.radius * 1.5,
      strength: variant.attractionStrength,
      flow: { x: Math.cos(flowAngle) * variant.flow, y: Math.sin(flowAngle) * variant.flow },
    }],
    telegraphs: event.telegraphIds.map((cueId) => ({
      cueId,
      startsAtMs: context.atMs,
      endsAtMs: activatesAtMs,
      center: { ...context.center },
      radius: variant.radius,
    })),
  }
}

export function stepEvent(state: EcosystemEventState, atMs: number): EcosystemEventState {
  const phase = atMs >= state.endsAtMs ? 'expired' : atMs >= state.activatesAtMs ? 'active' : 'telegraph'
  return phase === state.phase ? state : { ...state, phase }
}
