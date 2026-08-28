import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { getContent } from '../content'
import type { MutationAction, MutationChoice, MutationLane } from '../evolution/mutation'
import { assetPath } from '../content/assets'

type EvolutionOverlayProps = {
  choices: readonly MutationChoice[]
  onConfirm: (choice: MutationChoice) => void
}

const laneCopyKeys: Record<MutationLane, string> = {
  continuation: 'mutationContinuation',
  adaptation: 'mutationAdaptation',
  risk: 'mutationRisk',
}

const actionCopyKeys: Record<MutationAction, string> = {
  install: 'mutationInstall',
  mature: 'mutationMature',
  replace: 'mutationReplace',
  recombine: 'mutationRecombine',
  expand: 'mutationExpand',
}

export function EvolutionOverlay({ choices, onConfirm }: EvolutionOverlayProps) {
  const content = getContent()
  const [selected, setSelected] = useState<MutationChoice>()

  return (
    <section
      className="evolution-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evolution-title"
      onKeyDown={trapOverlayFocus}
    >
      <header className="evolution-overlay__header">
        <p className="hatchery-region">{content.ui.hud.evolution}</p>
        <h2 id="evolution-title">{content.ui.screens.evolutionTitle}</h2>
        <p>{content.ui.screens.evolutionDescription}</p>
      </header>
      <div className="evolution-choices" role="radiogroup" aria-label={content.ui.screens.evolutionTitle}>
        {choices.map((choice) => {
          const organ = content.organelles.find((item) => item.id === choice.organId)
          if (!organ) return null
          const visual = content.visualRecipes.find((item) => item.id === choice.visualMutationId)
          const replaced = content.organelles.find((item) => item.id === choice.replacedOrganId)
          const synergies = content.synergies.filter((item) => choice.revealedSynergyIds.includes(item.id))
          const checked = selected?.organId === choice.organId
          return (
            <button
              className={`evolution-choice${checked ? ' evolution-choice--selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={checked}
              autoFocus={choice === choices[0]}
              key={`${choice.lane}:${choice.organId}`}
              onClick={() => setSelected(choice)}
            >
              <span className="evolution-choice__lane">{content.ui.labels[laneCopyKeys[choice.lane]]}</span>
              <span className="evolution-choice__action">{content.ui.labels[actionCopyKeys[choice.action]]}</span>
              <span
                className="evolution-choice__specimen"
                aria-hidden="true"
                data-anchor={choice.previewAnchor}
                style={{ '--mutation-color': visual?.palette[0] ?? '#72f5ff' } as CSSProperties}
              >
                <img src={assetPath(organ.id)} alt="" />
                <span />
                <i />
              </span>
              <strong>{organ.name}</strong>
              <span>{organ.shortEffect}</span>
              <small>{organ.triggerDescription}</small>
              {replaced && (
                <span className="evolution-choice__consequence">
                  {content.ui.labels.mutationReplaces} · {replaced.name}
                </span>
              )}
              {synergies.map((synergy) => (
                <span className="evolution-choice__synergy" key={synergy.id}>
                  <img src={assetPath(synergy.id)} alt="" />
                  {choice.augmentedSynergyIds.includes(synergy.id) ? content.ui.labels.mutationSynergyAugment : content.ui.labels.mutationSynergy} · {synergy.name}
                  {choice.augmentedSynergyIds.includes(synergy.id) ? ` · ${synergy.augments?.find((augment) => augment.organId === choice.organId)?.effect ?? ''}` : ''}
                </span>
              ))}
              <span className="evolution-choice__stability">
                {content.ui.hud.stability} {choice.currentStability} → {choice.resultingStability}
              </span>
            </button>
          )
        })}
      </div>
      <button
        className="hatchery-start evolution-overlay__confirm"
        type="button"
        disabled={!selected}
        onClick={() => selected && onConfirm(selected)}
      >
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
