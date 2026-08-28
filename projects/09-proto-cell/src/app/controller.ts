import type { ProtoCellEngine, PauseReason } from '../game/engine'
import type { GameEvent } from '../game/interactions'

export type ControllerDependencies = {
  createEngine(input: { seed: number; originId: string }): ProtoCellEngine
  nextSeed(seed: number): number
  recordResult(result: { seed: number; originId: string; cause: string; survivalMs: number }): void
}

export type ControllerSnapshot = {
  screen: 'lab' | 'playing' | 'paused' | 'result'
  seed?: number
  originId?: string
  cause?: string
  hud?: ReturnType<ProtoCellEngine['snapshot']>
}

export type AppController = {
  startRun(input: { seed: number; originId: string }): void
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
  handle(event: GameEvent): void
  restart(): void
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

  return {
    startRun(input) {
      activeEngine?.destroy()
      pauseReasons.clear()
      seed = input.seed
      originId = input.originId
      cause = undefined
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
      if (event.type !== 'player-died') return
      if (!activeEngine || seed === undefined || !originId || screen === 'result') return

      cause = event.cause
      const survivalMs = activeEngine.snapshot().elapsedMs
      activeEngine.pause('user')
      dependencies.recordResult({ seed, originId, cause, survivalMs })
      screen = 'result'
    },
    restart() {
      if (seed === undefined || !originId) return
      const nextSeed = dependencies.nextSeed(seed)
      this.startRun({ seed: nextSeed, originId })
    },
    snapshot() {
      return {
        screen,
        seed,
        originId,
        cause,
        hud: activeEngine?.snapshot(),
      }
    },
    engine() {
      return activeEngine
    },
    destroy() {
      activeEngine?.destroy()
      activeEngine = undefined
      pauseReasons.clear()
      screen = 'lab'
    },
  }
}
