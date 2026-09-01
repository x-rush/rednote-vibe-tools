import type { ProtoCellEngine, PauseReason } from '../game/engine'
import type { GameEvent } from '../game/interactions'
import type { LifeEventLogEntry } from '../progression/archive'
import type { EnvironmentId, ModifierId } from '../content'

export type RunStartInput = { seed: number; originId: string; modifierIds?: readonly ModifierId[]; route?: readonly EnvironmentId[]; runOrdinal?: number }

export type ControllerDependencies = {
  createEngine(input: RunStartInput): ProtoCellEngine
  nextSeed(seed: number): number
  recordResult(result: { seed: number; originId: string; cause: string; survivalMs: number }): void
}

export type ControllerSnapshot = {
  screen: 'lab' | 'playing' | 'paused' | 'result'
  seed?: number
  originId?: string
  cause?: string
  hud?: ReturnType<ProtoCellEngine['snapshot']>
  eventLog: readonly LifeEventLogEntry[]
}

export type AppController = {
  startRun(input: RunStartInput): void
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
  handle(event: GameEvent): void
  restart(): void
  returnToLab(): void
  snapshot(): ControllerSnapshot
  engine(): ProtoCellEngine | undefined
  destroy(): void
}

export function createController(dependencies: ControllerDependencies): AppController {
  const pauseReasons = new Set<PauseReason>()
  let activeEngine: ProtoCellEngine | undefined
  let screen: ControllerSnapshot['screen'] = 'lab'
  let seed: number | undefined
  let originId: string | undefined
  let cause: string | undefined
  let eventLog: LifeEventLogEntry[] = []
  let runOptions: Pick<RunStartInput, 'modifierIds' | 'route' | 'runOrdinal'> = {}

  return {
    startRun(input) {
      activeEngine?.destroy()
      pauseReasons.clear()
      seed = input.seed
      originId = input.originId
      cause = undefined
      eventLog = []
      runOptions = { modifierIds: input.modifierIds, route: input.route, runOrdinal: input.runOrdinal }
      activeEngine = dependencies.createEngine(input)
      activeEngine.start()
      screen = 'playing'
    },
    pause(reason) {
      if (!activeEngine || screen === 'lab' || screen === 'result') return
      pauseReasons.add(reason)
      activeEngine.pause(reason)
      screen = 'paused'
    },
    resume(reason) {
      if (!activeEngine || screen === 'lab' || screen === 'result') return
      pauseReasons.delete(reason)
      activeEngine.resume(reason)
      screen = pauseReasons.size === 0 ? 'playing' : 'paused'
    },
    handle(event) {
      if (!activeEngine || seed === undefined || !originId || screen === 'result') return

      const hud = activeEngine.snapshot()
      eventLog.push({
        sequence: eventLog.length + 1,
        event: { ...event },
        snapshot: {
          runSeed: seed,
          elapsedMs: hud.elapsedMs,
          environmentId: event.type === 'route-selected' ? event.environmentId : hud.environmentId,
          biomass: hud.biomass,
          peakBiomass: hud.peakBiomass,
          organelleIds: activeEngine.evolutionSnapshot().organelles.map((organ) => organ.id),
          morphology: activeEngine.morphologySnapshot(),
        },
      })
      if (event.type !== 'player-died' && event.type !== 'ending-reached') return

      cause = event.type === 'player-died' ? event.cause : event.endingId
      const survivalMs = hud.elapsedMs
      activeEngine.pause('user')
      dependencies.recordResult({ seed, originId, cause, survivalMs })
      screen = 'result'
    },
    restart() {
      if (seed === undefined || !originId) return
      const nextSeed = dependencies.nextSeed(seed)
      this.startRun({ seed: nextSeed, originId, ...runOptions, runOrdinal: (runOptions.runOrdinal ?? 0) + 1 })
    },
    returnToLab() {
      activeEngine?.destroy()
      activeEngine = undefined
      pauseReasons.clear()
      screen = 'lab'
    },
    snapshot() {
      return {
        screen,
        seed,
        originId,
        cause,
        hud: activeEngine?.snapshot(),
        eventLog: eventLog.map((entry) => ({
          ...entry,
          snapshot: entry.snapshot ? {
            ...entry.snapshot,
            organelleIds: [...entry.snapshot.organelleIds],
            morphology: entry.snapshot.morphology ? {
              ...entry.snapshot.morphology,
              organelles: entry.snapshot.morphology.organelles.map((organ) => ({ ...organ })),
            } : undefined,
          } : undefined,
        })),
      }
    },
    engine() {
      return activeEngine
    },
    destroy() {
      activeEngine?.destroy()
      activeEngine = undefined
      pauseReasons.clear()
      eventLog = []
      screen = 'lab'
    },
  }
}
