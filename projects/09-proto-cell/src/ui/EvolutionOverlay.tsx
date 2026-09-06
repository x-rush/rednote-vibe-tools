import { useState, type KeyboardEvent } from 'react'
import { getContent } from '../content'
import { applyEvolution, createBuildState, type BuildState, type EvolutionLane, type EvolutionOffer, type EvolutionRoute } from '../evolution/build'
import { morphologyFor } from '../rendering/morphology'

type EvolutionOverlayProps = {
  choices: readonly EvolutionOffer[]
  currentBuild?: BuildState
  onConfirm: (choice: EvolutionOffer) => void
}

const laneCopyKeys: Record<EvolutionLane, string> = {
  continuation: 'mutationContinuation',
  adaptation: 'mutationAdaptation',
  risk: 'mutationRisk',
}
const routeCopyKeys: Record<EvolutionRoute, string> = {
  predation: 'routePredation',
  survival: 'routeSurvival',
  colony: 'routeColony',
}

export function EvolutionOverlay({ choices, currentBuild = createBuildState(), onConfirm }: EvolutionOverlayProps) {
  const content = getContent()
  const [selected, setSelected] = useState<EvolutionOffer>()
  const before = morphologyFor(currentBuild)

  return (
    <section className="evolution-overlay" role="dialog" aria-modal="true" aria-labelledby="evolution-title" onKeyDown={trapOverlayFocus}>
      <header className="evolution-overlay__header">
        <p className="hatchery-region">{content.ui.hud.evolution}</p>
        <h2 id="evolution-title">{content.ui.screens.evolutionTitle}</h2>
        <p>{content.ui.screens.evolutionDescription}</p>
      </header>
      <div className="evolution-choices" role="radiogroup" aria-label={content.ui.screens.evolutionTitle}>
        {choices.map((choice) => {
          const organ = content.organelles.find((item) => item.id === choice.traitId)
          if (!organ) return null
          const after = morphologyFor(applyEvolution(currentBuild, choice))
          const checked = selected?.traitId === choice.traitId
          return (
            <button
              className={`evolution-choice${checked ? ' evolution-choice--selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={checked}
              autoFocus={choice === choices[0]}
              key={`${choice.lane}:${choice.traitId}`}
              onClick={() => setSelected(choice)}
            >
              <span className="evolution-choice__lane">{content.ui.labels[laneCopyKeys[choice.lane]]}</span>
              <span className={`evolution-choice__route evolution-choice__route--${choice.route}`}>{content.ui.labels[routeCopyKeys[choice.route]]}</span>
              <span className="evolution-choice__preview" aria-hidden="true">
                <i data-stage={before.bodyStage} data-route={before.dominantRoute}><small>{content.ui.labels.evolutionBefore}</small></i>
                <b>→</b>
                <i data-stage={after.bodyStage} data-route={choice.route} data-part={organ.morphologyPartId}><small>{content.ui.labels.evolutionAfter}</small></i>
              </span>
              <strong>{organ.name}</strong>
              <span className="evolution-choice__behavior">{choice.behaviorText}</span>
              <span className="evolution-choice__cost">{choice.costText}</span>
            </button>
          )
        })}
      </div>
      <button className="hatchery-start evolution-overlay__confirm" type="button" disabled={!selected} onClick={() => selected && onConfirm(selected)}>
        {content.ui.actions.confirmMutation}
      </button>
    </section>
  )
}

function trapOverlayFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  if (controls.length === 0) return
  const current = controls.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.shiftKey
    ? current <= 0 ? controls.length - 1 : current - 1
    : current < 0 || current === controls.length - 1 ? 0 : current + 1
  event.preventDefault()
  controls[next]?.focus()
}
