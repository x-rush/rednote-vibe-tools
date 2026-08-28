import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createController, type AppController } from './app/controller'
import { wrappedModalFocusIndex } from './app/focus'
import rawContent from './content/content.json'
import { ContentValidationError, getContent, type ContentPack, type ModifierId, type OriginId } from './content'
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
import { createArchiveViewModelFromSummary, createViewModel } from './app/view-model'
import { createDefaultSave } from './storage/codec'
import { awardGenes, unlockNode } from './progression/genes'
import { applyModifiers, dailySeed } from './progression/challenges'
import { Lab, type LabPanelId } from './ui/Lab'
import { GeneGraph } from './ui/GeneGraph'
import { Codex } from './ui/Codex'
import { advanceCodex } from './progression/codex'
import { createRepository, type GameRepository } from './storage/repository'
import type { RepositoryMode } from './storage/repository'
import type { SaveIssue } from './storage/codec'
import { createBrowserAudioDirector, type AudioDirector } from './audio/audio'
import { Settings } from './ui/Settings'
import { ErrorPanel } from './ui/ErrorPanel'
import './App.css'

function App() {
  try {
    return <GameApp content={getContent()} />
  } catch (error) {
    if (!(error instanceof ContentValidationError)) throw error
    return (
      <main className="hatchery-shell"><ErrorPanel title={rawContent.ui.screens.contentErrorTitle} description={rawContent.ui.screens.contentErrorDescription} detail={String(error.issues.length)} /></main>
    )
  }
}

