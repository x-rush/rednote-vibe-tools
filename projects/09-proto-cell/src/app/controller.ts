import type { ProtoCellEngine, PauseReason } from '../game/engine'
import type { GameEvent } from '../game/interactions'
import type { LifeEventLogEntry } from '../progression/archive'
import type { EnvironmentId, ModifierId, OrganelleId } from '../content'

export type RunStartInput = { seed: number; originId: string; modifierIds?: readonly ModifierId[]; route?: readonly EnvironmentId[]; runOrdinal?: number; inheritedOrganelleIds?: readonly OrganelleId[]; lineageArchetypeId?: string }

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
  handleMany(events: readonly GameEvent[]): void
  restart(): void
  returnToLab(): void
  snapshot(options?: { includeEventLog?: boolean | 'result' }): ControllerSnapshot
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
  let runOptions: Pick<RunStartInput, 'modifierIds' | 'route' | 'runOrdinal' | 'inheritedOrganelleIds' | 'lineageArchetypeId'> = {}

  return {
    startRun(input) {
      activeEngine?.destroy()
      pauseReasons.clear()
      seed = input.seed
      originId = input.originId
      cause = undefined
      eventLog = []
      runOptions = { modifierIds: input.modifierIds, route: input.route, runOrdinal: input.runOrdinal,
        inheritedOrganelleIds: input.inheritedOrganelleIds ? [...input.inheritedOrganelleIds] : undefined, lineageArchetypeId: input.lineageArchetypeId }
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
      this.handleMany([event])
    },
    handleMany(batch) {
      if (!batch.length || !activeEngine || seed === undefined || !originId || screen === 'result') return

      const hud = activeEngine.snapshot()
      // All events drained from one simulation frame see the same engine state.
      const organelleIds = activeEngine.evolutionSnapshot().organelles.map((organ) => organ.id)
      const morphology = activeEngine.morphologySnapshot()
      const routeCounts = activeEngine.renderSnapshot().playerBuild?.routeCounts
      for (const event of batch) {
        if (screen === 'result') break
        eventLog.push({
          sequence: eventLog.length + 1,
          event: { ...event },
          snapshot: {
            runSeed: seed,
            elapsedMs: hud.elapsedMs,
            environmentId: event.type === 'route-selected' ? event.environmentId : hud.environmentId,
            biomass: hud.biomass,
            peakBiomass: hud.peakBiomass,
            organelleIds,
            morphology,
            bodyStage: hud.bodyStage,
            formId: hud.formId,
            tierIndex: hud.tierIndex,
            buildRouteCounts: routeCounts,
            journeyStageIndex: Math.max(0, hud.journeyIndex - 1),
          },
        })
        if (event.type !== 'player-died' && event.type !== 'ending-reached') continue

        cause = event.type === 'player-died' ? event.cause : event.endingId
        const survivalMs = hud.elapsedMs
        activeEngine.pause('user')
        dependencies.recordResult({ seed, originId, cause, survivalMs })
        screen = 'result'
      }
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
    snapshot(options) {
      return {
        screen,
        seed,
        originId,
        cause,
        hud: activeEngine?.snapshot(),
        eventLog: options?.includeEventLog === false || options?.includeEventLog === 'result' && screen !== 'result' ? [] : eventLog.map((entry) => ({
          ...entry,
          snapshot: entry.snapshot ? {
            ...entry.snapshot,
            organelleIds: [...entry.snapshot.organelleIds],
            buildRouteCounts: entry.snapshot.buildRouteCounts ? { ...entry.snapshot.buildRouteCounts } : undefined,
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
