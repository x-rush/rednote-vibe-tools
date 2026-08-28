import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createController, type AppController } from './app/controller'
import { wrappedModalFocusIndex } from './app/focus'
import rawContent from './content/content.json'
import { ContentValidationError, getContent, type ContentPack } from './content'
import { createGameEngine } from './game/engine'
import type { GameEvent } from './game/interactions'
import {
  continueMutationContext,
  createMutationContext,
  installMutation,
  offerMutations,
  type MutationChoice,
  type MutationContext,
} from './evolution/mutation'
import { EvolutionOverlay } from './ui/EvolutionOverlay'
import { GameCanvas } from './ui/GameCanvas'
import { Hud } from './ui/Hud'
import { Archive } from './ui/Archive'
import { createViewModel } from './app/view-model'
import './App.css'

function App() {
  try {
    return <GameApp content={getContent()} />
  } catch (error) {
    if (!(error instanceof ContentValidationError)) throw error
    return (
      <main className="hatchery-shell">
        <section className="hatchery-card" role="alert">
          <h1>{rawContent.ui.screens.contentErrorTitle}</h1>
          <p>{rawContent.ui.screens.contentErrorDescription}</p>
          <small>{error.issues.length}</small>
        </section>
      </main>
    )
  }
}

function GameApp({ content }: { content: ContentPack }) {
  const controllerRef = useRef<AppController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = createController({
      createEngine: ({ seed, originId }) => createGameEngine({ seed, originId: originId as `origin-${string}`, environmentId: 'env-clear-drop' }),
      nextSeed: (seed) => (seed + 1) >>> 0,
      recordResult: () => undefined,
    })
  }
  const controller = controllerRef.current
  const [view, setView] = useState(() => controller.snapshot())
  const mutationContextRef = useRef<MutationContext>(createMutationContext('env-clear-drop'))
  const mutationChoicesRef = useRef<MutationChoice[]>([])
  const [mutationChoices, setMutationChoices] = useState<MutationChoice[]>([])
  const sync = useCallback(() => setView(controller.snapshot()), [controller])
  const modalButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => controller.destroy(), [controller])

  useEffect(() => {
    document.title = content.meta.title
  }, [])

  useEffect(() => {
    if (view.screen !== 'paused' && view.screen !== 'result') return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frameId = window.requestAnimationFrame(() => modalButtonRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frameId)
      previousFocus?.focus()
    }
  }, [view.screen])

  useEffect(() => {
    if (view.screen === 'lab' || view.screen === 'result') return
    const timer = window.setInterval(sync, 100)
    return () => window.clearInterval(timer)
  }, [sync, view.screen])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) controller.pause('visibility')
      else controller.resume('visibility')
      sync()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [controller, sync])

  const handleEvents = useCallback((events: readonly GameEvent[]) => {
    events.forEach((event) => controller.handle(event))
    const canEvolve = !['lab', 'result'].includes(controller.snapshot().screen)
      && mutationChoicesRef.current.length === 0
      && events.some((event) => event.type === 'mutation-ready')
    if (canEvolve) {
      const evolution = controller.engine()?.evolutionSnapshot()
      if (evolution) {
        mutationContextRef.current = {
          ...mutationContextRef.current,
          organIds: evolution.organelles.map((organ) => organ.id),
          matureOrganIds: evolution.organelles.filter((organ) => organ.stage === 'mature').map((organ) => organ.id),
          installed: [...evolution.organelles],
          stability: evolution.stability,
          capacity: evolution.capacity,
        }
      }
      const choices = offerMutations(mutationContextRef.current)
      if (choices.length > 0) {
        controller.engine()?.pause('evolution')
        mutationChoicesRef.current = choices
        setMutationChoices(choices)
      }
    }
    sync()
  }, [controller, sync])

  const confirmMutation = useCallback((choice: MutationChoice) => {
    const result = installMutation(mutationContextRef.current, choice)
    controller.engine()?.applyMutation(result)
    mutationContextRef.current = continueMutationContext(mutationContextRef.current, result)
    controller.handle({
      type: 'mutation-selected',
      entityId: 'player',
      organId: choice.organId,
      action: choice.action,
      atMs: controller.engine()?.snapshot().elapsedMs ?? 0,
    })
    mutationChoicesRef.current = []
    setMutationChoices([])
    controller.engine()?.resume('evolution')
    sync()
  }, [controller, sync])

  const resetMutationRun = useCallback(() => {
    mutationContextRef.current = createMutationContext('env-clear-drop')
    mutationChoicesRef.current = []
    setMutationChoices([])
  }, [])

  const engine = controller.engine()
  const archiveModel = createViewModel(view, content).archive
  if (view.screen !== 'lab' && engine) {
    return (
      <main className="game-shell">
        <div className="game-stage" inert={mutationChoices.length > 0} aria-hidden={mutationChoices.length > 0 || undefined}>
          <GameCanvas engine={engine} label={content.ui.labels.gameCanvas} onEvents={handleEvents} />
          {view.hud && view.screen !== 'result' && (
            <Hud
              snapshot={view.hud}
              onPause={() => {
                controller.pause('user')
                sync()
              }}
            />
          )}
          {view.screen === 'paused' && (
          <section className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" onKeyDown={trapModalFocus}>
            <p className="hatchery-region">{content.ui.labels.openingRegion}</p>
            <h2 id="pause-title">{content.ui.screens.pauseTitle}</h2>
            <p>{content.ui.screens.pauseDescription}</p>
            <div className="game-overlay__actions">
              <button
                ref={modalButtonRef}
                className="hatchery-start"
                type="button"
                onClick={() => {
                  controller.resume('user')
                  sync()
                }}
              >
                {content.ui.actions.resume}
              </button>
              <button
                className="game-overlay__secondary"
                type="button"
                onClick={() => {
                  resetMutationRun()
                  controller.restart()
                  sync()
                }}
              >
                {content.ui.actions.restart}
              </button>
            </div>
          </section>
          )}
          {view.screen === 'result' && archiveModel && (
            <Archive
              model={archiveModel}
              restartButtonRef={modalButtonRef}
              onKeyDown={trapModalFocus}
              onRestart={() => {
                resetMutationRun()
                controller.restart()
                sync()
              }}
            />
          )}
        </div>
        {mutationChoices.length > 0 && <EvolutionOverlay choices={mutationChoices} onConfirm={confirmMutation} />}
      </main>
    )
  }

  return (
    <main className="hatchery-shell">
      <div className="hatchery-ambient" aria-hidden="true" />
      <section className="hatchery-card" aria-labelledby="game-title">
        <p className="hatchery-region">{content.ui.labels.openingRegion}</p>
        <div className="prototype-cell" role="img" aria-label={content.ui.labels.prototypeCell}>
          <span className="prototype-cell__membrane" />
          <span className="prototype-cell__core" />
          <span className="prototype-cell__organelle prototype-cell__organelle--one" />
          <span className="prototype-cell__organelle prototype-cell__organelle--two" />
        </div>
        <div className="hatchery-copy">
          <h1 id="game-title">{content.meta.title}</h1>
          <p>{content.meta.tagline}</p>
        </div>
        <button
          className="hatchery-start"
          type="button"
          onClick={() => {
            resetMutationRun()
            controller.startRun({ seed: Date.now() >>> 0, originId: 'origin-primal-cell' })
            sync()
          }}
        >
          {content.ui.actions.start}
        </button>
        <small>{content.meta.fictionDisclaimer}</small>
      </section>
    </main>
  )
}

function trapModalFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
  const targetIndex = wrappedModalFocusIndex(controls.indexOf(document.activeElement as HTMLElement), controls.length, event.shiftKey)
  if (targetIndex === undefined) return
  event.preventDefault()
  controls[targetIndex]?.focus()
}

export default App