function GameApp({ content }: { content: ContentPack }) {
  const repositoryRef = useRef<GameRepository | null>(null)
  if (repositoryRef.current === null) repositoryRef.current = createRepository()
  const repository = repositoryRef.current
  const audioRef = useRef<AudioDirector | null>(null)
  if (audioRef.current === null) audioRef.current = createBrowserAudioDirector()
  const saveLoadedRef = useRef(false)
  const controllerRef = useRef<AppController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = createController({
      createEngine: ({ seed, originId, modifierIds, route }) => createGameEngine({ seed, originId: originId as `origin-${string}`, environmentId: 'env-clear-drop', modifierIds, route }),
      nextSeed: (seed) => (seed + 1) >>> 0,
      recordResult: () => undefined,
    })
  }
  const controller = controllerRef.current
  const [view, setView] = useState(() => controller.snapshot())
  const mutationContextRef = useRef<MutationContext>(createMutationContext('env-clear-drop'))
  const mutationChoicesRef = useRef<MutationChoice[]>([])
  const [mutationChoices, setMutationChoices] = useState<MutationChoice[]>([])
  const [save, setSave] = useState(createDefaultSave)
  const [hasArchive, setHasArchive] = useState(false)
  const [selectedOriginId, setSelectedOriginId] = useState<OriginId>('origin-primal-cell')
  const [activeModifierIds, setActiveModifierIds] = useState<ModifierId[]>([])
  const [labPanel, setLabPanel] = useState<LabPanelId | null>(null)
  const [lastArchive, setLastArchive] = useState<ReturnType<typeof createViewModel>['archive']>()
  const [saveReady, setSaveReady] = useState(false)
  const [storageMode, setStorageMode] = useState<RepositoryMode>('persistent')
  const [storageIssues, setStorageIssues] = useState<SaveIssue[]>([])
  const [canvasError, setCanvasError] = useState(false)
  const sync = useCallback(() => setView(controller.snapshot()), [controller])
  const handleCanvasError = useCallback(() => {
    controller.pause('user')
    setCanvasError(true)
    sync()
  }, [controller, sync])
  const modalButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => { controller.destroy(); audioRef.current?.destroy() }, [controller])

  useEffect(() => {
    let active = true
    void repository.load().then((result) => {
      if (!active) return
      saveLoadedRef.current = true
      setSave(result.value)
      setStorageMode(result.mode)
      setStorageIssues(result.issues)
      setHasArchive(result.value.lifeArchives.length > 0)
      const latestArchive = result.value.lifeArchives.at(-1)
      if (latestArchive) setLastArchive(createArchiveViewModelFromSummary(latestArchive, content))
      const unlockedOrigin = content.origins.find((origin) => result.value.progression.unlockedIds.includes(origin.id))
      if (unlockedOrigin) setSelectedOriginId(unlockedOrigin.id)
      setSaveReady(true)
    })
    return () => { active = false }
  }, [content, repository])

  useEffect(() => {
    if (!saveLoadedRef.current) return
    audioRef.current?.setSettings(save.settings)
    void repository.save(save).then((result) => {
      setStorageMode(result.mode)
      if (result.issues.length > 0) setStorageIssues(result.issues)
    })
  }, [repository, save])

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
    const timer = window.setInterval(() => {
      const snapshot = controller.engine()?.renderSnapshot()
      const playerBodies = snapshot?.entities.filter((entity) => entity.faction === 'player') ?? []
      const sightRadius = 260 * (snapshot?.environmentField.visibility ?? 1)
      const knownCodexIds = new Set<string>([...content.nutrients, ...content.creatures].map((item) => item.id))
      const observed = snapshot?.entities.flatMap((entity) => {
        const id = 'definitionId' in entity ? String(entity.definitionId) : ''
        const visible = playerBodies.some((body) => Math.hypot(body.position.x - entity.position.x, body.position.y - entity.position.y) <= sightRadius)
        return knownCodexIds.has(id) && visible ? [id] : []
      }) ?? []
      if (observed.length > 0) setSave((current) => {
        let codex = current.codex
        for (const id of observed) if (!codex[id]) codex = advanceCodex(codex, id, 'seen')
        return codex === current.codex ? current : { ...current, codex }
      })
      sync()
    }, 100)
    return () => window.clearInterval(timer)
  }, [content, controller, sync, view.screen])

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
    events.forEach((event) => audioRef.current?.handle(event))
    events.forEach((event) => controller.handle(event))
    setSave((current) => {
      let codex = current.codex
      const completedIds: string[] = []
      const knownCodexIds = new Set<string>([...content.nutrients, ...content.creatures, ...content.events, ...content.bosses].map((item) => item.id))
      const advance = (id: Parameters<typeof advanceCodex>[1], state: 'seen' | 'defeated-by' | 'complete') => {
        if (!knownCodexIds.has(id)) return
        if (state === 'complete' && codex[id] !== 'complete') completedIds.push(id)
        codex = advanceCodex(codex, id, state)
      }
      for (const event of events) {
        if (event.type === 'event-phase') advance(event.eventId, event.phase === 'expired' ? 'complete' : 'seen')
        if (event.type === 'boss-resolved') advance(event.bossId, 'complete')
        if (event.type === 'engulfed' && event.predatorId.startsWith('player') && event.preyDefinitionId) advance(event.preyDefinitionId as Parameters<typeof advanceCodex>[1], 'complete')
        if (event.type === 'engulfed' && event.preyId.startsWith('player') && event.predatorDefinitionId) advance(event.predatorDefinitionId as Parameters<typeof advanceCodex>[1], 'defeated-by')
        if (event.type === 'player-died' && event.defeatedByDefinitionId) advance(event.defeatedByDefinitionId as Parameters<typeof advanceCodex>[1], 'defeated-by')
      }
      const { awarded: _awarded, ...progression } = awardGenes(current.progression, completedIds.map((id) => ({ kind: 'codex-complete', id, first: (current.progression.rewardCounts[`codex-complete:${id}`] ?? 0) === 0 })))
      return { ...current, codex, progression }
    })
    if (events.some((event) => event.type === 'player-died' || event.type === 'ending-reached')) {
      setHasArchive(true)
      const completedArchive = createViewModel(controller.snapshot(), content).archive
      setLastArchive(completedArchive)
      setSave((current) => {
        const successful = events.some((event) => event.type === 'ending-reached')
        const modifierRun = applyModifiers(activeModifierIds, { baseTelegraphLeadMs: 1400 })
        const rewardCount = (kind: string, id: string) => current.progression.rewardCounts[`${kind}:${id}`] ?? 0
        const rewardFact = <T extends 'environment' | 'boss-path' | 'modifier' | 'ending'>(kind: T, id: string) => ({ kind, id, first: rewardCount(kind, id) === 0, repeats: rewardCount(kind, id) })
        const modifierRewards = successful ? activeModifierIds.map((id) => rewardFact('modifier', id)) : []
        const visitedEnvironments = ['env-clear-drop', ...controller.snapshot().eventLog.flatMap((entry) => entry.event.type === 'route-selected' ? [entry.event.environmentId] : [])]
        const routeRewards = [...new Set(visitedEnvironments)].map((id) => rewardFact('environment', id))
        const bossRewards = controller.snapshot().eventLog.flatMap((entry) => entry.event.type === 'boss-resolved' ? [rewardFact('boss-path', `${entry.event.bossId}:${entry.event.path}`)] : [])
        const outcomeId = controller.snapshot().cause ?? 'run'
        const outcomeRewards = successful ? [rewardFact('ending', outcomeId)] : []
        const { awarded: _awarded, ...progression } = awardGenes(current.progression, [...outcomeRewards, ...routeRewards, ...bossRewards, ...modifierRewards], { multiplier: successful ? modifierRun.rewardMultiplier : 1 })
        const archive = completedArchive ? {
          speciesNameSeed: completedArchive.speciesNameSeed,
          survivalMs: completedArchive.survivalMs,
          farthestEnvironmentId: completedArchive.farthestEnvironmentId,
          maxBiomass: completedArchive.maxBiomass,
          keyOrganelleIds: completedArchive.keyOrganelleIds,
          synergyIds: completedArchive.synergyIds,
          deathTemplateId: completedArchive.deathTemplateId,
          endingId: completedArchive.endingId,
          dishCode: completedArchive.dishCode,
          finalMorphology: completedArchive.finalMorphology,
        } : undefined
        return {
          ...current,
          progression: { ...progression, completedModifierIds: successful ? [...new Set([...progression.completedModifierIds, ...activeModifierIds])] : progression.completedModifierIds },
          lifeArchives: archive ? [...current.lifeArchives, archive].slice(-30) : current.lifeArchives,
        }
      })
    }
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
  }, [activeModifierIds, content, controller, sync])

  const confirmMutation = useCallback((choice: MutationChoice) => {
    const result = installMutation(mutationContextRef.current, choice)
    controller.engine()?.applyMutation(result)
    setSave((current) => {
      const synergyRewards = result.synergyIds.map((id) => {
        const repeats = current.progression.rewardCounts[`synergy:${id}`] ?? 0
        return { kind: 'synergy' as const, id, first: repeats === 0, repeats }
      })
      const { awarded: _awarded, ...progression } = awardGenes(current.progression, synergyRewards)
      return { ...current, progression: { ...progression, discoveredSynergyIds: [...new Set([...progression.discoveredSynergyIds, ...result.synergyIds])] } }
    })
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
    const geneLockedOrgans = new Set(content.geneNodes.flatMap((node) => node.unlockIds.filter((id) => id.startsWith('organelle-'))))
    const availableOrgans = content.organelles.filter((organ) => !geneLockedOrgans.has(organ.id) || save.progression.unlockedIds.includes(organ.id)).map((organ) => organ.id)
    mutationContextRef.current = createMutationContext('env-clear-drop', availableOrgans)
    mutationChoicesRef.current = []
    setMutationChoices([])
  }, [content, save.progression.unlockedIds])

  const engine = controller.engine()
  const archiveModel = createViewModel(view, content).archive
  if (!saveReady) return <main className="hatchery-shell"><section className="hatchery-card" aria-live="polite"><p className="hatchery-region">{content.ui.labels.lab}</p><h1>{content.ui.screens.loadingSave}</h1></section></main>
  if (canvasError) return <main className="hatchery-shell"><ErrorPanel title={content.ui.screens.canvasErrorTitle} description={content.ui.screens.canvasErrorDescription} actionLabel={content.ui.actions.retry} onAction={() => { controller.returnToLab(); setCanvasError(false); sync() }} /></main>
  if (view.screen !== 'lab' && engine) {
    return (
      <main className="game-shell">
        <div className="game-stage" inert={mutationChoices.length > 0} aria-hidden={mutationChoices.length > 0 || undefined}>
          <GameCanvas engine={engine} label={content.ui.labels.gameCanvas} settings={save.settings} onEvents={handleEvents} onCanvasError={handleCanvasError} />
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
              onLab={() => {
                controller.returnToLab()
                setLabPanel(null)
                sync()
              }}
              labLabel={content.ui.actions.backToLab}
            />
          )}
        </div>
        {mutationChoices.length > 0 && <EvolutionOverlay choices={mutationChoices} onConfirm={confirmMutation} />}
      </main>
    )
  }

  if (labPanel === 'gene') return <main className="hatchery-shell lab-detail"><GeneGraph content={content} progress={save.progression} onUnlock={(id) => setSave((current) => ({ ...current, progression: unlockNode(current.progression, id) }))} /><button className="game-overlay__secondary" type="button" onClick={() => setLabPanel(null)}>{content.ui.actions.backToLab}</button></main>
  if (labPanel === 'codex') return <main className="hatchery-shell lab-detail"><Codex content={content} progress={save.codex} /><button className="game-overlay__secondary" type="button" onClick={() => setLabPanel(null)}>{content.ui.actions.backToLab}</button></main>
  if (labPanel === 'archive' && lastArchive) return <main className="game-shell"><Archive model={lastArchive} restartButtonRef={modalButtonRef} onRestart={() => { void audioRef.current?.unlock(); resetMutationRun(); controller.startRun({ seed: Date.now() >>> 0, originId: selectedOriginId, modifierIds: activeModifierIds }); setLabPanel(null); sync() }} onLab={() => setLabPanel(null)} labLabel={content.ui.actions.backToLab} onKeyDown={trapModalFocus} /></main>
  if (labPanel === 'settings') {
    const recoveryPayload = repository.recoveryPayload()
    return <main className="hatchery-shell lab-detail"><Settings content={content} settings={save.settings} storageMode={storageMode} storageIssues={storageIssues} onChange={(settings) => setSave((current) => ({ ...current, settings }))} onExport={() => repository.exportJson()} onExportRecovery={recoveryPayload === undefined ? undefined : async () => JSON.stringify(recoveryPayload, null, 2)} onImport={async (raw) => { const result = await repository.importJson(raw); setStorageMode(result.mode); setStorageIssues(result.issues); if (result.issues.length === 0) { setSave(result.value); setHasArchive(result.value.lifeArchives.length > 0); const latest = result.value.lifeArchives.at(-1); setLastArchive(latest ? createArchiveViewModelFromSummary(latest, content) : undefined); const unlockedOrigin = content.origins.find((origin) => result.value.progression.unlockedIds.includes(origin.id)); setSelectedOriginId(unlockedOrigin?.id ?? 'origin-primal-cell'); setActiveModifierIds([]) } return { ok: result.issues.length === 0, issues: result.issues } }} onClear={async () => { await repository.clear(); const cleared = createDefaultSave(); setSave(cleared); setHasArchive(false); setLastArchive(undefined); setActiveModifierIds([]); setSelectedOriginId('origin-primal-cell'); controller.returnToLab(); sync() }} onClose={() => setLabPanel(null)} /></main>
  }

  return <Lab content={content} save={save} hasArchive={hasArchive} selectedOriginId={selectedOriginId} activeModifierIds={activeModifierIds} dailyRunSeed={dailySeed(new Date(), content.contentVersion)} storageWarning={storageMode === 'session' || storageIssues.length > 0} onSelectOrigin={setSelectedOriginId} onToggleModifier={(id) => setActiveModifierIds((current) => applyModifiers(current.includes(id) ? current.filter((item) => item !== id) : [...current, id], { baseTelegraphLeadMs: 1400 }).activeIds)} onOpen={setLabPanel} onStart={(seed, route) => { void audioRef.current?.unlock(); resetMutationRun(); controller.startRun({ seed: seed ?? Date.now() >>> 0, originId: selectedOriginId, modifierIds: activeModifierIds, route }); sync() }} />
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
