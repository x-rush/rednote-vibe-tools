import type { CSSProperties, KeyboardEventHandler, RefObject } from 'react'
import type { createResultViewModel } from '../app/view-model'
import { getContent } from '../content'
import { assetPath } from '../content/assets'

export function ResultOverlay({
  model,
  onRestart,
  onLab,
  onReplaySeed,
  restartButtonRef,
  onKeyDown,
}: {
  model: ReturnType<typeof createResultViewModel>
  onRestart(): void
  onLab(): void
  onReplaySeed(): void
  restartButtonRef?: RefObject<HTMLButtonElement | null>
  onKeyDown?: KeyboardEventHandler<HTMLElement>
}) {
  const content = getContent()
  return (
    <section className={`result-overlay result-overlay--${model.route}`} role="dialog" aria-modal="true" aria-labelledby="result-title" onKeyDown={onKeyDown}>
      <header>
        <p className="hatchery-region">{model.routeLabel}</p>
        <h2 id="result-title">{model.cause}</h2>
      </header>
      <div className="result-morphology" data-stage={model.bodyStage} role="img" aria-label={model.stageLabel}>
        <i />
        {model.keyTraits.map((trait, index) => <span key={trait.id} data-part={trait.morphologyPartId} style={{ '--part-index': index } as CSSProperties}><img src={assetPath(trait.id)} alt="" /></span>)}
      </div>
      <dl className="result-facts">
        <div><dt>{content.ui.hud.resultStage}</dt><dd>{model.stageLabel}</dd></div>
        <div><dt>{content.ui.screens.survival}</dt><dd>{formatElapsed(model.survivalMs)}</dd></div>
        <div><dt>{content.ui.hud.resultJourney}</dt><dd>{model.journeyStage}/{model.journeyTotal}</dd></div>
        <div><dt>{content.ui.hud.resultScore}</dt><dd>{model.engulfScore.toLocaleString('zh-CN')}</dd></div>
      </dl>
      <section className="result-traits"><h3>{content.ui.hud.resultTraits}</h3><p>{model.keyTraits.map((trait) => trait.name).join(' · ') || content.ui.labels.archiveNoOrgans}</p></section>
      <div className="result-actions">
        <button ref={restartButtonRef} className="hatchery-start" type="button" onClick={onRestart}>{content.ui.hud.resultImmediateRestart}</button>
        <button className="game-overlay__secondary" type="button" onClick={onLab}>{content.ui.hud.resultBackDish}</button>
      </div>
      <details><summary>{content.ui.hud.resultSameSeed}</summary><button type="button" onClick={onReplaySeed}>{model.seed}</button></details>
    </section>
  )
}

function formatElapsed(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
