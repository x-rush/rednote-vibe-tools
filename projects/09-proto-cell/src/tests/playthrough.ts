import type { GameEvent } from '../game/interactions'
import { createGameEngine } from '../game/engine'

export type HeadlessRunOptions = {
  seed: number
  durationMs?: number
  route?: readonly string[]
  policy?: 'balanced' | 'speed' | 'armor' | 'stealth' | 'parasite' | 'swarm'
}

export type HeadlessRunReport = {
  keyEvents: readonly GameEvent[]
  maxEntities: number
  invalidNumbers: readonly string[]
  morphologySignature: string
  endingId?: string
}

const STEP_BATCH_MS = 5 * 1000 / 60

export function runHeadless(options: HeadlessRunOptions): HeadlessRunReport {
  const durationMs = options.durationMs ?? 600_000
  const policy = options.policy ?? 'balanced'
  const engine = createGameEngine({ seed: options.seed, environmentId: options.route?.[0] ?? 'env-clear-drop' })
  const keyEvents: GameEvent[] = []
  const invalidNumbers = new Set<string>()
  let maxEntities = 0
  let endingId: string | undefined
  let consumed = 0
  let simulatedMs = 0

  engine.start()
  while (simulatedMs < durationMs) {
    setPolicyIntent(engine, simulatedMs, policy)
    const elapsed = Math.min(STEP_BATCH_MS, durationMs - simulatedMs)
    engine.advance(elapsed)
    simulatedMs += elapsed

    const events = engine.drainEvents()
    keyEvents.push(...events)
    consumed += events.filter((event) => event.type === 'engulfed' && event.predatorId === 'player').length
    const ending = events.find((event) => event.type === 'ending-reached')
    if (ending?.type === 'ending-reached') endingId = ending.endingId

    const world = engine.renderSnapshot()
    maxEntities = Math.max(maxEntities, world.entities.length)
    inspectNumbers(engine.snapshot(), world.entities, invalidNumbers)
    if (events.some((event) => event.type === 'player-died' || event.type === 'engulfed' && event.preyId === 'player')) break
  }

  const finalWorld = engine.renderSnapshot()
  const finalPlayer = finalWorld.entities.find((entity) => entity.id === finalWorld.playerId)
  const morphologySignature = [
    Math.round(finalPlayer?.mass ?? 0),
    Math.round((finalPlayer?.body.radius ?? 0) * 10),
    consumed,
    policy,
  ].join(':')
  engine.destroy()

  return {
    keyEvents,
    maxEntities,
    invalidNumbers: [...invalidNumbers],
    morphologySignature,
    endingId,
  }
}

function setPolicyIntent(
  engine: ReturnType<typeof createGameEngine>,
  elapsedMs: number,
  policy: NonNullable<HeadlessRunOptions['policy']>,
) {
  const policyOffset = ['balanced', 'speed', 'armor', 'stealth', 'parasite', 'swarm'].indexOf(policy) * 0.47
  const angle = elapsedMs / 4200 + policyOffset
  engine.input.move(
    { x: Math.cos(angle) * 120, y: Math.sin(angle) * 120 },
    { x: 0, y: 0 },
  )
}

function inspectNumbers(
  hud: ReturnType<ReturnType<typeof createGameEngine>['snapshot']>,
  entities: ReturnType<ReturnType<typeof createGameEngine>['renderSnapshot']>['entities'],
  issues: Set<string>,
) {
  for (const [key, value] of Object.entries(hud)) {
    if (typeof value === 'number' && !Number.isFinite(value)) issues.add(`hud.${key}`)
  }
  for (const entity of entities) {
    for (const [key, value] of Object.entries({
      x: entity.position.x,
      y: entity.position.y,
      radius: entity.body.radius,
      mass: entity.mass,
      membrane: entity.membrane,
      energy: entity.energy,
    })) {
      if (!Number.isFinite(value)) issues.add(`entity.${entity.id}.${key}`)
    }
  }
}
